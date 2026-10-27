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
export type TipoColumna = "numero" | "texto" | "fecha" | "booleano" | "otro";
export type Resultado = { columnas: string[]; tipos: Record<string, TipoColumna>; filas: Fila[]; truncado?: boolean };

export const LIMITE_PANTALLA = 1000;
export const LIMITE_EXPORTAR = 50000;

// OID de tipos de Postgres -> tipo de columna para la interfaz.
const OID: Record<number, TipoColumna> = {
  20: "numero", 21: "numero", 23: "numero", 700: "numero", 701: "numero", 1700: "numero",
  16: "booleano", 1082: "fecha", 1114: "fecha", 1184: "fecha",
  25: "texto", 1043: "texto", 1042: "texto", 19: "texto",
};

function tiposDe(campos: { name: string; dataTypeID: number }[]): Record<string, TipoColumna> {
  return Object.fromEntries(campos.map((c) => [c.name, OID[c.dataTypeID] ?? "otro"]));
}

// Fechas como texto y numéricos como número, para mostrarlos y exportarlos igual en servidor y cliente.
function normalizar(filas: Fila[], tipos: Record<string, TipoColumna>): Fila[] {
  return filas.map((f) => {
    const o: Fila = {};
    for (const [k, v] of Object.entries(f)) {
      if (v instanceof Date) o[k] = v.toISOString().slice(0, 10);
      else if (tipos[k] === "numero" && typeof v === "string") o[k] = Number(v);
      else o[k] = v;
    }
    return o;
  });
}

/** Consulta parametrizada en una transacción de solo lectura (para mostrar en pantalla). */
export async function consultar(texto: string, params: unknown[] = []): Promise<Resultado> {
  const sql = neon(url());
  const [, r] = await sql.transaction(
    (tx) => [tx.query("SET LOCAL statement_timeout = '15s'"), tx.query(texto, params)],
    { readOnly: true, fullResults: true },
  );
  const tipos = tiposDe(r.fields);
  const filas = normalizar(r.rows as Fila[], tipos);
  return {
    columnas: r.fields.map((c) => c.name),
    tipos,
    filas: filas.slice(0, LIMITE_PANTALLA),
    truncado: filas.length > LIMITE_PANTALLA,
  };
}

/** Atajo para consultas internas que solo necesitan las filas. */
export async function filas<T = Fila>(texto: string, params: unknown[] = []): Promise<T[]> {
  return (await consultar(texto, params)).filas as T[];
}

/**
 * Consulta grande para exportar (hasta LIMITE_EXPORTAR filas). Usa una conexión por WebSocket,
 * sin el límite de tamaño de respuesta del HTTP, en una transacción READ ONLY.
 */
export async function consultarParaExportar(texto: string, params: unknown[] = []): Promise<Resultado> {
  const pool = new Pool({ connectionString: url() });
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN READ ONLY");
    await cliente.query("SET LOCAL statement_timeout = '45s'");
    // El límite va como parámetro: con al menos un parámetro la consulta usa el protocolo extendido,
    // que rechaza varias instrucciones en un solo envío (no se puede salir de la transacción READ ONLY).
    const r = await cliente.query(
      `SELECT * FROM (${texto}\n) AS exportacion LIMIT $${params.length + 1}`,
      [...params, LIMITE_EXPORTAR + 1],
    );
    const tipos = tiposDe(r.fields);
    const todas = normalizar(r.rows as Fila[], tipos);
    return {
      columnas: r.fields.map((c) => c.name),
      tipos,
      filas: todas.slice(0, LIMITE_EXPORTAR),
      truncado: todas.length > LIMITE_EXPORTAR,
    };
  } finally {
    await cliente.query("ROLLBACK").catch(() => undefined);
    cliente.release();
    await pool.end();
  }
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
    const q = async (texto: string, params: unknown[] = []) => {
      const r = await cliente.query(texto, params);
      return normalizar(r.rows as Fila[], tiposDe(r.fields));
    };
    return await trabajo(q);
  } finally {
    await cliente.query("ROLLBACK").catch(() => undefined);
    cliente.release();
    await pool.end();
  }
}
