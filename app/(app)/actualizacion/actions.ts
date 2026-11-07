"use server";
import { exigirSesion } from "@/lib/auth";
import { ACTUALIZACION_HABILITADA } from "@/lib/config";
import { escribir } from "@/lib/db";

// Acciones del módulo «Actualizar datos». Toda la lógica de comparación y escritura está en la base
// (migración 0019, esquema carga); aquí solo se llama en el orden correcto.

export type ArchivoLote = { ruta: string; origen_tipo: string; carrera_codigo: string; alumnos: number; historial: number; plan: number };
export type Resumen = { por_entidad?: Record<string, Record<string, number>>; archivos?: number; deshecho?: Record<string, number> };

async function exigir() {
  await exigirSesion();
  if (!ACTUALIZACION_HABILITADA) throw new Error("La actualización está inhabilitada en esta demo.");
}

const USUARIO = "demo-web";

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function crearLote(archivos: ArchivoLote[]): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  try {
    await exigir();
    const [r] = await escribir(USUARIO, (q) =>
      q("INSERT INTO carga.lote (usuario, archivos) VALUES ($1, $2::jsonb) RETURNING id", [USUARIO, JSON.stringify(archivos)]),
    );
    return { ok: true, id: Number(r.id) };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}

/** Carreras (grupos) del lote, en el orden en que se procesan. */
export async function carrerasLote(lote: number): Promise<{ ok: true; carreras: string[] } | { ok: false; error: string }> {
  try {
    await exigir();
    const filas = await escribir(USUARIO, (q) => q("SELECT c FROM carga.fn_carreras_lote($1) c", [lote]));
    return { ok: true, carreras: filas.map((f) => String(f.c)) };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}

/** Compara (aplicar = false) o aplica una carrera del lote. Cada carrera es una transacción. */
export async function procesarCarrera(
  lote: number, aplicar: boolean, carrera: string,
): Promise<{ ok: true; cambios: number } | { ok: false; error: string }> {
  try {
    await exigir();
    const [r] = await escribir(`carga:${lote}`, (q) =>
      q("SELECT carga.sp_procesar($1, $2, $3) AS n", [lote, aplicar, carrera]),
    );
    return { ok: true, cambios: Number(r.n) };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}

export async function finalizarLote(lote: number, aplicar: boolean): Promise<{ ok: true; resumen: Resumen } | { ok: false; error: string }> {
  try {
    await exigir();
    const [r] = await escribir(`carga:${lote}`, (q) => q("SELECT carga.sp_finalizar($1, $2) AS r", [lote, aplicar]));
    return { ok: true, resumen: r.r as Resumen };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}

export async function descartarLote(lote: number): Promise<{ ok: boolean; error?: string }> {
  try {
    await exigir();
    await escribir(USUARIO, (q) => q("SELECT carga.sp_descartar($1)", [lote]));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}

export async function deshacerLote(lote: number): Promise<{ ok: true; resultado: Record<string, number> } | { ok: false; error: string }> {
  try {
    await exigir();
    const [r] = await escribir(`deshacer:${lote}`, (q) => q("SELECT carga.sp_deshacer($1) AS r", [lote]));
    return { ok: true, resultado: r.r as Record<string, number> };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}
