import { Suspense } from "react";
import { connection } from "next/server";
import { OPERACIONES_HABILITADAS } from "@/lib/config";
import { filas } from "@/lib/db";
import { Aviso, Cargando, Titulo } from "@/components/ui";
import { Simulador } from "./Simulador";

export default function Operaciones() {
  if (!OPERACIONES_HABILITADAS) {
    return (
      <>
        <Titulo titulo="Operaciones" />
        <Aviso>
          Esta sección está inhabilitada por ahora: la demo es solo de consulta y exportación. Aquí se podrán capturar
          calificaciones, bajas y reingresos con las reglas del reglamento y la bitácora de cambios.
        </Aviso>
      </>
    );
  }
  return (
    <>
      <Titulo
        titulo="Operaciones en modo prueba"
        subtitulo="Captura una calificación, corrige una final, da de baja una materia o reactiva a un alumno. La base aplica las reglas del reglamento y registra todo en la bitácora."
      />
      <div className="mb-5">
        <Aviso>
          Modo prueba: cada operación se ejecuta de verdad dentro de una transacción y al final se deshace (ROLLBACK).
          Verás el antes, el después y lo que quedó en la bitácora, pero la base no cambia.
        </Aviso>
      </div>
      <Suspense fallback={<Cargando />}>
        <Cargador />
      </Suspense>
    </>
  );
}

async function Cargador() {
  await connection();
  const tipos = await filas<{ clave: string; nombre: string; requiere_autorizacion: boolean }>(
    "SELECT clave, nombre, requiere_autorizacion FROM cat_tipo_intento WHERE activo ORDER BY orden",
  );
  return <Simulador tipos={tipos} />;
}
