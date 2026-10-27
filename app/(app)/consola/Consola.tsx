"use client";
import { useState, useTransition } from "react";
import { Resultado } from "@/components/Resultado";
import { Aviso } from "@/components/ui";
import { ejecutarConsulta, type RespuestaConsola } from "./actions";
import type { Objeto } from "./page";

const EJEMPLOS: { titulo: string; sql: string }[] = [
  {
    titulo: "Alumnos activos por carrera",
    sql: `SELECT c.clave, c.nombre, count(*) AS alumnos
FROM alumnos a JOIN carreras c ON c.id = a.carrera_id
WHERE a.activo
GROUP BY c.clave, c.nombre
ORDER BY alumnos DESC`,
  },
  {
    titulo: "Materias con más reprobados en 24-1",
    sql: `SELECT m.clave, m.nombre AS materia, count(*) FILTER (WHERE NOT i.aprobada) AS reprobados, count(*) AS inscritos,
       round(avg(i.calificacion_final), 2) AS promedio
FROM inscripcion_materia i
JOIN materias m ON m.id = i.materia_id
JOIN ciclos_escolares c ON c.id = i.ciclo_id
WHERE c.clave = '24-1' AND i.calificacion_final IS NOT NULL
GROUP BY m.clave, m.nombre
ORDER BY reprobados DESC
LIMIT 20`,
  },
  {
    titulo: "Promedio por generación",
    sql: `SELECT a.generacion, count(DISTINCT a.id) AS alumnos, round(avg(i.calificacion_final), 2) AS promedio
FROM alumnos a JOIN inscripcion_materia i ON i.alumno_id = a.id
WHERE i.calificacion_final IS NOT NULL AND a.generacion IS NOT NULL
GROUP BY a.generacion
ORDER BY a.generacion`,
  },
  {
    titulo: "Hombres y mujeres por carrera",
    sql: `SELECT c.clave AS carrera, coalesce(a.sexo, 'sin dato') AS sexo, count(*) AS alumnos
FROM alumnos a JOIN carreras c ON c.id = a.carrera_id
GROUP BY 1, 2
ORDER BY 1, 2`,
  },
  {
    titulo: "Edad de los alumnos activos",
    sql: `SELECT e.edad, count(*) AS alumnos
FROM alumnos a JOIN v_alumnos_edad e ON e.alumno_id = a.id
WHERE a.activo AND e.edad BETWEEN 15 AND 70
GROUP BY e.edad
ORDER BY e.edad`,
  },
  { titulo: "Procedimiento: alumnos en riesgo de Psicología", sql: "SELECT * FROM sp_alumnos_en_riesgo('09')" },
  { titulo: "Procedimiento: kárdex de un alumno", sql: "SELECT * FROM sp_historial_academico('21102010')" },
  { titulo: "Función: redondeo de la calificación final", sql: "SELECT x AS promedio, fn_calificacion_final(x) AS final\nFROM unnest(ARRAY[9.5, 9.4, 6.5, 5.99, 3.5]) AS x" },
  { titulo: "La base rechaza cambios (solo lectura)", sql: "UPDATE alumnos SET activo = false WHERE numerocuenta = '21102010'" },
];

export function Consola({ objetos }: { objetos: Objeto[] }) {
  const [sql, setSql] = useState(EJEMPLOS[0].sql);
  const [r, setR] = useState<{ sql: string; resp: RespuestaConsola } | null>(null);
  const [cargando, iniciar] = useTransition();
  const [buscar, setBuscar] = useState("");

  function ejecutar() {
    const texto = sql;
    iniciar(async () => setR({ sql: texto, resp: await ejecutarConsulta(texto) }));
  }

  const lista = objetos.filter((o) => !buscar || `${o.nombre} ${o.detalle}`.toLowerCase().includes(buscar.toLowerCase()));

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
      <div className="min-w-0 space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Ejemplos (clic para cargarlos)</p>
          <div className="flex flex-wrap gap-2">
            {EJEMPLOS.map((e) => (
              <button key={e.titulo} onClick={() => { setSql(e.sql); setR(null); }}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs hover:border-brand">
                {e.titulo}
              </button>
            ))}
          </div>
        </div>
        <textarea value={sql} onChange={(e) => setSql(e.target.value)}
          onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") ejecutar(); }}
          spellCheck={false} rows={9}
          className="w-full rounded-lg border border-border bg-[#16202c] p-4 font-mono text-sm text-[#d7e3f0] outline-none focus:border-brand" />
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={ejecutar} disabled={cargando} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {cargando ? "Ejecutando…" : "Ejecutar"}
          </button>
          <span className="text-xs text-muted">Ctrl + Enter · solo lectura · máximo 15 segundos · 1,000 filas en pantalla, hasta 50,000 al exportar</span>
        </div>
        {r && !r.resp.ok && <Aviso tipo="error">{r.resp.error}</Aviso>}
        {r && r.resp.ok && (
          <>
            <p className="text-xs text-muted">Respondió en {r.resp.ms} ms.</p>
            <Resultado key={r.sql} fuente={{ t: "sql", q: r.sql }} inicial={r.resp} titulo="Consulta" filtros={[["Consulta", r.sql]]} />
          </>
        )}
      </div>
      <aside className="space-y-2">
        <p className="text-sm font-semibold">Tablas y funciones</p>
        <p className="text-xs text-muted">Clic en un nombre para ver sus columnas o parámetros.</p>
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar…"
          className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm" />
        <div className="max-h-[70vh] space-y-1 overflow-auto rounded-lg border border-border bg-card p-2">
          {lista.map((o) => (
            <details key={`${o.tipo}-${o.nombre}`} className="rounded px-2 py-1 text-xs">
              <summary className="cursor-pointer font-mono">
                <span className={o.tipo === "tabla" ? "text-brand" : "text-[#b7791f]"}>{o.nombre}</span>
                <span className="ml-1 text-muted">({o.tipo})</span>
              </summary>
              <p className="mt-1 break-words text-muted">{o.detalle || "(sin parámetros)"}</p>
            </details>
          ))}
        </div>
      </aside>
    </div>
  );
}
