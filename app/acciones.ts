"use server";
import { exigirSesion } from "@/lib/auth";
import { consultar, type Resultado } from "@/lib/db";
import { consultaAgrupada, consultaBase, type Agrupacion, type Fuente } from "@/lib/fuentes";

export type Respuesta = ({ ok: true } & Resultado) | { ok: false; error: string };

/** Agrupa todos los datos de la fuente en el servidor (no solo las filas que se ven). */
export async function agrupar(fuente: Fuente, agrupacion: Agrupacion): Promise<Respuesta> {
  await exigirSesion();
  try {
    const base = consultaBase(fuente);
    if (!base.envolvible) return { ok: false, error: "Solo se pueden agrupar consultas SELECT." };
    const { tipos } = await consultar(`SELECT * FROM (${base.texto}\n) AS base LIMIT 0`, base.params);
    const q = consultaAgrupada(base, tipos, agrupacion);
    return { ok: true, ...(await consultar(q.texto, q.params)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
