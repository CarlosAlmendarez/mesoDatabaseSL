"use server";
import { exigirSesion } from "@/lib/auth";
import { consultar, filas, LIMITE_PANTALLA, type Resultado } from "@/lib/db";
import { ident } from "@/lib/sql";

export type RespuestaMuestra = ({ ok: true; sql: string } & Resultado) | { ok: false; error: string };

/** Filas de una tabla del modelo (solo tablas reales del esquema público; solo lectura). */
export async function verDatos(tabla: string): Promise<RespuestaMuestra> {
  await exigirSesion();
  try {
    const existe = await filas(
      "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = $1 AND tablename <> 'schema_migrations'",
      [tabla],
    );
    if (existe.length === 0) return { ok: false, error: `No existe la tabla «${tabla}».` };
    const sql = `SELECT * FROM ${ident(tabla)} ORDER BY 1`;
    const r = await consultar(`SELECT * FROM (${sql}\n) AS t LIMIT ${LIMITE_PANTALLA + 1}`);
    return { ok: true, sql, ...r };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
