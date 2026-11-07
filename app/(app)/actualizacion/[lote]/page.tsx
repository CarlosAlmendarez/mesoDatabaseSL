import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { consultar, filas } from "@/lib/db";
import { consultaBase, type Fuente } from "@/lib/fuentes";
import { Resultado } from "@/components/Resultado";
import { Aviso, Cargando } from "@/components/ui";
import { ACCIONES, ENTIDADES, ESTADOS } from "../comun";
import { Acciones } from "./Acciones";

export const maxDuration = 60;

type Props = {
  params: Promise<{ lote: string }>;
  searchParams: Promise<{ entidad?: string; accion?: string }>;
};

export default function Lote(props: Props) {
  return (
    <>
      <Link href="/actualizacion" className="text-sm text-brand hover:underline">← Actualizar datos</Link>
      <Suspense fallback={<div className="mt-4"><Cargando /></div>}>
        <Contenido {...props} />
      </Suspense>
    </>
  );
}

type Lote = {
  id: number; estado: string; creado: string; comparado: string | null; aplicado: string | null; deshecho: string | null;
  archivos: { ruta: string }[]; resumen: { por_entidad?: Record<string, Record<string, number>>; deshecho?: Record<string, number> } | null;
};

async function Contenido({ params, searchParams }: Props) {
  await connection();
  const id = Number((await params).lote);
  if (!Number.isInteger(id)) notFound();
  const { entidad = "", accion = "" } = await searchParams;
  const fmt = (c: string) => `to_char(${c} AT TIME ZONE 'America/Mexico_City', 'DD/MM/YYYY HH24:MI')`;
  const [l] = await filas<Lote>(
    `SELECT id, estado, ${fmt("creado_at")} AS creado, ${fmt("comparado_at")} AS comparado, ${fmt("aplicado_at")} AS aplicado,
            ${fmt("deshecho_at")} AS deshecho, archivos, resumen
     FROM carga.lote WHERE id = $1`, [id],
  );
  if (!l) notFound();
  const por = l.resumen?.por_entidad ?? {};
  const entidades = Object.keys(ENTIDADES).filter((e) => por[e]);
  const acciones = Object.keys(ACCIONES);

  const fuente: Fuente = { t: "carga", lote: id, entidad, accion };
  const base = consultaBase(fuente);
  const datos = await consultar(base.texto, base.params);
  const filtro = [entidad && ENTIDADES[entidad], accion && ACCIONES[accion]?.titulo].filter(Boolean).join(" · ");

  return (
    <div className="mt-4 space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Actualización #{l.id}</h1>
        <p className="mt-1 text-sm text-muted">
          {l.archivos.length} archivos · enviada el {l.creado}
          {l.aplicado && ` · aplicada el ${l.aplicado}`}{l.deshecho && ` · deshecha el ${l.deshecho}`}
        </p>
        <p className="mt-2 inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">{ESTADOS[l.estado] ?? l.estado}</p>
      </header>

      {l.estado === "comparado" && (
        <Aviso>
          Esto es una <strong>vista previa</strong>: la base todavía no cambió. Revisa los números y el detalle; si todo está
          bien, pulsa «Aplicar a la base». Los conflictos y los renglones por revisar no se aplican.
        </Aviso>
      )}
      {l.estado === "aplicado" && <Aviso tipo="ok">Los cambios ya están en la base y quedaron registrados en la bitácora con el usuario «carga:{l.id}».</Aviso>}
      {l.estado === "deshecho" && <Aviso>Esta actualización se deshizo: la base volvió a como estaba antes de aplicarla.</Aviso>}

      <section className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-brand-soft text-left text-xs text-brand">
            <tr>
              <th className="px-4 py-2">Qué</th>
              {acciones.map((a) => <th key={a} className="px-4 py-2 text-right" title={ACCIONES[a].ayuda}>{ACCIONES[a].titulo}</th>)}
            </tr>
          </thead>
          <tbody>
            {entidades.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-3 text-muted">Sin diferencias: la base ya tiene todo lo que traen los archivos.</td></tr>
            )}
            {entidades.map((e) => (
              <tr key={e} className="border-t border-border">
                <td className="px-4 py-2">{ENTIDADES[e]}</td>
                {acciones.map((a) => {
                  const n = por[e]?.[a] ?? 0;
                  return (
                    <td key={a} className="px-4 py-2 text-right tabular-nums">
                      {n ? <Link href={`/actualizacion/${id}?entidad=${e}&accion=${a}`} className="text-brand hover:underline">{n.toLocaleString("es-MX")}</Link> : <span className="text-muted">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-border px-4 py-2 text-xs text-muted">
          {acciones.map((a) => `${ACCIONES[a].titulo}: ${ACCIONES[a].ayuda}`).join(" ")}
        </p>
      </section>

      <Acciones lote={id} estado={l.estado} />

      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-semibold">Detalle{filtro && `: ${filtro}`}</h2>
          {(entidad || accion) && <Link href={`/actualizacion/${id}`} className="text-sm text-brand hover:underline">Ver todo</Link>}
        </div>
        <Resultado key={`${entidad}|${accion}`} fuente={fuente} inicial={datos} titulo={`Actualización ${id}${filtro ? ` - ${filtro}` : ""}`}
          agruparSugerido={["entidad", "accion"]} enlaceMatricula={false} />
      </section>
    </div>
  );
}
