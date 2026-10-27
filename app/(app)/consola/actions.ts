"use server";
import { exigirSesion } from "@/lib/auth";
import { consultar, LIMITE_PANTALLA, type Resultado } from "@/lib/db";
import { esLectura, validarSqlLibre } from "@/lib/sql";

export type RespuestaConsola = ({ ok: true } & Resultado & { ms: number }) | { ok: false; error: string };

/** Consulta libre: una instrucción, transacción de solo lectura, 15 s y 1,000 filas en pantalla. */
export async function ejecutarConsulta(texto: string): Promise<RespuestaConsola> {
  await exigirSesion();
  const inicio = Date.now();
  try {
    const sql = validarSqlLibre(texto);
    // Las consultas de lectura se envuelven para limitar filas; si no se puede, se ejecutan tal cual.
    let r: Resultado;
    if (esLectura(sql)) {
      try {
        r = await consultar(`SELECT * FROM (${sql}\n) AS consulta LIMIT ${LIMITE_PANTALLA + 1}`);
      } catch {
        r = await consultar(sql);
      }
    } else {
      r = await consultar(sql);
    }
    return { ok: true, ...r, ms: Date.now() - inicio };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: /read-only transaction/i.test(m)
        ? `La consola es de solo lectura: la base rechazó el cambio (${m}).`
        : m,
    };
  }
}
