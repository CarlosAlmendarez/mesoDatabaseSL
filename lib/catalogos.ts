import "server-only";
import { filas } from "./db";

export type Opcion = { valor: string; etiqueta: string };

export async function carreras(): Promise<Opcion[]> {
  const r = await filas<{ clave: string; nombre: string }>(
    "SELECT clave, nombre FROM carreras ORDER BY clave",
  );
  return r.map((c) => ({ valor: c.clave, etiqueta: `${c.clave} · ${c.nombre}` }));
}

export async function ciclos(): Promise<Opcion[]> {
  const r = await filas<{ clave: string }>(
    "SELECT clave FROM ciclos_escolares ORDER BY fn_ciclo_orden(clave) DESC",
  );
  return r.map((c) => ({ valor: c.clave, etiqueta: c.clave }));
}
