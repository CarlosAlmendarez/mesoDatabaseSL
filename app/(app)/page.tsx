import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { filas } from "@/lib/db";
import { Cargando, Titulo } from "@/components/ui";

export default function Inicio() {
  return (
    <>
      <Titulo
        titulo="Inicio"
        subtitulo="Toda la información del plantel San Luis Potosí en una sola base: alumnos, historial, docentes, grupos y reportes. Esta demo muestra lo que se puede hacer con ella."
      />
      <Suspense fallback={<Cargando />}>
        <Resumen />
      </Suspense>
      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Acceso href="/alumnos" titulo="Alumnos" texto="Busca por nombre o matrícula y consulta el kárdex completo." />
        <Acceso href="/reportes" titulo="Reportes" texto="15 reportes listos: becas, servicio social, titulación, SEP, docentes." />
        <Acceso href="/operaciones" titulo="Operaciones" texto="Captura calificaciones o bajas en modo prueba y mira la bitácora." />
        <Acceso href="/consola" titulo="Consola SQL" texto="Escribe tus propias consultas sobre la base, solo lectura." />
      </section>
    </>
  );
}

function Acceso({ href, titulo, texto }: { href: string; titulo: string; texto: string }) {
  return (
    <Link href={href} className="rounded-xl border border-border bg-card p-4 hover:border-brand">
      <p className="font-semibold text-brand">{titulo}</p>
      <p className="mt-1 text-sm text-muted">{texto}</p>
    </Link>
  );
}

type Totales = Record<string, string>;
type PorCarrera = { clave: string; nombre: string; alumnos: string; activos: string };

async function Resumen() {
  await connection();
  const [[t], carreras] = await Promise.all([
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
  ]);
  const n = (v: string) => Number(v).toLocaleString("es-MX");
  const max = Math.max(...carreras.map((c) => Number(c.alumnos)));
  const tarjetas: [string, string][] = [
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
      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold">Alumnos por carrera</h2>
        <p className="mb-4 text-xs text-muted">Barra completa = todos los alumnos registrados; tono oscuro = activos.</p>
        <div className="space-y-2">
          {carreras.map((c) => (
            <div key={c.clave} className="grid grid-cols-[3rem_1fr_4rem] items-center gap-3 text-sm md:grid-cols-[3rem_18rem_1fr_4rem]">
              <span className="font-mono text-muted">{c.clave}</span>
              <span className="hidden truncate md:block" title={c.nombre}>{c.nombre}</span>
              <div className="h-3 rounded bg-brand-soft">
                <div className="relative h-3 rounded bg-brand/30" style={{ width: `${(Number(c.alumnos) / max) * 100}%` }}>
                  <div className="absolute inset-y-0 left-0 rounded bg-brand" style={{ width: `${(Number(c.activos) / Number(c.alumnos)) * 100}%` }} />
                </div>
              </div>
              <span className="text-right tabular-nums">{n(c.alumnos)}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
