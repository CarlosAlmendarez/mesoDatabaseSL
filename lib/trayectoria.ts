// Fragmentos SQL de la trayectoria de cada alumno, compartidos por el tablero de rectoría y los
// reportes para la SEP. Solo ciclos ordinarios (AA-1, AA-2); el orden numérico sale de fn_ciclo_orden.
//
// Definiciones (el sistema anterior no registra egreso ni fecha de titulación, así que se derivan):
//  - Generación: año en que empezó su primer ciclo (24-1 empieza en agosto de 2023 → generación 2023).
//  - Nuevo ingreso de un ciclo: alumnos cuyo primer ciclo con materias es ese.
//  - Egresado: titulado, o cursó el último semestre de su plan y ya no está inscrito en el ciclo más reciente.
//  - Sigue estudiando: no egresó y tiene materias en alguno de los dos últimos ciclos.
//  - Dejó de inscribirse: todos los demás.

/** Licenciatura sin importar el plan: «LICENCIATURA EN DERECHO..» y «LICENCIATURA EN DERECHO» → «derecho». */
export const LIC = (c = "ca") =>
  `regexp_replace(translate(lower(${c}.nombre), 'áéíóú', 'aeiou'), '^licenciatura en |[.[:space:]]+$', '', 'g')`;

/** Clave de ciclo a partir de su orden: 20241 → '24-1'. */
export const CLAVE = (o: string) => `(right((${o} / 10)::text, 2) || '-' || (${o} % 10))`;

/** Etiqueta legible de la licenciatura (con acentos) a partir de la clave de LIC(). */
const NOMBRES: Record<string, string> = {
  contaduria: "Contaduría",
  "administracion de empresas": "Administración de Empresas",
  "administracion turistica": "Administración Turística",
  "sistemas computacionales": "Sistemas Computacionales",
  derecho: "Derecho",
  arquitectura: "Arquitectura",
  pedagogia: "Pedagogía",
  comunicacion: "Comunicación",
  psicologia: "Psicología",
  informatica: "Informática",
  "tecnologias computacionales": "Tecnologías Computacionales",
};
export function nombreLicenciatura(clave: string): string {
  return NOMBRES[clave] ?? clave.charAt(0).toUpperCase() + clave.slice(1);
}

/**
 * CTE `ciclos_ref` (último ciclo con materias y último ciclo cerrado, con 80 % de calificaciones) y
 * `tray` (una fila por alumno). Se usan como `WITH ${TRAYECTORIA} SELECT …`.
 */
export const TRAYECTORIA = `ciclos_ref AS (
  SELECT max(o) AS ultimo, max(o) FILTER (WHERE con_calif >= 0.8 * total) AS cerrado
  FROM (SELECT fn_ciclo_orden(c.clave) AS o, count(*) AS total, count(i.calificacion_final) AS con_calif
        FROM inscripcion_materia i JOIN ciclos_escolares c ON c.id = i.ciclo_id
        WHERE c.clave ~ '^\\d\\d-[12]$' GROUP BY c.clave) x
),
tray AS (
  SELECT a.id AS alumno_id, a.carrera_id, a.sexo, a.titulado, t.o_ini, t.o_fin, t.sem_max,
         t.o_ini / 10 - CASE WHEN t.o_ini % 10 = 1 THEN 1 ELSE 0 END AS generacion,
         ${LIC()} AS licenciatura,
         (a.titulado OR (t.sem_max >= ca.num_semestres AND t.o_fin < r.ultimo)) AS egresado,
         CASE
           WHEN a.titulado THEN 'Titulados'
           WHEN t.sem_max >= ca.num_semestres AND t.o_fin < r.ultimo THEN 'Egresados sin título'
           WHEN t.o_fin >= r.cerrado THEN 'Siguen estudiando'
           ELSE 'Dejaron de inscribirse'
         END AS situacion
  FROM (SELECT i.alumno_id, min(fn_ciclo_orden(c.clave)) AS o_ini, max(fn_ciclo_orden(c.clave)) AS o_fin,
               max(i.semestre) AS sem_max
        FROM inscripcion_materia i JOIN ciclos_escolares c ON c.id = i.ciclo_id
        WHERE c.clave ~ '^\\d\\d-[12]$'
        GROUP BY i.alumno_id) t
  JOIN alumnos a ON a.id = t.alumno_id
  JOIN carreras ca ON ca.id = a.carrera_id
  CROSS JOIN ciclos_ref r
)`;

/** Columnas de sexo para los formatos de la SEP (hombres, mujeres, sin dato, total). */
export const POR_SEXO = (col = "a.sexo") => `count(*) FILTER (WHERE ${col} = 'hombre') AS hombres,
       count(*) FILTER (WHERE ${col} = 'mujer') AS mujeres,
       count(*) FILTER (WHERE ${col} IS NULL) AS sexo_sin_dato,
       count(*) AS total`;
