import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ACTUALIZACION_HABILITADA } from "@/lib/config";
import { filas } from "@/lib/db";
import { Aviso, Cargando, Titulo } from "@/components/ui";
import { Cargador } from "./Cargador";
import { ESTADOS, totales } from "./comun";

export const maxDuration = 60;

export default function Actualizacion() {
  return (
    <>
      <Titulo
        titulo="Actualizar desde el sistema anterior"
        subtitulo="Mientras se siga capturando en el sistema anterior, sube aquí sus archivos y la base agrega solo lo nuevo: alumnos de nuevo ingreso, materias cursadas, calificaciones, bajas y los datos del expediente que cambiaron."
      />
      {!ACTUALIZACION_HABILITADA ? (
        <Aviso>Esta sección está inhabilitada por ahora.</Aviso>
      ) : (
        <div className="space-y-6">
          <Aviso>
            <strong>No es una migración desde cero:</strong> nada se borra, un dato vacío en el archivo nunca vacía uno de la
            base, no se reactivan alumnos ni se cambian de carrera solos, y lo que se haya corregido en el sistema nuevo se
            respeta. Antes de aplicar verás todos los cambios; después, cada cambio queda en la bitácora y la actualización
            completa se puede deshacer.
          </Aviso>
          <Cargador />
          <Suspense fallback={<Cargando />}>
            <Historial />
          </Suspense>
        </div>
      )}
    </>
  );
}

async function Historial() {
  await connection();
  const lotes = await filas<{ id: number; fecha: string; estado: string; archivos: number; resumen: unknown }>(
    `SELECT id, to_char(creado_at AT TIME ZONE 'America/Mexico_City', 'DD/MM/YYYY HH24:MI') AS fecha, estado,
            jsonb_array_length(archivos) AS archivos, resumen
     FROM carga.lote ORDER BY id DESC LIMIT 30`,
  );
  if (lotes.length === 0) return null;
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-semibold">Actualizaciones anteriores</h2>
      <table className="mt-3 w-full text-sm">
        <thead className="text-left text-xs text-muted">
          <tr><th className="py-1">Lote</th><th>Fecha</th><th>Estado</th><th className="text-right">Archivos</th><th className="text-right">Nuevos</th><th className="text-right">Cambios</th><th className="text-right">Por revisar</th></tr>
        </thead>
        <tbody>
          {lotes.map((l) => {
            const t = totales(l.resumen);
            return (
              <tr key={l.id} className="border-t border-border">
                <td className="py-1.5"><Link href={`/actualizacion/${l.id}`} className="text-brand hover:underline">#{l.id}</Link></td>
                <td>{l.fecha}</td>
                <td>{ESTADOS[l.estado] ?? l.estado}</td>
                <td className="text-right tabular-nums">{l.archivos}</td>
                <td className="text-right tabular-nums">{t.nuevo.toLocaleString("es-MX")}</td>
                <td className="text-right tabular-nums">{t.cambio.toLocaleString("es-MX")}</td>
                <td className="text-right tabular-nums">{(t.revisar + t.conflicto).toLocaleString("es-MX")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
