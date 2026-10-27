import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { consultar, filas } from "@/lib/db";
import { Tabla } from "@/components/Tabla";
import { Cargando, Sql } from "@/components/ui";

type Ficha = Record<string, string | boolean | null>;

export default function Alumno({ params }: { params: Promise<{ cuenta: string }> }) {
  return (
    <>
      <Link href="/alumnos" className="text-sm text-brand hover:underline">← Volver a la búsqueda</Link>
      <Suspense fallback={<div className="mt-4"><Cargando /></div>}>
        <Detalle params={params} />
      </Suspense>
    </>
  );
}

async function Detalle({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const [f] = await filas<Ficha>(
    `SELECT a.numerocuenta, fn_nombre_completo(a.nombre, a.apellido_1, a.apellido_2) AS alumno, a.curp, a.sexo,
            a.fecha_nacimiento, e.edad, c.clave || ' · ' || c.nombre AS carrera, c.rvoe, a.fecha_inscripcion,
            a.generacion, a.semestre_actual, a.grupo, t.nombre AS turno, a.activo, a.titulado, a.correo, a.celular
     FROM alumnos a
     LEFT JOIN carreras c ON c.id = a.carrera_id
     LEFT JOIN cat_turno t ON t.id = a.turno_id
     LEFT JOIN v_alumnos_edad e ON e.alumno_id = a.id
     WHERE a.numerocuenta = $1`,
    [cuenta],
  );
  if (!f) notFound();

  const [promedios, kardex] = await Promise.all([
    consultar("SELECT * FROM sp_promedio_alumno($1)", [cuenta]),
    consultar("SELECT * FROM sp_historial_academico($1)", [cuenta]),
  ]);
  const general = promedios.filas.find((p) => p.ciclo === "GENERAL");
  const acreditadas = kardex.filas.filter((k) => k.estatus === "ACREDITADA").length;

  const datos: [string, unknown][] = [
    ["Matrícula", f.numerocuenta], ["Carrera", f.carrera], ["RVOE", f.rvoe], ["CURP", f.curp],
    ["Sexo", f.sexo], ["Nacimiento", f.fecha_nacimiento], ["Edad", f.edad], ["Ingreso", f.fecha_inscripcion],
    ["Generación", f.generacion], ["Semestre", f.semestre_actual], ["Grupo y turno", [f.grupo, f.turno].filter(Boolean).join(" · ")],
    ["Correo", f.correo], ["Celular", f.celular],
  ];

  return (
    <div className="mt-4 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{String(f.alumno ?? "")}</h1>
          <p className="text-sm text-muted">{String(f.carrera ?? "")}</p>
        </div>
        <div className="flex gap-2 text-xs font-medium">
          <span className={`rounded-full px-3 py-1 ${f.activo ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>
            {f.activo ? "Activo" : "Inactivo"}
          </span>
          {f.titulado && <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">Titulado</span>}
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <Dato titulo="Promedio general" valor={general ? String(general.promedio) : "—"} />
        <Dato titulo="Materias acreditadas" valor={`${acreditadas} de ${kardex.filas.length}`} />
        <Dato titulo="Ciclos cursados" valor={String(promedios.filas.filter((p) => p.ciclo !== "GENERAL").length)} />
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 font-semibold">Ficha</h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {datos.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="w-28 shrink-0 text-muted">{k}</dt>
              <dd className="min-w-0 break-words">{v === null || v === undefined || v === "" ? "—" : String(v)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Promedio por ciclo</h2>
        <Tabla columnas={promedios.columnas} filas={promedios.filas} archivo={`promedios_${cuenta}`} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Kárdex</h2>
        <Tabla columnas={kardex.columnas} filas={kardex.filas} archivo={`kardex_${cuenta}`} enlaceMatricula={false} />
        <Sql>{`SELECT * FROM sp_historial_academico('${cuenta}');`}</Sql>
      </section>
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
    </div>
  );
}
