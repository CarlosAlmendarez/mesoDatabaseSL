import { Suspense } from "react";
import { connection } from "next/server";
import { filas } from "@/lib/db";
import { Cargando, Titulo } from "@/components/ui";
import { Consola } from "./Consola";

export default function PaginaConsola() {
  return (
    <>
      <Titulo
        titulo="Consola SQL"
        subtitulo="Escribe cualquier consulta sobre la base o llama un procedimiento. Es de solo lectura: la base rechaza cualquier cambio."
      />
      <Suspense fallback={<Cargando />}>
        <Esquema />
      </Suspense>
    </>
  );
}

export type Objeto = { nombre: string; tipo: string; detalle: string };

async function Esquema() {
  await connection();
  const objetos = await filas<Objeto>(`
    SELECT table_name AS nombre, 'tabla' AS tipo, string_agg(column_name, ', ' ORDER BY ordinal_position) AS detalle
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name <> 'schema_migrations'
    GROUP BY table_name
    UNION ALL
    SELECT p.proname, 'función', pg_get_function_arguments(p.oid)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND (p.proname LIKE 'sp\\_%' OR p.proname LIKE 'fn\\_%')
    ORDER BY 2 DESC, 1`);
  return <Consola objetos={objetos} />;
}
