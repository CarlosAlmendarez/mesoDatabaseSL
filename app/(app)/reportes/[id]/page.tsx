import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { consultar } from "@/lib/db";
import { carreras, ciclos, type Opcion } from "@/lib/catalogos";
import { armarLlamada, PROCEDIMIENTOS, type Param } from "@/lib/procedimientos";
import { Tabla } from "@/components/Tabla";
import { Aviso, Cargando, Sql, Titulo } from "@/components/ui";

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
  const ejecutar = valores.ejecutar === "1";
  const [optCarreras, optCiclos] = await Promise.all([
    p.params.some((x) => x.tipo === "carrera") ? carreras() : Promise.resolve([]),
    p.params.some((x) => x.tipo === "ciclo") ? ciclos() : Promise.resolve([]),
  ]);

  let resultado: Awaited<ReturnType<typeof consultar>> | null = null;
  let error: string | null = null;
  let llamada = "";
  if (ejecutar) {
    try {
      const l = armarLlamada(p, valores);
      llamada = mostrarLlamada(l.texto, l.params);
      resultado = await consultar(l.texto, l.params);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  return (
    <div className="mt-4 space-y-5">
      <Titulo titulo={p.titulo} subtitulo={p.descripcion} />
      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <input type="hidden" name="ejecutar" value="1" />
        {p.params.map((prm) => (
          <Campo key={prm.nombre} prm={prm} valor={valores[prm.nombre]} carreras={optCarreras} ciclos={optCiclos} />
        ))}
        <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white">Ejecutar</button>
      </form>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {resultado && (
        <>
          <Tabla columnas={resultado.columnas} filas={resultado.filas} truncado={resultado.truncado} archivo={p.id} />
          <div className="space-y-1">
            <p className="text-xs text-muted">Así se llama desde cualquier sistema o desde la consola SQL:</p>
            <Sql>{llamada}</Sql>
          </div>
        </>
      )}
      {!ejecutar && <p className="text-sm text-muted">Llena los campos que necesites y pulsa Ejecutar.</p>}
    </div>
  );
}

// Versión legible de la llamada (solo para mostrar; la ejecución usa parámetros).
function mostrarLlamada(texto: string, params: unknown[]): string {
  return texto.replace(/\$(\d+)::\w+/g, (_, n) => {
    const v = params[Number(n) - 1];
    return typeof v === "boolean" ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
  }) + ";";
}

function Campo({ prm, valor, carreras, ciclos }: { prm: Param; valor?: string; carreras: Opcion[]; ciclos: Opcion[] }) {
  const etiqueta = `${prm.etiqueta}${prm.requerido ? " *" : ""}`;
  const clase = "rounded-md border border-border px-3 py-2";
  let control: React.ReactNode;
  if (prm.tipo === "booleano") {
    control = (
      <select name={prm.nombre} defaultValue={valor ?? ""} className={clase}>
        <option value="">—</option>
        <option value="true">Sí</option>
        <option value="false">No</option>
      </select>
    );
  } else if (prm.tipo === "carrera" || prm.tipo === "ciclo" || prm.tipo === "opcion") {
    const ops = prm.tipo === "carrera" ? carreras : prm.tipo === "ciclo" ? ciclos : prm.opciones ?? [];
    control = (
      <select name={prm.nombre} defaultValue={valor ?? ""} required={prm.requerido} className={clase}>
        <option value="">{prm.requerido ? "Elige…" : "Todos"}</option>
        {ops.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
      </select>
    );
  } else {
    control = (
      <input
        name={prm.nombre}
        type={prm.tipo === "fecha" ? "date" : prm.tipo === "numero" ? "number" : "text"}
        step="any"
        defaultValue={valor ?? prm.ejemplo ?? ""}
        required={prm.requerido}
        className={clase}
      />
    );
  }
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{etiqueta}</span>
      {control}
    </label>
  );
}
