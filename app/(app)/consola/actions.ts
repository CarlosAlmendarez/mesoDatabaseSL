"use server";
import { exigirSesion } from "@/lib/auth";
import { consultar, type Resultado } from "@/lib/db";

export type RespuestaConsola = ({ ok: true } & Resultado & { ms: number }) | { ok: false; error: string };

// Quita literales y comentarios para revisar que haya una sola instrucción.
function sinLiterales(t: string): string {
  return t
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, "''")
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""');
}

/** Consulta libre: una instrucción, transacción de solo lectura, 15 s y 1,000 filas como máximo. */
export async function ejecutarConsulta(texto: string): Promise<RespuestaConsola> {
  await exigirSesion();
  const sql = texto.trim().replace(/;+\s*$/, "");
  if (!sql) return { ok: false, error: "Escribe una consulta." };
  if (sql.length > 20000) return { ok: false, error: "La consulta es demasiado larga." };
  if (sinLiterales(sql).includes(";")) {
    return { ok: false, error: "Escribe una sola instrucción por consulta (sin ; en medio)." };
  }
  const inicio = Date.now();
  try {
    // Las consultas de lectura se envuelven para limitar filas; si no se puede, se ejecuta tal cual.
    const envolver = /^\s*(select|with|values|table)\b/i.test(sinLiterales(sql));
    let r: Resultado;
    try {
      r = envolver ? await consultar(`SELECT * FROM (${sql}\n) AS consulta LIMIT 1001`) : await consultar(sql);
    } catch (e) {
      if (!envolver) throw e;
      r = await consultar(sql);
    }
    return { ok: true, ...r, truncado: r.truncado || r.filas.length > 1000, filas: r.filas.slice(0, 1000), ms: Date.now() - inicio };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: /read-only transaction/i.test(m)
        ? `La consola es de solo lectura: la base rechazó el cambio (${m}). Para probar cambios usa Operaciones.`
        : m,
    };
  }
}
