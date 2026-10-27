import { Suspense } from "react";
import { consultar } from "@/lib/db";
import { carreras } from "@/lib/catalogos";
import { Tabla } from "@/components/Tabla";
import { Cargando, Sql, Titulo } from "@/components/ui";

type Busqueda = { q?: string; carrera?: string; activo?: string };

export default function Alumnos({ searchParams }: { searchParams: Promise<Busqueda> }) {
  return (
    <>
      <Titulo
        titulo="Alumnos"
        subtitulo="Busca por nombre, apellido o matrícula. Al abrir una matrícula ves su ficha, promedios y kárdex completo."
      />
      <Suspense fallback={<Cargando />}>
        <Resultados searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Resultados({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const { q = "", carrera = "", activo = "" } = await searchParams;
  const opciones = await carreras();
  const buscar = q.trim() !== "" || carrera !== "" || activo !== "";
  const llamada =
    "SELECT * FROM sp_buscar_alumnos(p_texto => $1::text, p_carrera => $2::text, p_activo => $3::boolean)";
  const r = buscar
    ? await consultar(llamada, [q.trim() || null, carrera || null, activo === "" ? null : activo === "true"])
    : null;

  return (
    <div className="space-y-5">
      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <label className="flex min-w-60 flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">Nombre o matrícula</span>
          <input name="q" defaultValue={q} placeholder="Ej. LOPEZ o 21102010" className="rounded-md border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Carrera</span>
          <select name="carrera" defaultValue={carrera} className="rounded-md border border-border px-3 py-2">
            <option value="">Todas</option>
            {opciones.map((o) => (
              <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Estado</span>
          <select name="activo" defaultValue={activo} className="rounded-md border border-border px-3 py-2">
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </label>
        <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white">Buscar</button>
      </form>
      {r ? (
        <>
          <Tabla columnas={r.columnas} filas={r.filas} truncado={r.truncado} archivo="alumnos" />
          <details className="text-sm text-muted">
            <summary className="cursor-pointer">Ver la llamada a la base</summary>
            <div className="mt-2"><Sql>{llamada}</Sql></div>
          </details>
        </>
      ) : (
        <p className="text-sm text-muted">Escribe un nombre o elige una carrera para buscar.</p>
      )}
    </div>
  );
}
