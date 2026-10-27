import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { filas } from "@/lib/db";
import { Grafica } from "@/components/Grafica";
import { Cargando, Titulo } from "@/components/ui";

export default function Inicio() {
  return (
    <>
      <Titulo
        titulo="Inicio"
        subtitulo="Toda la información del plantel San Luis Potosí en una sola base: alumnos, historial, docentes, grupos y reportes. Esta demo muestra lo que se puede consultar y exportar con ella."
      />
      <section className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Acceso href="/tablero" titulo="Tablero para rectoría" texto="Matrícula, reprobación, eficiencia terminal y deserción por generación." />
        <Acceso href="/alumnos" titulo="Buscar un alumno" texto="Por nombre o matrícula: ficha, promedios y kárdex completo." />
        <Acceso href="/reportes" titulo="Reportes listos" texto="Formato 911 y relaciones para la SEP, becas, reprobación, titulación. Con Excel." />
        <Acceso href="/modelo" titulo="Modelo de datos" texto="Las tablas de la base, cómo se relacionan y de qué archivo del sistema anterior salió cada dato." />
        <Acceso href="/consola" titulo="Consulta propia" texto="Escribe SQL o carga un ejemplo; agrupa y exporta el resultado." />
        <Acceso href="/guia" titulo="¿Primera vez?" texto="Guía rápida: qué hay en cada menú y cómo exportar." />
      </section>
      <Suspense fallback={<Cargando />}>
        <Resumen />
      </Suspense>
    </>
  );
}

function Acceso({ href, titulo, texto }: { href: string; titulo: string; texto: string }) {
  return (
    <Link href={href} className="rounded-xl border border-border bg-card p-4 hover:border-brand">
      <p className="font-semibold text-brand">{titulo} →</p>
      <p className="mt-1 text-sm text-muted">{texto}</p>
    </Link>
  );
}

type Totales = Record<string, number>;
type PorCarrera = { clave: string; nombre: string; alumnos: number; activos: number };
type PorCiclo = { ciclo: string; alumnos: number; promedio: number };

async function Resumen() {
  await connection();
  const [[t], carreras, ciclos] = await Promise.all([
    filas<Totales>(`
      SELECT (SELECT count(*) FROM alumnos) alumnos,
             (SELECT count(*) FROM alumnos WHERE activo) activos,
             (SELECT count(*) FROM alumnos WHERE titulado) titulados,
             (SELECT count(*) FROM carreras) carreras,
             (SELECT count(*) FROM materias) materias,
             (SELECT count(*) FROM docentes) docentes,
             (SELECT count(*) FROM inscripcion_materia) inscripciones,
             (SELECT count(*) FROM intento_calificacion) calificaciones`),
    filas<PorCarrera>(`
      SELECT c.clave, c.nombre, count(a.id) alumnos, count(a.id) FILTER (WHERE a.activo) activos
      FROM carreras c LEFT JOIN alumnos a ON a.carrera_id = c.id
      GROUP BY c.id HAVING count(a.id) > 0 ORDER BY count(a.id) DESC`),
    filas<PorCiclo>(`
      SELECT c.clave AS ciclo, count(DISTINCT i.alumno_id) AS alumnos, round(avg(i.calificacion_final), 2) AS promedio
      FROM inscripcion_materia i JOIN ciclos_escolares c ON c.id = i.ciclo_id
      WHERE fn_ciclo_orden(c.clave) >= 20011 AND c.clave ~ '-[12]$' AND i.fecha_baja IS NULL
      GROUP BY c.clave ORDER BY fn_ciclo_orden(c.clave)`),
  ]);
  const n = (v: number) => Number(v).toLocaleString("es-MX");
  const max = Math.max(...carreras.map((c) => Number(c.alumnos)));
  const tarjetas: [string, number][] = [
    ["Alumnos", t.alumnos], ["Activos", t.activos], ["Titulados", t.titulados], ["Carreras", t.carreras],
    ["Materias", t.materias], ["Docentes", t.docentes], ["Materias cursadas", t.inscripciones], ["Calificaciones", t.calificaciones],
  ];
  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tarjetas.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{k}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{n(v)}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Alumnos con materias en cada ciclo</h2>
          <Link href="/reportes/tendencia-ciclos" className="text-sm text-brand hover:underline">Ver reporte completo →</Link>
        </div>
        <p className="mb-2 text-xs text-muted">Ciclos ordinarios desde 2001-1. Pasa el cursor sobre la línea para ver cada ciclo.</p>
        <Grafica filas={ciclos} config={{ tipo: "linea", x: "ciclo", y: "alumnos" }} alto={260} />
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Alumnos por carrera</h2>
          <Link href="/reportes/carreras" className="text-sm text-brand hover:underline">Catálogo de carreras →</Link>
        </div>
        <div className="mb-4 mt-1 flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm bg-brand" /> Activos</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm bg-brand/30" /> Total registrados</span>
        </div>
        <div className="space-y-2">
          {carreras.map((c) => (
            <Link key={c.clave} href={`/alumnos?carrera=${c.clave}&activo=true`} title="Ver los alumnos activos de esta carrera"
              className="grid grid-cols-[3rem_1fr_7rem] items-center gap-3 rounded text-sm hover:bg-brand-soft/50 md:grid-cols-[3rem_18rem_1fr_7rem]">
              <span className="font-mono text-muted">{c.clave}</span>
              <span className="hidden truncate md:block" title={c.nombre}>{c.nombre}</span>
              <div className="h-3 rounded bg-brand-soft">
                <div className="relative h-3 rounded bg-brand/30" style={{ width: `${(Number(c.alumnos) / max) * 100}%` }}>
                  <div className="absolute inset-y-0 left-0 rounded bg-brand" style={{ width: `${(Number(c.activos) / Number(c.alumnos)) * 100}%` }} />
                </div>
              </div>
              <span className="text-right tabular-nums"><strong>{n(c.activos)}</strong> <span className="text-muted">/ {n(c.alumnos)}</span></span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
