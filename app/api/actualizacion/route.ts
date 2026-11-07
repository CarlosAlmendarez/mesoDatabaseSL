import { gunzipSync } from "node:zlib";
import { exigirSesion } from "@/lib/auth";
import { ACTUALIZACION_HABILITADA } from "@/lib/config";
import { escribir } from "@/lib/db";

export const maxDuration = 60;

// POST /api/actualizacion?lote=<id>&tipo=expediente|historial|plan
// Cuerpo: JSON (arreglo de filas) comprimido con gzip por el navegador. Cada parte pesa menos de 4 MB
// (límite de Vercel); las filas se guardan en carga.stg_* hasta que se comparan.
export async function POST(request: Request) {
  try {
    await exigirSesion();
  } catch {
    return new Response("Sesión expirada", { status: 401 });
  }
  if (!ACTUALIZACION_HABILITADA) return new Response("La actualización está inhabilitada.", { status: 403 });

  const url = new URL(request.url);
  const lote = Number(url.searchParams.get("lote"));
  const tipo = url.searchParams.get("tipo");
  if (!Number.isInteger(lote) || lote <= 0 || !["expediente", "historial", "plan"].includes(tipo ?? "")) {
    return new Response("Pedido inválido", { status: 400 });
  }
  let filas: unknown;
  try {
    filas = JSON.parse(gunzipSync(Buffer.from(await request.arrayBuffer())).toString("utf8"));
  } catch {
    return new Response("Los datos no se pudieron leer", { status: 400 });
  }
  if (!Array.isArray(filas)) return new Response("Se esperaba una lista de filas", { status: 400 });

  try {
    const [r] = await escribir(`carga:${lote}`, (q) =>
      q("SELECT carga.fn_recibir($1, $2, $3::jsonb) AS n", [lote, tipo, JSON.stringify(filas)]),
    );
    return Response.json({ recibidas: r.n });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : String(e), { status: 400 });
  }
}
