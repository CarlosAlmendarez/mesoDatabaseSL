// De dónde salen los datos de una vista de resultados. El cliente solo manda esta descripción; el
// servidor vuelve a armar la consulta (nunca recibe SQL del cliente, salvo la consola, que es de solo
// lectura). Sobre la consulta base se arman la agrupación y la exportación.

import { armarLlamada, PROCEDIMIENTOS } from "./procedimientos";
import { esLectura, ident, validarSqlLibre } from "./sql";
import type { TipoColumna } from "./db";

export type Fuente =
  | { t: "reporte"; id: string; v: Record<string, string | undefined> }
  | { t: "sql"; q: string }
  | { t: "kardex"; cuenta: string }
  | { t: "promedios"; cuenta: string }
  | { t: "alumnos"; q: string; carrera: string; activo: string };

export type FnMetrica = "suma" | "promedio" | "minimo" | "maximo" | "distintos" | "pct_si";
export type Metrica = { fn: FnMetrica; col: string };
export type Agrupacion = { grupos: string[]; metricas: Metrica[] };

export const METRICAS: Record<FnMetrica, { etiqueta: string; tipos: TipoColumna[] }> = {
  suma: { etiqueta: "Suma", tipos: ["numero"] },
  promedio: { etiqueta: "Promedio", tipos: ["numero"] },
  minimo: { etiqueta: "Mínimo", tipos: ["numero", "fecha", "texto"] },
  maximo: { etiqueta: "Máximo", tipos: ["numero", "fecha", "texto"] },
  distintos: { etiqueta: "Valores distintos", tipos: ["numero", "texto", "fecha", "booleano"] },
  pct_si: { etiqueta: "% Sí", tipos: ["booleano"] },
};

export function nombreMetrica(m: Metrica): string {
  return `${m.fn}_${m.col}`;
}

/** Consulta base de la fuente: texto + parámetros. */
export function consultaBase(f: Fuente): { texto: string; params: unknown[]; envolvible: boolean } {
  switch (f.t) {
    case "reporte": {
      const p = PROCEDIMIENTOS.find((x) => x.id === f.id);
      if (!p) throw new Error("Reporte desconocido");
      return { ...armarLlamada(p, f.v), envolvible: true };
    }
    case "sql": {
      const q = validarSqlLibre(f.q);
      return { texto: q, params: [], envolvible: esLectura(q) };
    }
    case "kardex":
      return { texto: "SELECT * FROM sp_historial_academico($1)", params: [f.cuenta], envolvible: true };
    case "promedios":
      return { texto: "SELECT * FROM sp_promedio_alumno($1)", params: [f.cuenta], envolvible: true };
    case "alumnos":
      return {
        texto: "SELECT * FROM sp_buscar_alumnos(p_texto => $1::text, p_carrera => $2::text, p_activo => $3::boolean)",
        params: [f.q.trim() || null, f.carrera || null, f.activo === "" ? null : f.activo === "true"],
        envolvible: true,
      };
  }
}

const SQL_METRICA: Record<FnMetrica, (c: string) => string> = {
  suma: (c) => `sum(${c})`,
  promedio: (c) => `round(avg(${c})::numeric, 2)`,
  minimo: (c) => `min(${c})`,
  maximo: (c) => `max(${c})`,
  distintos: (c) => `count(DISTINCT ${c})`,
  pct_si: (c) => `round(100.0 * avg((${c})::int), 1)`,
};

/**
 * Agrupa la consulta base en el servidor (sobre todas sus filas, no solo las que se ven).
 * `tipos` son los tipos reales de las columnas de la base, para validar nombres y funciones.
 */
export function consultaAgrupada(
  base: { texto: string; params: unknown[] },
  tipos: Record<string, TipoColumna>,
  a: Agrupacion,
): { texto: string; params: unknown[] } {
  if (a.grupos.length === 0) throw new Error("Elige al menos una columna para agrupar.");
  for (const g of a.grupos) if (!(g in tipos)) throw new Error(`No existe la columna «${g}»`);
  for (const m of a.metricas) {
    if (!(m.col in tipos)) throw new Error(`No existe la columna «${m.col}»`);
    if (!METRICAS[m.fn]?.tipos.includes(tipos[m.col])) throw new Error(`«${METRICAS[m.fn]?.etiqueta}» no aplica a «${m.col}»`);
  }
  const g = a.grupos.map(ident);
  const metricas = a.metricas.map((m) => `${SQL_METRICA[m.fn](ident(m.col))} AS ${ident(nombreMetrica(m))}`);
  const primero = a.grupos[0];
  const orden =
    primero === "ciclo" ? `fn_ciclo_orden(${g[0]})` : ["numero", "fecha"].includes(tipos[primero]) ? g[0] : `count(*) DESC`;
  return {
    texto: `SELECT ${g.join(", ")}, count(*) AS registros${metricas.length ? ", " + metricas.join(", ") : ""}
FROM (${base.texto}
) AS base
GROUP BY ${g.join(", ")}
ORDER BY ${orden}, ${g.join(", ")}`,
    params: base.params,
  };
}

// Codificación de la fuente en la URL de exportación (base64url de UTF-8; sirve en navegador y servidor).
export function codificar(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decodificar<T>(s: string): T {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))) as T;
}
