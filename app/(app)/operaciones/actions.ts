"use server";
import { exigirSesion } from "@/lib/auth";
import { OPERACIONES_HABILITADAS } from "@/lib/config";
import { consultar, simular, type Fila, type Resultado } from "@/lib/db";

export type Inscripcion = {
  id: string;
  ciclo: string | null;
  clave: string;
  materia: string;
  calificacion_final: string | null;
  aprobada: boolean | null;
  estatus: string;
};

function exigirHabilitadas() {
  if (!OPERACIONES_HABILITADAS) throw new Error("Las operaciones están inhabilitadas en esta demo.");
}

export async function inscripcionesDe(cuenta: string): Promise<{ alumno: string | null; filas: Inscripcion[] }> {
  await exigirSesion();
  exigirHabilitadas();
  const [a] = (
    await consultar(
      "SELECT fn_nombre_completo(nombre, apellido_1, apellido_2) AS alumno, activo FROM alumnos WHERE numerocuenta = $1",
      [cuenta.trim()],
    )
  ).filas;
  if (!a) return { alumno: null, filas: [] };
  const r = await consultar(
    `SELECT i.id::text, c.clave AS ciclo, m.clave, m.nombre AS materia, i.calificacion_final, i.aprobada,
            CASE WHEN i.fecha_baja IS NOT NULL THEN 'BAJA' WHEN i.aprobada THEN 'ACREDITADA'
                 WHEN i.calificacion_final IS NULL THEN 'EN CURSO' ELSE 'NO ACREDITADA' END AS estatus
     FROM inscripcion_materia i
     JOIN alumnos a ON a.id = i.alumno_id
     JOIN materias m ON m.id = i.materia_id
     LEFT JOIN ciclos_escolares c ON c.id = i.ciclo_id
     WHERE a.numerocuenta = $1
     ORDER BY fn_ciclo_orden(c.clave) DESC NULLS LAST, m.clave`,
    [cuenta.trim()],
  );
  return { alumno: `${a.alumno}${a.activo ? "" : " (inactivo)"}`, filas: r.filas as Inscripcion[] };
}

export type Operacion =
  | { tipo: "registrar_intento"; inscripcion: string; tipoIntento: string; calificacion: string; autorizadoPor: string; motivo: string }
  | { tipo: "corregir_final"; inscripcion: string; calificacion: string; autorizadoPor: string; motivo: string }
  | { tipo: "baja_materia"; inscripcion: string; motivo: string }
  | { tipo: "reingreso"; cuenta: string; motivo: string };

export type ResultadoSimulacion = {
  ok: boolean;
  mensaje: string;
  llamada: string;
  devolvio?: string;
  antes?: Resultado;
  despues?: Resultado;
  bitacora?: Resultado;
};

const nulo = (s: string) => (s.trim() === "" ? null : s.trim());

function llamadaDe(op: Operacion): { texto: string; params: unknown[]; legible: string } {
  const q = (v: unknown) => (v === null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
  switch (op.tipo) {
    case "registrar_intento": {
      const params = [op.inscripcion, op.tipoIntento, op.calificacion, nulo(op.autorizadoPor), nulo(op.motivo)];
      return {
        texto: "SELECT sp_registrar_intento($1::bigint, $2, $3::numeric, p_autorizado_por => $4, p_motivo => $5) AS r",
        params,
        legible: `SELECT sp_registrar_intento(${op.inscripcion}, ${q(op.tipoIntento)}, ${op.calificacion}, p_autorizado_por => ${q(params[3])}, p_motivo => ${q(params[4])});`,
      };
    }
    case "corregir_final": {
      const params = [op.inscripcion, op.calificacion, nulo(op.motivo), nulo(op.autorizadoPor)];
      return {
        texto: "SELECT sp_corregir_calificacion_final($1::bigint, $2::numeric, $3, $4) AS r",
        params,
        legible: `SELECT sp_corregir_calificacion_final(${op.inscripcion}, ${op.calificacion}, ${q(params[2])}, ${q(params[3])});`,
      };
    }
    case "baja_materia": {
      const params = [op.inscripcion, nulo(op.motivo)];
      return {
        texto: "SELECT sp_baja_materia($1::bigint, $2) AS r",
        params,
        legible: `SELECT sp_baja_materia(${op.inscripcion}, ${q(params[1])});`,
      };
    }
    case "reingreso": {
      const params = [op.cuenta.trim(), nulo(op.motivo)];
      return {
        texto: "SELECT sp_reingreso($1, $2) AS r",
        params,
        legible: `SELECT sp_reingreso(${q(params[0])}, ${q(params[1])});`,
      };
    }
  }
}

const COLUMNAS_INSCRIPCION =
  "SELECT i.id, i.calificacion_final, i.aprobada, i.activa, i.fecha_baja, i.motivo_baja FROM inscripcion_materia i WHERE i.id = $1::bigint";
const COLUMNAS_ALUMNO = "SELECT numerocuenta, activo FROM alumnos WHERE numerocuenta = $1";

function tabla(filas: Fila[]): Resultado {
  return { columnas: filas[0] ? Object.keys(filas[0]) : [], tipos: {}, filas };
}

/** Ejecuta la operación dentro de una transacción y la revierte: muestra antes, después y bitácora. */
export async function simularOperacion(op: Operacion): Promise<ResultadoSimulacion> {
  await exigirSesion();
  exigirHabilitadas();
  const l = llamadaDe(op);
  const [estado, clave] = op.tipo === "reingreso" ? [COLUMNAS_ALUMNO, op.cuenta.trim()] : [COLUMNAS_INSCRIPCION, op.inscripcion];
  try {
    return await simular(async (q) => {
      const antes = await q(estado, [clave]);
      const [{ max }] = await q("SELECT coalesce(max(id), 0) AS max FROM auditoria.bitacora");
      try {
        const [r] = await q(l.texto, l.params);
        const despues = await q(estado, [clave]);
        const bitacora = await q(
          `SELECT usuario, tabla, registro_id, operacion, valores_anteriores, valores_nuevos, motivo, autorizado_por
           FROM auditoria.bitacora WHERE id > $1 ORDER BY id`,
          [max],
        );
        return {
          ok: true,
          mensaje: "La operación se ejecutó y después se revirtió: la base quedó igual.",
          llamada: l.legible,
          devolvio: r?.r === null || r?.r === undefined || r?.r === "" ? undefined : String(r.r),
          antes: tabla(antes),
          despues: tabla(despues),
          bitacora: tabla(bitacora),
        };
      } catch (e) {
        return {
          ok: false,
          mensaje: e instanceof Error ? e.message : String(e),
          llamada: l.legible,
          antes: tabla(antes),
        };
      }
    });
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : String(e), llamada: l.legible };
  }
}
