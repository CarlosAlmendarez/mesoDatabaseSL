import "server-only";
import { filas } from "./db";
import { etiquetaCiclo } from "./etiquetas";

export type Opcion = { valor: string; etiqueta: string; detalle?: string; grupo?: string };

const corto = (nombre: string) =>
  nombre.replace(/^LICENCIATURA EN /i, "").toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());

/** Carreras agrupadas por tipo de plan, con RVOE y número de alumnos. */
export async function carreras(): Promise<Opcion[]> {
  const r = await filas<{ clave: string; nombre: string; rvoe: string | null; version_plan: string | null; alumnos: number }>(`
    SELECT c.clave, c.nombre, c.rvoe, c.version_plan, count(a.id) AS alumnos
    FROM carreras c LEFT JOIN alumnos a ON a.carrera_id = c.id
    GROUP BY c.id ORDER BY (c.version_plan = 'NUEVO') DESC, c.clave`);
  return r.map((c) => ({
    valor: c.clave,
    etiqueta: `${c.clave} · ${corto(c.nombre)}`,
    detalle: [c.rvoe && `RVOE ${c.rvoe}`, `${Number(c.alumnos).toLocaleString("es-MX")} alumnos`].filter(Boolean).join(" · "),
    grupo: c.version_plan === "NUEVO" ? "Planes nuevos" : c.version_plan === "VIEJO" ? "Planes anteriores" : "Sin plan definido",
  }));
}

/** Ciclos del más reciente al más antiguo, con su periodo, agrupados por década. */
export async function ciclos(): Promise<Opcion[]> {
  const r = await filas<{ clave: string; orden: number }>(
    "SELECT clave, fn_ciclo_orden(clave) AS orden FROM ciclos_escolares ORDER BY fn_ciclo_orden(clave) DESC",
  );
  return r.map((c) => {
    const anio = Math.floor(Number(c.orden) / 10);
    const decada = Math.floor(anio / 10) * 10;
    return { valor: c.clave, etiqueta: etiquetaCiclo(c.clave), grupo: anio < 2001 ? "Antes de 2001 (por clasificar)" : `${decada}–${decada + 9}` };
  });
}
