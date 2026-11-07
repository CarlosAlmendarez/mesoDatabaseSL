"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clasificar, leerArchivo, type ArchivoLeido } from "@/lib/legado";
import { carrerasLote, crearLote, descartarLote, finalizarLote, procesarCarrera, type ArchivoLote } from "./actions";

type Fila = { ruta: string; estado: "ok" | "omitido" | "error"; detalle: string; alumnos?: number; historial?: number; plan?: number };
type Fase = "inicio" | "leyendo" | "listo" | "enviando" | "error";

const MAX_GZIP = 3_500_000;   // bytes por parte (Vercel acepta hasta 4.5 MB por petición)

async function gzip(texto: string): Promise<Blob> {
  const flujo = new Blob([texto]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(flujo).blob();
}

export function Cargador() {
  const router = useRouter();
  const [fase, setFase] = useState<Fase>("inicio");
  const [filas, setFilas] = useState<Fila[]>([]);
  const [progreso, setProgreso] = useState("");
  const [error, setError] = useState<string | null>(null);
  const leidos = useRef<ArchivoLeido[]>([]);

  async function leer(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    setError(null);
    setFase("leyendo");
    leidos.current = [];
    const [{ default: MDBReader }, { Buffer }] = await Promise.all([import("mdb-reader"), import("buffer")]);
    const g = globalThis as unknown as { Buffer?: typeof Buffer };
    g.Buffer ??= Buffer;

    const mdb = Array.from(lista).filter((f) => /\.mdb$/i.test(f.name));
    const salida: Fila[] = [];
    for (const [i, f] of mdb.entries()) {
      const ruta = (f.webkitRelativePath || f.name).replace(/\\/g, "/");
      const c = clasificar(ruta);
      if (!c.ok) {
        salida.push({ ruta, estado: "omitido", detalle: c.motivo });
        continue;
      }
      setProgreso(`Leyendo ${i + 1} de ${mdb.length}: ${ruta}`);
      try {
        const r = leerArchivo(MDBReader, Buffer.from(await f.arrayBuffer()), ruta);
        if ("error" in r) {
          salida.push({ ruta, estado: "error", detalle: r.error });
        } else if (r.expedientes.length === 0 && r.historial.length === 0 && r.plan.length === 0) {
          salida.push({ ruta, estado: "omitido", detalle: "sin expedientes, calificaciones ni materias" });
        } else {
          leidos.current.push(r);
          salida.push({ ruta, estado: "ok", detalle: etiquetaOrigen(r.origen_tipo), alumnos: r.expedientes.length, historial: r.historial.length, plan: r.plan.length });
        }
      } catch (e) {
        salida.push({ ruta, estado: "error", detalle: e instanceof Error ? e.message : String(e) });
      }
    }
    salida.sort((a, b) => (a.estado === b.estado ? a.ruta.localeCompare(b.ruta) : a.estado === "ok" ? -1 : 1));
    setFilas(salida);
    setProgreso("");
    setFase(leidos.current.length ? "listo" : "inicio");
    if (!leidos.current.length) setError(mdb.length ? "Ninguno de los archivos tiene expedientes, calificaciones ni planes de estudio." : "No se eligió ningún archivo .mdb.");
  }

  async function enviar() {
    setFase("enviando");
    setError(null);
    const meta: ArchivoLote[] = leidos.current.map((a) => ({
      ruta: a.ruta, origen_tipo: a.origen_tipo, carrera_codigo: a.carrera_codigo,
      alumnos: a.expedientes.length, historial: a.historial.length, plan: a.plan.length,
    }));
    const lote = await crearLote(meta);
    if (!lote.ok) return fallar(lote.error);
    const id = lote.id;
    try {
      for (const tipo of ["plan", "expediente", "historial"] as const) {
        const todas: unknown[] = leidos.current.flatMap((a): unknown[] => (tipo === "plan" ? a.plan : tipo === "expediente" ? a.expedientes : a.historial));
        let tam = 6000;
        for (let i = 0; i < todas.length; ) {
          const parte = todas.slice(i, i + tam);
          const cuerpo = await gzip(JSON.stringify(parte));
          if (cuerpo.size > MAX_GZIP && tam > 500) { tam = Math.floor(tam / 2); continue; }
          setProgreso(`Enviando ${tipo === "plan" ? "planes de estudio" : tipo === "expediente" ? "expedientes" : "calificaciones"}: ${Math.min(i + parte.length, todas.length).toLocaleString("es-MX")} de ${todas.length.toLocaleString("es-MX")}`);
          const r = await fetch(`/api/actualizacion?lote=${id}&tipo=${tipo}`, {
            method: "POST", body: cuerpo, headers: { "Content-Type": "application/octet-stream" },
          });
          if (!r.ok) throw new Error(await r.text());
          i += parte.length;
        }
      }
      const cs = await carrerasLote(id);
      if (!cs.ok) throw new Error(cs.error);
      for (const [i, c] of cs.carreras.entries()) {
        setProgreso(`Comparando con la base: carrera ${c} (${i + 1} de ${cs.carreras.length})`);
        const r = await procesarCarrera(id, false, c);
        if (!r.ok) throw new Error(`Carrera ${c}: ${r.error}`);
      }
      const f = await finalizarLote(id, false);
      if (!f.ok) throw new Error(f.error);
      router.push(`/actualizacion/${id}`);
    } catch (e) {
      await descartarLote(id);
      fallar(e instanceof Error ? e.message : String(e));
    }
  }

  function fallar(msg: string) {
    setError(msg);
    setProgreso("");
    setFase("listo");
  }

  const ok = filas.filter((f) => f.estado === "ok");
  const otros = filas.filter((f) => f.estado !== "ok");
  const ocupado = fase === "leyendo" || fase === "enviando";

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="font-semibold">1. Elige los archivos del sistema anterior</h2>
        <p className="mt-1 text-sm text-muted">
          Lo más sencillo es elegir la <strong>carpeta completa del sistema</strong> (la que tiene archexpe, regstemp, titulo,
          especiales, Web y Archivos). Se leen los archivos de expedientes por carrera (01expe, 55reva, 99BAJA, 66EGRE,
          60espe…) y los planes de estudio de Archivos (01CONTA, 55DER…);
          las copias de respaldo y la carpeta reportes se omiten. Los archivos se leen en esta computadora: a la base solo
          viajan los datos de alumnos y calificaciones.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className={`cursor-pointer rounded-md bg-brand px-4 py-2 text-sm font-medium text-white ${ocupado ? "pointer-events-none opacity-50" : ""}`}>
          Elegir carpeta
          <input type="file" className="hidden" multiple {...{ webkitdirectory: "" }} onChange={(e) => leer(e.target.files)} />
        </label>
        <label className={`cursor-pointer rounded-md border border-border px-4 py-2 text-sm font-medium ${ocupado ? "pointer-events-none opacity-50" : ""}`}>
          Elegir archivos .mdb sueltos
          <input type="file" className="hidden" multiple accept=".mdb" onChange={(e) => leer(e.target.files)} />
        </label>
      </div>

      {progreso && <p className="animate-pulse text-sm text-brand">{progreso}</p>}
      {error && <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      {ok.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold">2. Revisa lo que se leyó</h2>
          <p className="text-sm">
            {ok.length} archivos con datos: <strong>{ok.reduce((s, f) => s + (f.alumnos ?? 0), 0).toLocaleString("es-MX")}</strong> expedientes y{" "}
            <strong>{ok.reduce((s, f) => s + (f.historial ?? 0), 0).toLocaleString("es-MX")}</strong> renglones de calificaciones
            {ok.some((f) => f.plan) && <>, y <strong>{ok.reduce((s, f) => s + (f.plan ?? 0), 0).toLocaleString("es-MX")}</strong> materias de planes de estudio</>}.
            {otros.length > 0 && ` Se omitieron ${otros.length} archivos (ver abajo).`}
          </p>
          <div className="max-h-72 overflow-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-brand-soft text-left text-xs text-brand">
                <tr><th className="px-3 py-2">Archivo</th><th className="px-3 py-2">Carpeta</th><th className="px-3 py-2 text-right">Expedientes</th><th className="px-3 py-2 text-right">Calificaciones</th><th className="px-3 py-2 text-right">Materias del plan</th></tr>
              </thead>
              <tbody>
                {ok.map((f) => (
                  <tr key={f.ruta} className="border-t border-border">
                    <td className="px-3 py-1.5 font-mono text-xs">{f.ruta}</td>
                    <td className="px-3 py-1.5">{f.detalle}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{f.alumnos ? f.alumnos.toLocaleString("es-MX") : ""}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{f.historial ? f.historial.toLocaleString("es-MX") : ""}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{f.plan ? f.plan.toLocaleString("es-MX") : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {otros.length > 0 && (
            <details className="text-sm text-muted">
              <summary className="cursor-pointer">Archivos omitidos ({otros.length})</summary>
              <ul className="mt-2 max-h-48 space-y-0.5 overflow-auto text-xs">
                {otros.map((f) => <li key={f.ruta}><span className="font-mono">{f.ruta}</span> — {f.detalle}</li>)}
              </ul>
            </details>
          )}
          <div>
            <h2 className="font-semibold">3. Compara con la base</h2>
            <p className="mt-1 text-sm text-muted">
              Se envían los datos y la base los compara con lo que ya tiene. <strong>Todavía no se cambia nada:</strong> en
              el siguiente paso verás qué es nuevo, qué cambió y qué hay que revisar, y decides si aplicarlo.
            </p>
            <button onClick={enviar} disabled={ocupado}
              className="mt-3 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {fase === "enviando" ? "Comparando…" : "Enviar y comparar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function etiquetaOrigen(o: string): string {
  return ({
    expediente_archivado: "Expedientes (archexpe/REGULAR)", revalidacion: "Revalidación", baja: "Bajas (regstemp)",
    egresado_titulado: "Egresados (titulo)", web_copia: "Copia Web", especiales: "Especiales",
    archivos_principal: "Archivos", plan_estudios: "Plan de estudios (Archivos)",
  } as Record<string, string>)[o] ?? o;
}
