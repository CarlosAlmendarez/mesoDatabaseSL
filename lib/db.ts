import "server-only";
import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

// Acceso a la base de UNIMES en Neon. La URL vive solo en variables de entorno del servidor.
neonConfig.webSocketConstructor = ws;

function url(): string {
  const u = process.env.DATABASE_URL;
  if (!u) throw new Error("Falta la variable de entorno DATABASE_URL");
  return u;
}

export type Fila = Record<string, unknown>;
export type Resultado = { columnas: string[]; filas: Fila[]; truncado?: boolean };

const LIMITE_FILAS = 1000;

// Las fechas llegan como Date: se pasan a texto para mostrarlas igual en servidor y cliente.
function normalizar(filas: Fila[]): Fila[] {
  return filas.map((f) => {
    const o: Fila = {};
    for (const [k, v] of Object.entries(f)) {
      o[k] = v instanceof Date ? v.toISOString().slice(0, 10) : v;
    }
    return o;
  });
}

/** Consulta parametrizada de solo lectura (texto controlado por la app). */
export async function consultar(texto: string, params: unknown[] = []): Promise<Resultado> {
  const sql = neon(url());
  const [, r] = await sql.transaction(
    (tx) => [tx.query("SET LOCAL statement_timeout = '15s'"), tx.query(texto, params)],
    { readOnly: true, fullResults: true },
  );
  const filas = normalizar(r.rows as Fila[]);
  return {
    columnas: r.fields.map((c) => c.name),
    filas: filas.slice(0, LIMITE_FILAS),
    truncado: filas.length > LIMITE_FILAS,
  };
}

/** Atajo para consultas internas que solo necesitan las filas. */
export async function filas<T = Fila>(texto: string, params: unknown[] = []): Promise<T[]> {
  return (await consultar(texto, params)).filas as T[];
}

/**
 * Ejecuta una operación en modo prueba: corre dentro de una transacción, junta lo que cambió
 * (incluida la bitácora) y siempre hace ROLLBACK. La base queda igual.
 */
export async function simular<T>(
  trabajo: (q: (texto: string, params?: unknown[]) => Promise<Fila[]>) => Promise<T>,
): Promise<T> {
  const pool = new Pool({ connectionString: url() });
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("SET LOCAL statement_timeout = '15s'");
    await cliente.query("SELECT set_config('app.usuario', 'demo-web', true)");
    const q = async (texto: string, params: unknown[] = []) =>
      normalizar((await cliente.query(texto, params)).rows as Fila[]);
    return await trabajo(q);
  } finally {
    await cliente.query("ROLLBACK").catch(() => undefined);
    cliente.release();
    await pool.end();
  }
}
