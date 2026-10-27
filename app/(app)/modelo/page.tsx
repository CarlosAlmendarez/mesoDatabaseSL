import { Suspense } from "react";
import { connection } from "next/server";
import { filas } from "@/lib/db";
import { Cargando, Titulo } from "@/components/ui";
import { Diagrama, type ColumnaVivo, type FuenteVivo, type TablaVivo } from "./Diagrama";

export default function PaginaModelo() {
  return (
    <>
      <Titulo
        titulo="Modelo de datos"
        subtitulo="Cómo está organizada la nueva base: cada caja es una tabla y cada línea una relación. Toca una tabla para ver qué guarda, por qué existe, de dónde salieron sus datos y sus registros."
      />
      <Suspense fallback={<Cargando texto="Leyendo la estructura de la base…" />}>
        <Modelo />
      </Suspense>
    </>
  );
}

async function Modelo() {
  await connection();
  const [columnas, conteos, fuentes] = await Promise.all([
    // Columnas con su llave primaria y la tabla a la que apuntan (si son llave foránea).
    filas<ColumnaVivo & { tabla: string }>(`
      SELECT cl.relname AS tabla, a.attname AS nombre, format_type(a.atttypid, a.atttypmod) AS tipo,
             NOT a.attnotnull AS nulo, col_description(cl.oid, a.attnum) AS comentario,
             EXISTS (SELECT 1 FROM pg_constraint k
                     WHERE k.conrelid = cl.oid AND k.contype = 'p' AND a.attnum = ANY (k.conkey)) AS pk,
             (SELECT f.relname FROM pg_constraint k JOIN pg_class f ON f.oid = k.confrelid
              WHERE k.conrelid = cl.oid AND k.contype = 'f' AND a.attnum = ANY (k.conkey) LIMIT 1) AS ref
      FROM pg_class cl
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attnum > 0 AND NOT a.attisdropped
      WHERE n.nspname = 'public' AND cl.relkind = 'r' AND cl.relname <> 'schema_migrations'
      ORDER BY cl.relname, a.attnum`),
    // Conteo exacto de registros por tabla.
    filas<{ tabla: string; registros: number; comentario: string | null }>(`
      SELECT c.relname AS tabla, obj_description(c.oid) AS comentario,
             (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM public.%I', c.relname), false, true, '')))[1]::text::bigint AS registros
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'schema_migrations'`),
    // Archivos del sistema anterior y a qué tablas fueron (registro de la migración).
    filas<FuenteVivo & { entidad_destino: string | null }>(`
      SELECT archivo, entidad_destino, estado, motivo, filas_origen, filas_cargadas
      FROM migracion.fuente ORDER BY estado = 'migrado' DESC, estado, archivo`),
  ]);

  const tablas: TablaVivo[] = conteos.map((t) => ({
    nombre: t.tabla,
    registros: Number(t.registros),
    comentario: t.comentario,
    columnas: columnas.filter((c) => c.tabla === t.tabla),
  }));
  const fuentesVivo: FuenteVivo[] = fuentes.map(({ entidad_destino, ...f }) => ({
    ...f,
    filas_origen: f.filas_origen === null ? null : Number(f.filas_origen),
    filas_cargadas: f.filas_cargadas === null ? null : Number(f.filas_cargadas),
    tablas: (entidad_destino ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  }));

  return <Diagrama tablas={tablas} fuentes={fuentesVivo} />;
}
