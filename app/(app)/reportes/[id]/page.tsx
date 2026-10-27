import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { consultar } from "@/lib/db";
import { carreras, ciclos, type Opcion } from "@/lib/catalogos";
import { armarLlamada, llamadaLegible, PROCEDIMIENTOS, type Param } from "@/lib/procedimientos";
import { Resultado } from "@/components/Resultado";
import { Selector } from "@/components/Selector";
import { Aviso, Cargando, Sql } from "@/components/ui";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default function Reporte(props: Props) {
  return (
    <>
      <Link href="/reportes" className="text-sm text-brand hover:underline">← Todos los reportes</Link>
      <Suspense fallback={<div className="mt-4"><Cargando /></div>}>
        <Contenido {...props} />
      </Suspense>
    </>
  );
}

async function Contenido({ params, searchParams }: Props) {
  const { id } = await params;
  const p = PROCEDIMIENTOS.find((x) => x.id === id);
  if (!p) notFound();
  const valores = await searchParams;
  // Sin parámetros obligatorios, el reporte corre al abrirlo.
  const ejecutar = valores.ejecutar === "1" || !p.params.some((x) => x.requerido);
  const [optCarreras, optCiclos] = await Promise.all([
    p.params.some((x) => x.tipo === "carrera") ? carreras() : Promise.resolve([]),
    p.params.some((x) => x.tipo === "ciclo") ? ciclos() : Promise.resolve([]),
  ]);

  let resultado: Awaited<ReturnType<typeof consultar>> | null = null;
  let error: string | null = null;
  let llamada = "";
  const usados: [string, string][] = [];
  if (ejecutar) {
    try {
      const l = armarLlamada(p, valores);
      llamada = llamadaLegible(l.texto, l.params);
      resultado = await consultar(l.texto, l.params);
      for (const prm of p.params) {
        const v = valores[prm.nombre];
        if (v) usados.push([prm.etiqueta, prm.tipo === "booleano" ? (v === "true" ? "Sí" : "No") : v]);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  return (
    <div className="mt-4 space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{p.grupo}</p>
        <h1 className="mt-1 text-2xl font-semibold">{p.titulo}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">{p.descripcion}</p>
      </header>
      <Aviso><strong>Cómo usarlo:</strong> {p.ayuda}</Aviso>

      {p.params.length > 0 && (
        <form className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
          <input type="hidden" name="ejecutar" value="1" />
          {p.params.map((prm) => (
            <Campo key={prm.nombre} prm={prm} valor={valores[prm.nombre]} carreras={optCarreras} ciclos={optCiclos} />
          ))}
          <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white">Consultar</button>
          {Object.keys(valores).length > 0 && (
            <Link href={`/reportes/${p.id}`} className="px-2 py-2 text-sm text-muted hover:text-brand">Limpiar</Link>
          )}
        </form>
      )}

      {error && <Aviso tipo="error">{error}</Aviso>}
      {resultado && (
        <>
          <Resultado
            key={llamada}
            fuente={{ t: "reporte", id: p.id, v: valores }}
            inicial={resultado}
            titulo={p.titulo}
            filtros={usados}
            vista={p.vista}
            agruparSugerido={p.agruparSugerido}
            vistaInicial={p.vista && resultado.filas.length > 1 && !p.agruparSugerido ? "grafica" : "tabla"}
          />
          <details className="text-sm text-muted">
            <summary className="cursor-pointer">Ver la consulta a la base</summary>
            <p className="mt-2 text-xs">{p.funcion ? "Este reporte es un procedimiento almacenado; cualquier sistema lo llama así:" : "Consulta de solo lectura que ejecuta la app:"}</p>
            <div className="mt-1"><Sql>{llamada}</Sql></div>
          </details>
        </>
      )}
      {!ejecutar && <p className="text-sm text-muted">Llena los campos marcados con * y pulsa Consultar.</p>}
    </div>
  );
}

function Campo({ prm, valor, carreras, ciclos }: { prm: Param; valor?: string; carreras: Opcion[]; ciclos: Opcion[] }) {
  const clase = "rounded-md border border-border bg-white px-3 py-2 text-sm";
  let control: React.ReactNode;
  if (prm.tipo === "carrera" || prm.tipo === "ciclo") {
    control = (
      <Selector name={prm.nombre} opciones={prm.tipo === "carrera" ? carreras : ciclos} defaultValue={valor ?? prm.ejemplo ?? ""}
        requerido={prm.requerido} vacio={prm.tipo === "carrera" ? "Todas las carreras" : "Todos los ciclos"}
        ancho={prm.tipo === "carrera" ? "w-80" : "w-60"} />
    );
  } else if (prm.tipo === "booleano" || prm.tipo === "opcion") {
    const ops = prm.tipo === "booleano" ? [{ valor: "true", etiqueta: "Sí" }, { valor: "false", etiqueta: "No" }] : prm.opciones ?? [];
    control = (
      <select name={prm.nombre} defaultValue={valor ?? ""} required={prm.requerido} className={clase}>
        <option value="">{prm.tipo === "booleano" ? "Sin filtro" : "Todos"}</option>
        {ops.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
      </select>
    );
  } else {
    control = (
      <input name={prm.nombre} type={prm.tipo === "fecha" ? "date" : prm.tipo === "numero" ? "number" : "text"} step="any"
        defaultValue={valor ?? prm.ejemplo ?? ""} required={prm.requerido} className={clase} />
    );
  }
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{prm.etiqueta}{prm.requerido ? " *" : ""}</span>
      {control}
    </label>
  );
}
