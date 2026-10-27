import { Suspense } from "react";
import { consultar } from "@/lib/db";
import { carreras } from "@/lib/catalogos";
import { consultaBase, type Fuente } from "@/lib/fuentes";
import { Resultado } from "@/components/Resultado";
import { Selector } from "@/components/Selector";
import { Cargando, Titulo } from "@/components/ui";

type Busqueda = { q?: string; carrera?: string; activo?: string };

export default function Alumnos({ searchParams }: { searchParams: Promise<Busqueda> }) {
  return (
    <>
      <Titulo
        titulo="Alumnos"
        subtitulo="Busca por nombre, apellido o matrícula, o elige una carrera para ver a todos sus alumnos. Al abrir una matrícula ves su ficha, promedios y kárdex completo."
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
  const fuente: Fuente = { t: "alumnos", q, carrera, activo };
  const base = consultaBase(fuente);
  const r = buscar ? await consultar(base.texto, base.params) : null;
  const filtros: [string, string][] = [
    ...(q ? [["Nombre o matrícula", q] as [string, string]] : []),
    ...(carrera ? [["Carrera", carrera] as [string, string]] : []),
    ...(activo ? [["Estado", activo === "true" ? "Activos" : "Inactivos"] as [string, string]] : []),
  ];

  return (
    <div className="space-y-5">
      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <label className="flex min-w-60 flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">Nombre o matrícula</span>
          <input name="q" defaultValue={q} placeholder="Ej. LOPEZ o 21102010" className="rounded-md border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Carrera</span>
          <Selector name="carrera" opciones={opciones} defaultValue={carrera} vacio="Todas las carreras" ancho="w-80" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Estado</span>
          <select name="activo" defaultValue={activo} className="rounded-md border border-border bg-white px-3 py-2">
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </label>
        <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white">Buscar</button>
      </form>
      {r ? (
        <Resultado key={JSON.stringify(fuente)} fuente={fuente} inicial={r} titulo="Alumnos" filtros={filtros}
          agruparSugerido={["carrera"]} />
      ) : (
        <p className="text-sm text-muted">Escribe un nombre o elige una carrera para buscar. Ejemplo: elige «05 · Derecho» y estado «Activos».</p>
      )}
    </div>
  );
}
