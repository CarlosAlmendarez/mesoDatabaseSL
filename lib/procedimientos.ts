// Catálogo de reportes. Dos tipos:
//  - `funcion`: un procedimiento almacenado de la base (migración 0015).
//  - `sql`: una consulta de solo lectura definida en la app (se puede volver procedimiento después).
// La app arma el formulario y la llamada a partir de esta lista: nombres de función, parámetros y SQL
// son fijos; los valores siempre viajan como parámetros ($1, $2…).

import { CLAVE, POR_SEXO, TRAYECTORIA } from "./trayectoria";

export type TipoParam = "texto" | "numero" | "fecha" | "booleano" | "carrera" | "ciclo" | "opcion";

export type Param = {
  nombre: string; // en `funcion`: nombre del parámetro (p_…); en `sql`: posición $n según el orden
  etiqueta: string;
  tipo: TipoParam;
  requerido?: boolean;
  opciones?: { valor: string; etiqueta: string }[];
  ejemplo?: string;
};

export type Vista = { tipo: "barras" | "linea"; x: string; y: string; series?: string };

export type Procedimiento = {
  id: string;
  funcion?: string;
  sql?: string;
  titulo: string;
  descripcion: string;
  ayuda: string;
  grupo: string;
  params: Param[];
  vista?: Vista;
  agruparSugerido?: string[];
};

export const GRUPOS = [
  "Alumnos e historial",
  "Calificaciones y desempeño",
  "Grupos y ciclos",
  "Planes de estudio",
  "Docentes",
  "Becas, servicio y titulación",
  "SEP · Formato 911",
  "SEP · Relaciones y control escolar",
  "Evaluación docente",
] as const;

const carrera: Param = { nombre: "p_carrera", etiqueta: "Carrera", tipo: "carrera" };
const ciclo: Param = { nombre: "p_ciclo", etiqueta: "Ciclo", tipo: "ciclo" };

// Filtros reutilizables de las consultas `sql`: $n::text IS NULL OR …
const PCT_REPROB = `round(100.0 * count(*) FILTER (WHERE NOT i.aprobada AND i.calificacion_final IS NOT NULL)
       / nullif(count(i.calificacion_final), 0), 1)`;

export const PROCEDIMIENTOS: Procedimiento[] = [
  // ------------------------------------------------------------------ Alumnos e historial
  {
    id: "historial", funcion: "sp_historial_academico", grupo: "Alumnos e historial",
    titulo: "Historial académico (kárdex)",
    descripcion: "Todas las materias del alumno con parciales, extraordinarios, calificación final y forma de aprobación.",
    ayuda: "Escribe la matrícula. Cada fila es una materia cursada; la columna «estatus» dice si está acreditada, no acreditada, en curso o dada de baja. Agrupa por «ciclo» para ver el promedio de cada semestre.",
    params: [{ nombre: "p_numerocuenta", etiqueta: "Matrícula", tipo: "texto", requerido: true, ejemplo: "21102010" }],
    agruparSugerido: ["ciclo"],
  },
  {
    id: "promedio", funcion: "sp_promedio_alumno", grupo: "Alumnos e historial",
    titulo: "Promedio por ciclo y general",
    descripcion: "Promedio del alumno en cada ciclo y el general.",
    ayuda: "La fila «GENERAL» es el promedio de toda la carrera. Marca «Solo materias acreditadas» para el promedio que va en certificados.",
    params: [
      { nombre: "p_numerocuenta", etiqueta: "Matrícula", tipo: "texto", requerido: true, ejemplo: "21102010" },
      ciclo,
      { nombre: "p_solo_acreditadas", etiqueta: "Solo materias acreditadas", tipo: "booleano" },
    ],
    vista: { tipo: "linea", x: "ciclo", y: "promedio" },
  },
  {
    id: "riesgo", funcion: "sp_alumnos_en_riesgo", grupo: "Alumnos e historial",
    titulo: "Alumnos en riesgo",
    descripcion: "Alumnos activos con materias no acreditadas y oportunidades de excepción usadas.",
    ayuda: "Sirve para tutorías y seguimiento: «materias_no_acreditadas» son las que el alumno reprobó y todavía no acredita. Agrupa por carrera para ver dónde se concentran.",
    params: [carrera],
    agruparSugerido: ["carrera"],
    vista: { tipo: "barras", x: "numerocuenta", y: "materias_no_acreditadas" },
  },
  {
    id: "avance-plan", grupo: "Alumnos e historial",
    titulo: "Avance del plan por alumno",
    descripcion: "Materias acreditadas contra el total del plan de cada alumno, con su promedio.",
    ayuda: "«porcentaje_avance» es cuánto del plan lleva acreditado. Útil para saber quién está cerca de egresar o quién va atrasado.",
    params: [carrera, { nombre: "p_solo_activos", etiqueta: "Solo activos", tipo: "booleano" }],
    sql: `SELECT ca.clave AS carrera, a.numerocuenta, fn_nombre_completo(a.nombre, a.apellido_1, a.apellido_2) AS alumno,
       a.semestre_actual, count(DISTINCT m.id) AS materias_plan, count(DISTINCT ma.materia_id) AS materias_acreditadas,
       round(100.0 * count(DISTINCT ma.materia_id) / nullif(count(DISTINCT m.id), 0), 1) AS porcentaje_avance,
       (SELECT round(avg(i.calificacion_final), 2) FROM inscripcion_materia i
         WHERE i.alumno_id = a.id AND i.calificacion_final IS NOT NULL AND i.fecha_baja IS NULL) AS promedio
FROM alumnos a
JOIN carreras ca ON ca.id = a.carrera_id
JOIN materias m ON m.carrera_id = a.carrera_id AND m.activo
LEFT JOIN v_materias_acreditadas ma ON ma.alumno_id = a.id AND ma.materia_id = m.id
WHERE ($1::text IS NULL OR ca.clave = $1) AND ($2::boolean IS NOT TRUE OR a.activo)
GROUP BY a.id, ca.clave
ORDER BY porcentaje_avance DESC, alumno`,
    vista: { tipo: "barras", x: "carrera", y: "porcentaje_avance" },
    agruparSugerido: ["carrera"],
  },
  {
    id: "buscar", funcion: "sp_buscar_alumnos", grupo: "Alumnos e historial",
    titulo: "Búsqueda de alumnos",
    descripcion: "Filtros libres: nombre o matrícula, carrera, fechas de ingreso, sexo, activos y titulados.",
    ayuda: "Combina los filtros que necesites; los que dejes vacíos no se aplican. Por ejemplo: carrera 05, ingreso entre 2015 y 2020, titulados = Sí.",
    params: [
      { nombre: "p_texto", etiqueta: "Nombre o matrícula", tipo: "texto" },
      carrera,
      { nombre: "p_ingreso_desde", etiqueta: "Ingreso desde", tipo: "fecha" },
      { nombre: "p_ingreso_hasta", etiqueta: "Ingreso hasta", tipo: "fecha" },
      {
        nombre: "p_sexo", etiqueta: "Sexo", tipo: "opcion",
        opciones: [{ valor: "hombre", etiqueta: "Hombre" }, { valor: "mujer", etiqueta: "Mujer" }],
      },
      { nombre: "p_activo", etiqueta: "Activo", tipo: "booleano" },
      { nombre: "p_titulado", etiqueta: "Titulado", tipo: "booleano" },
    ],
    agruparSugerido: ["carrera", "sexo"],
  },

  // ------------------------------------------------------------------ Calificaciones y desempeño
  {
    id: "estad-materias", grupo: "Calificaciones y desempeño",
    titulo: "Estadística por materia",
    descripcion: "Inscritos, aprobados, reprobados, porcentaje de reprobación y promedio de cada materia.",
    ayuda: "Identifica las materias más difíciles del ciclo. Ordena por «pct_reprobacion» o por «reprobados». Las materias con pocos inscritos pueden dar porcentajes extremos.",
    params: [ciclo, carrera],
    sql: `SELECT ca.clave AS carrera, m.semestre, m.clave, m.nombre AS materia, count(*) AS inscritos,
       count(*) FILTER (WHERE i.aprobada) AS aprobados, count(*) FILTER (WHERE NOT i.aprobada) AS reprobados,
       round(100.0 * count(*) FILTER (WHERE NOT i.aprobada) / count(*), 1) AS pct_reprobacion,
       round(avg(i.calificacion_final), 2) AS promedio, min(i.calificacion_final) AS minima, max(i.calificacion_final) AS maxima
FROM inscripcion_materia i
JOIN materias m ON m.id = i.materia_id
JOIN carreras ca ON ca.id = m.carrera_id
JOIN ciclos_escolares c ON c.id = i.ciclo_id
WHERE i.calificacion_final IS NOT NULL AND i.fecha_baja IS NULL
  AND ($1::text IS NULL OR c.clave = $1) AND ($2::text IS NULL OR ca.clave = $2)
GROUP BY ca.clave, m.id
ORDER BY reprobados DESC, pct_reprobacion DESC`,
    vista: { tipo: "barras", x: "materia", y: "reprobados" },
  },
  {
    id: "tendencia-ciclos", grupo: "Calificaciones y desempeño",
    titulo: "Tendencia por ciclo",
    descripcion: "Alumnos, materias cursadas, promedio y porcentaje de reprobación de cada ciclo.",
    ayuda: "Muestra cómo ha cambiado la matrícula y el desempeño a lo largo de los años. El historial anterior a 2001 está marcado como por clasificar (puede ser del plantel de Oaxaca).",
    params: [carrera],
    sql: `SELECT c.clave AS ciclo, count(DISTINCT i.alumno_id) AS alumnos, count(*) AS materias_cursadas,
       round(avg(i.calificacion_final), 2) AS promedio, ${PCT_REPROB} AS pct_reprobacion
FROM inscripcion_materia i
JOIN ciclos_escolares c ON c.id = i.ciclo_id
JOIN materias m ON m.id = i.materia_id
JOIN carreras ca ON ca.id = m.carrera_id
WHERE i.fecha_baja IS NULL AND ($1::text IS NULL OR ca.clave = $1)
GROUP BY c.clave
ORDER BY fn_ciclo_orden(c.clave)`,
    vista: { tipo: "linea", x: "ciclo", y: "alumnos" },
  },
  {
    id: "distribucion", grupo: "Calificaciones y desempeño",
    titulo: "Distribución de calificaciones finales",
    descripcion: "Cuántas materias terminaron con cada calificación (5, 6, 7…).",
    ayuda: "La barra del 5 son las materias no acreditadas. Filtra por carrera o ciclo para comparar.",
    params: [carrera, ciclo],
    sql: `SELECT floor(i.calificacion_final)::int AS calificacion, count(*) AS materias
FROM inscripcion_materia i
JOIN materias m ON m.id = i.materia_id
JOIN carreras ca ON ca.id = m.carrera_id
JOIN ciclos_escolares c ON c.id = i.ciclo_id
WHERE i.calificacion_final IS NOT NULL AND i.fecha_baja IS NULL
  AND ($1::text IS NULL OR ca.clave = $1) AND ($2::text IS NULL OR c.clave = $2)
GROUP BY 1
ORDER BY 1`,
    vista: { tipo: "barras", x: "calificacion", y: "materias" },
  },
  {
    id: "formas-aprobacion", grupo: "Calificaciones y desempeño",
    titulo: "Formas de aprobación por ciclo",
    descripcion: "Materias cursadas, por equivalencia, por regularización y en curso, según el símbolo del sistema anterior.",
    ayuda: "Viene de la columna «rev» del sistema anterior: «/» = equivalencia, «Y» = regularización, «.» = en curso, «-» = cursada.",
    params: [carrera],
    sql: `SELECT c.clave AS ciclo, coalesce(fa.nombre, 'Sin símbolo') AS forma_aprobacion, count(*) AS materias
FROM inscripcion_materia i
JOIN ciclos_escolares c ON c.id = i.ciclo_id
JOIN materias m ON m.id = i.materia_id
JOIN carreras ca ON ca.id = m.carrera_id
LEFT JOIN cat_forma_aprobacion fa ON fa.id = i.forma_aprobacion_id
WHERE ($1::text IS NULL OR ca.clave = $1)
GROUP BY c.clave, fa.nombre
ORDER BY fn_ciclo_orden(c.clave), 2`,
    vista: { tipo: "linea", x: "ciclo", y: "materias", series: "forma_aprobacion" },
  },

  // ------------------------------------------------------------------ Grupos y ciclos
  {
    id: "inscritos", funcion: "sp_inscritos_por_ciclo", grupo: "Grupos y ciclos",
    titulo: "Inscritos por ciclo",
    descripcion: "Alumnos e inscripciones por ciclo, carrera y semestre.",
    ayuda: "Elige un ciclo para ver cuántos alumnos hay en cada carrera y semestre. Agrupa por carrera para el total por licenciatura.",
    params: [ciclo],
    agruparSugerido: ["carrera"],
    vista: { tipo: "barras", x: "carrera", y: "alumnos" },
  },
  {
    id: "ingreso", grupo: "Grupos y ciclos",
    titulo: "Ingreso por año",
    descripcion: "Alumnos que ingresaron cada año, cuántos siguen activos y cuántos se titularon.",
    ayuda: "Sirve para ver el tamaño de cada generación y su eficiencia terminal (titulados entre ingresados).",
    params: [carrera],
    sql: `SELECT extract(year FROM a.fecha_inscripcion)::int AS anio_ingreso, count(*) AS alumnos,
       count(*) FILTER (WHERE a.activo) AS activos, count(*) FILTER (WHERE a.titulado) AS titulados,
       round(100.0 * count(*) FILTER (WHERE a.titulado) / count(*), 1) AS pct_titulados
FROM alumnos a
JOIN carreras ca ON ca.id = a.carrera_id
WHERE a.fecha_inscripcion IS NOT NULL AND ($1::text IS NULL OR ca.clave = $1)
GROUP BY 1
ORDER BY 1`,
    vista: { tipo: "barras", x: "anio_ingreso", y: "alumnos" },
  },
  {
    id: "lista-grupo", funcion: "sp_lista_grupo", grupo: "Grupos y ciclos",
    titulo: "Lista de un grupo",
    descripcion: "Lista de asistencia del grupo, separada por licenciatura en grupos combinados.",
    ayuda: "Funciona con los grupos que se capturen en el sistema nuevo; los datos migrados no tienen alumnos ligados a grupos.",
    params: [
      { nombre: "p_oferta_grupo_id", etiqueta: "Id del grupo", tipo: "numero", requerido: true },
      carrera,
    ],
  },

  // ------------------------------------------------------------------ Planes de estudio
  {
    id: "plan-estudios", grupo: "Planes de estudio",
    titulo: "Plan de estudios de una carrera",
    descripcion: "Materias por semestre con créditos, horas y materias requisito (seriación).",
    ayuda: "Elige la carrera. Agrupa por «semestre» para ver créditos y número de materias por semestre.",
    params: [{ ...carrera, requerido: true }],
    sql: `SELECT m.semestre, m.clave, m.nombre AS materia, m.creditos, m.horas_semana, m.horas_totales,
       (SELECT string_agg(r.clave || ' ' || r.nombre, ', ' ORDER BY r.clave)
          FROM materia_seriacion s JOIN materias r ON r.id = s.materia_requisito_id
         WHERE s.materia_id = m.id) AS requisitos
FROM materias m
JOIN carreras ca ON ca.id = m.carrera_id
WHERE ca.clave = $1 AND m.activo
ORDER BY m.semestre, m.clave`,
    agruparSugerido: ["semestre"],
    vista: { tipo: "barras", x: "semestre", y: "creditos" },
  },
  {
    id: "carreras", grupo: "Planes de estudio",
    titulo: "Catálogo de carreras",
    descripcion: "Clave, nombre, RVOE, tipo de plan, semestres y alumnos de cada carrera.",
    ayuda: "Varias carreras comparten nombre o RVOE porque son planes distintos (viejo y nuevo); la clave es la que las distingue.",
    params: [],
    sql: `SELECT c.clave, c.nombre, c.rvoe, c.fecha_rvoe, c.version_plan AS plan, c.num_semestres, c.activo,
       count(a.id) AS alumnos, count(a.id) FILTER (WHERE a.activo) AS activos,
       (SELECT count(*) FROM materias m WHERE m.carrera_id = c.id AND m.activo) AS materias
FROM carreras c
LEFT JOIN alumnos a ON a.carrera_id = c.id
GROUP BY c.id
ORDER BY c.clave`,
    vista: { tipo: "barras", x: "clave", y: "alumnos" },
  },

  // ------------------------------------------------------------------ Docentes
  {
    id: "docentes-ciclo", grupo: "Docentes",
    titulo: "Carga y desempeño por docente",
    descripcion: "Materias, alumnos, promedio y reprobación de los grupos de cada docente.",
    ayuda: "Sale del historial: qué docente dio cada materia. Elige un ciclo para ver la carga del semestre.",
    params: [ciclo, carrera],
    sql: `SELECT d.clave, fn_nombre_completo(d.nombre, d.apellido_1, d.apellido_2) AS docente,
       count(DISTINCT i.materia_id) AS materias, count(DISTINCT i.alumno_id) AS alumnos,
       round(avg(i.calificacion_final), 2) AS promedio, ${PCT_REPROB} AS pct_reprobacion
FROM inscripcion_materia i
JOIN docentes d ON d.id = i.docente_id
JOIN ciclos_escolares c ON c.id = i.ciclo_id
JOIN materias m ON m.id = i.materia_id
JOIN carreras ca ON ca.id = m.carrera_id
WHERE i.fecha_baja IS NULL AND ($1::text IS NULL OR c.clave = $1) AND ($2::text IS NULL OR ca.clave = $2)
GROUP BY d.id
ORDER BY alumnos DESC`,
    vista: { tipo: "barras", x: "docente", y: "alumnos" },
  },
  {
    id: "asistencia-docente", funcion: "sp_reporte_asistencia_docente", grupo: "Docentes",
    titulo: "Asistencia docente (contabilidad)",
    descripcion: "Faltas, retardos, reposiciones y adelantos por docente y materia en un periodo.",
    ayuda: "El sistema anterior solo registra incidencias (no las clases normales). Agrupa por «docente» para el total del periodo.",
    params: [
      { nombre: "p_desde", etiqueta: "Desde", tipo: "fecha", requerido: true, ejemplo: "2023-01-01" },
      { nombre: "p_hasta", etiqueta: "Hasta", tipo: "fecha", requerido: true, ejemplo: "2024-12-31" },
      { nombre: "p_docente_clave", etiqueta: "Clave del docente", tipo: "texto" },
    ],
    vista: { tipo: "barras", x: "docente", y: "faltas" },
  },
  {
    id: "constancia-docente", funcion: "sp_constancia_docente", grupo: "Docentes",
    titulo: "Constancia de trabajo",
    descripcion: "Periodos y ciclos en que el docente impartió clases, aunque ya no esté activo.",
    ayuda: "Base para las constancias que piden los maestros: primer y último ciclo con clases y cuántas materias impartió.",
    params: [{ nombre: "p_docente_clave", etiqueta: "Clave del docente", tipo: "texto", requerido: true, ejemplo: "0320011" }],
  },

  // ------------------------------------------------------------------ Becas, servicio y titulación
  {
    id: "ranking-becas", funcion: "sp_ranking_becas", grupo: "Becas, servicio y titulación",
    titulo: "Ranking para becas",
    descripcion: "Alumnos ordenados por promedio del ciclo, por carrera, con su beca actual.",
    ayuda: "«lugar» es la posición dentro de su carrera. Usa «Promedio mínimo» para dejar solo a los candidatos.",
    params: [
      { ...ciclo, requerido: true },
      carrera,
      { nombre: "p_promedio_minimo", etiqueta: "Promedio mínimo", tipo: "numero" },
    ],
  },
  {
    id: "becas", grupo: "Becas, servicio y titulación",
    titulo: "Becas registradas",
    descripcion: "Becas de cada alumno con tipo, porcentaje, ciclo y promedio registrado.",
    ayuda: "Agrupa por «tipo_beca» o por «carrera» para ver cuántas becas hay de cada clase.",
    params: [carrera],
    sql: `SELECT ca.clave AS carrera, a.numerocuenta, fn_nombre_completo(a.nombre, a.apellido_1, a.apellido_2) AS alumno,
       c.clave AS ciclo, b.tipo_beca, b.porcentaje, b.promedio, b.activa
FROM becas b
JOIN alumnos a ON a.id = b.alumno_id
LEFT JOIN carreras ca ON ca.id = a.carrera_id
LEFT JOIN ciclos_escolares c ON c.id = b.ciclo_id
WHERE ($1::text IS NULL OR ca.clave = $1)
ORDER BY ca.clave, alumno`,
    agruparSugerido: ["tipo_beca"],
    vista: { tipo: "barras", x: "tipo_beca", y: "registros" },
  },
  {
    id: "elegibles-servicio", funcion: "sp_elegibles_practica_servicio", grupo: "Becas, servicio y titulación",
    titulo: "Elegibles para servicio o prácticas",
    descripcion: "Alumnos con 70 % del plan acreditado y desde 5.º semestre.",
    ayuda: "«ya_registrado» indica si ya tiene servicio o prácticas capturados; «liberado», si ya tiene carta de liberación.",
    params: [
      {
        nombre: "p_tipo", etiqueta: "Tipo", tipo: "opcion",
        opciones: [{ valor: "servicio_social", etiqueta: "Servicio social" }, { valor: "practica", etiqueta: "Prácticas profesionales" }],
      },
      carrera,
    ],
    agruparSugerido: ["carrera"],
  },
  {
    id: "candidatos-titulacion", funcion: "sp_candidatos_titulacion", grupo: "Becas, servicio y titulación",
    titulo: "Candidatos a titulación",
    descripcion: "Qué le falta a cada alumno: materias, servicio, prácticas, fotografías o certificado.",
    ayuda: "Hoy nadie aparece como candidato porque el sistema anterior no registra el certificado; la columna «falta» dice qué le falta a cada uno.",
    params: [carrera, { nombre: "p_solo_candidatos", etiqueta: "Solo candidatos", tipo: "booleano" }],
  },
  {
    id: "titulados", grupo: "Becas, servicio y titulación",
    titulo: "Titulados por carrera y modalidad",
    descripcion: "Cuántos titulados hay por carrera y por tipo de titulación (curso, tesis, maestría).",
    ayuda: "El sistema anterior no trae la fecha de titulación, por eso no se puede ver por año.",
    params: [],
    sql: `SELECT ca.clave AS carrera, coalesce(t.tipo_titulacion, 'sin dato') AS modalidad, count(*) AS titulados
FROM titulacion t
JOIN alumnos a ON a.id = t.alumno_id
LEFT JOIN carreras ca ON ca.id = a.carrera_id
GROUP BY 1, 2
ORDER BY 1, 3 DESC`,
    vista: { tipo: "barras", x: "carrera", y: "titulados", series: "modalidad" },
  },
  {
    id: "cedula", funcion: "sp_seguimiento_cedula", grupo: "Becas, servicio y titulación",
    titulo: "Seguimiento de cédula profesional",
    descripcion: "Titulados con el estatus de su cédula.",
    ayuda: "El estatus de la cédula se captura en el sistema nuevo; en lo migrado aparece vacío (SIN_DATO).",
    params: [
      carrera,
      {
        nombre: "p_estatus", etiqueta: "Estatus", tipo: "opcion",
        opciones: ["TIENE", "SOLICITADA", "EN_TRAMITE", "NO", "SIN_DATO"].map((v) => ({ valor: v, etiqueta: v })),
      },
    ],
  },

  // ------------------------------------------------------------------ SEP · Formato 911
  // Cuestionario estadístico 911 de educación superior (inicio y fin de cursos): matrícula, primer
  // ingreso, edad, egresados y personal docente, todo por sexo. En el ciclo escolar anual (ago–jul)
  // la matrícula de inicio de cursos es la del ciclo -1.
  {
    id: "f911-matricula", grupo: "SEP · Formato 911",
    titulo: "Matrícula por carrera, semestre y sexo",
    descripcion: "Alumnos con materias en el ciclo, por carrera y semestre, separados en hombres y mujeres, con su primer ingreso.",
    ayuda: "Para el 911 de inicio de cursos elige el ciclo -1 (agosto). «Primer ingreso» son los alumnos cuyo primer ciclo es este. Agrupa por «carrera» y suma las columnas para el total por licenciatura. «Sexo sin dato» son alumnos que el sistema anterior no tiene capturados.",
    params: [{ ...ciclo, requerido: true, ejemplo: "24-1" }, carrera],
    sql: `WITH m AS (
  SELECT i.alumno_id, max(i.semestre) AS semestre
  FROM inscripcion_materia i JOIN ciclos_escolares c ON c.id = i.ciclo_id
  WHERE c.clave = $1::text AND i.fecha_baja IS NULL
  GROUP BY i.alumno_id
), p AS (
  SELECT i.alumno_id, min(fn_ciclo_orden(c.clave)) AS o_ini
  FROM inscripcion_materia i JOIN ciclos_escolares c ON c.id = i.ciclo_id
  WHERE c.clave ~ '^\\d\\d-[12]$' AND i.alumno_id IN (SELECT alumno_id FROM m)
  GROUP BY i.alumno_id
)
SELECT ca.clave AS carrera, ca.nombre AS nombre_carrera, ca.rvoe, m.semestre,
       ${POR_SEXO()},
       count(*) FILTER (WHERE p.o_ini = fn_ciclo_orden($1::text)) AS primer_ingreso,
       count(*) FILTER (WHERE p.o_ini = fn_ciclo_orden($1::text) AND a.sexo = 'hombre') AS primer_ingreso_hombres,
       count(*) FILTER (WHERE p.o_ini = fn_ciclo_orden($1::text) AND a.sexo = 'mujer') AS primer_ingreso_mujeres
FROM m
JOIN alumnos a ON a.id = m.alumno_id
JOIN carreras ca ON ca.id = a.carrera_id
LEFT JOIN p ON p.alumno_id = m.alumno_id
WHERE ($2::text IS NULL OR ca.clave = $2)
GROUP BY ca.id, m.semestre
ORDER BY ca.clave, m.semestre`,
    agruparSugerido: ["carrera"],
    vista: { tipo: "barras", x: "carrera", y: "total" },
  },
  {
    id: "f911-edad", grupo: "SEP · Formato 911",
    titulo: "Matrícula por edad y sexo",
    descripcion: "Alumnos del ciclo por edad cumplida al 1 de septiembre, en los rangos del 911.",
    ayuda: "La edad se calcula al 1 de septiembre del año en que empieza el ciclo escolar (24-1 y 24-2 → 1-sep-2023). «Sin dato» son alumnos sin fecha de nacimiento capturada.",
    params: [{ ...ciclo, requerido: true, ejemplo: "24-1" }, carrera],
    sql: `WITH m AS (
  SELECT DISTINCT i.alumno_id
  FROM inscripcion_materia i JOIN ciclos_escolares c ON c.id = i.ciclo_id
  WHERE c.clave = $1::text AND i.fecha_baja IS NULL
), e AS (
  SELECT a.sexo, ca.clave AS carrera,
         extract(year FROM age(make_date(fn_ciclo_orden($1::text) / 10 - 1, 9, 1), a.fecha_nacimiento))::int AS edad
  FROM m JOIN alumnos a ON a.id = m.alumno_id JOIN carreras ca ON ca.id = a.carrera_id
  WHERE ($2::text IS NULL OR ca.clave = $2)
)
SELECT CASE WHEN edad IS NULL THEN 'Sin dato' WHEN edad <= 17 THEN '17 o menos' WHEN edad <= 29 THEN edad::text
            WHEN edad <= 34 THEN '30 a 34' WHEN edad <= 39 THEN '35 a 39' ELSE '40 o más' END AS rango_edad,
       ${POR_SEXO("sexo")}
FROM e
GROUP BY 1
ORDER BY min(coalesce(edad, 999))`,
    vista: { tipo: "barras", x: "rango_edad", y: "total" },
  },
  {
    id: "f911-egresados", grupo: "SEP · Formato 911",
    titulo: "Egresados por carrera y sexo",
    descripcion: "Alumnos que terminaron su plan en el ciclo (su último ciclo con materias), con cuántos ya están titulados.",
    ayuda: "El sistema anterior no registra el egreso: se considera egresado a quien cursó el último semestre de su plan (o está titulado) y ya no se inscribió después. Para el 911 suma el ciclo -1 y el -2 del ciclo escolar. Los titulados no se pueden contar por ciclo porque no hay fecha de titulación.",
    params: [{ ...ciclo, requerido: true, ejemplo: "24-1" }, carrera],
    sql: `WITH ${TRAYECTORIA}
SELECT ca.clave AS carrera, ca.nombre AS nombre_carrera, ca.rvoe,
       ${POR_SEXO("t.sexo")},
       count(*) FILTER (WHERE t.titulado) AS de_ellos_titulados
FROM tray t JOIN carreras ca ON ca.id = t.carrera_id
WHERE t.egresado AND t.o_fin = fn_ciclo_orden($1::text) AND ($2::text IS NULL OR ca.clave = $2)
GROUP BY ca.id
ORDER BY ca.clave`,
    vista: { tipo: "barras", x: "carrera", y: "total" },
  },
  {
    id: "f911-docentes", grupo: "SEP · Formato 911",
    titulo: "Personal docente del ciclo",
    descripcion: "Docentes que dieron clase en el ciclo, con sexo, grado académico, carreras, materias y alumnos.",
    ayuda: "Agrupa por «sexo» o por «grado académico» para los totales del 911. Hoy salen «sin dato» porque el sistema anterior no captura el sexo ni el grado de los docentes: es un dato a completar en el sistema nuevo.",
    params: [{ ...ciclo, requerido: true, ejemplo: "24-1" }, carrera],
    sql: `SELECT d.clave, fn_nombre_completo(d.nombre, d.apellido_1, d.apellido_2) AS docente,
       coalesce(d.sexo, 'sin dato') AS sexo, coalesce(d.grado_academico, 'sin dato') AS grado_academico,
       string_agg(DISTINCT ca.clave, ', ' ORDER BY ca.clave) AS carreras,
       count(DISTINCT i.materia_id) AS materias, count(DISTINCT i.alumno_id) AS alumnos
FROM inscripcion_materia i
JOIN docentes d ON d.id = i.docente_id
JOIN ciclos_escolares c ON c.id = i.ciclo_id
JOIN materias m ON m.id = i.materia_id
JOIN carreras ca ON ca.id = m.carrera_id
WHERE c.clave = $1::text AND i.fecha_baja IS NULL AND ($2::text IS NULL OR ca.clave = $2)
GROUP BY d.id
ORDER BY docente`,
    agruparSugerido: ["sexo", "grado_academico"],
    vista: { tipo: "barras", x: "docente", y: "alumnos" },
  },
  {
    id: "estadistica", funcion: "sp_estadistica_alumnos", grupo: "SEP · Formato 911",
    titulo: "Alumnos por discapacidad y lengua indígena",
    descripcion: "Conteo y promedio por carrera, sexo, edad, discapacidad y lengua indígena.",
    ayuda: "Cada fila es una combinación; agrupa por «sexo» o «rango_edad» y suma la columna «alumnos» para los totales que pide la SEP. Discapacidad y lengua indígena salen vacías hasta que se capturen en el sistema nuevo (el anterior no las registra).",
    params: [carrera, ciclo, { nombre: "p_solo_activos", etiqueta: "Solo activos", tipo: "booleano" }],
    agruparSugerido: ["sexo"],
  },

  // ------------------------------------------------------------------ SEP · Relaciones y control escolar
  {
    id: "relacion-inscripcion", grupo: "SEP · Relaciones y control escolar",
    titulo: "Relación de inscripción y reinscripción",
    descripcion: "Lista oficial de alumnos del ciclo con CURP, datos personales, semestre, grupo y si son de nuevo ingreso o reingreso.",
    ayuda: "Es la relación que se entrega al inicio de cada ciclo. Exporta a Excel y filtra por «tipo de ingreso» para separar nuevo ingreso y reingreso. Las columnas vacías (CURP, sexo) son datos que el sistema anterior no tiene.",
    params: [{ ...ciclo, requerido: true, ejemplo: "24-1" }, carrera],
    sql: `WITH m AS (
  SELECT i.alumno_id, max(i.semestre) AS semestre, count(*) AS materias_inscritas,
         string_agg(DISTINCT i.grupo, ', ') AS grupo
  FROM inscripcion_materia i JOIN ciclos_escolares c ON c.id = i.ciclo_id
  WHERE c.clave = $1::text AND i.fecha_baja IS NULL
  GROUP BY i.alumno_id
), p AS (
  SELECT i.alumno_id, min(fn_ciclo_orden(c.clave)) AS o_ini
  FROM inscripcion_materia i JOIN ciclos_escolares c ON c.id = i.ciclo_id
  WHERE c.clave ~ '^\\d\\d-[12]$' AND i.alumno_id IN (SELECT alumno_id FROM m)
  GROUP BY i.alumno_id
)
SELECT ca.clave AS carrera, ca.rvoe, a.numerocuenta, a.curp, a.apellido_1, a.apellido_2, a.nombre, a.sexo,
       a.fecha_nacimiento, m.semestre, m.grupo,
       CASE WHEN p.o_ini = fn_ciclo_orden($1::text) THEN 'Nuevo ingreso' ELSE 'Reingreso' END AS tipo_ingreso,
       m.materias_inscritas
FROM m
JOIN alumnos a ON a.id = m.alumno_id
JOIN carreras ca ON ca.id = a.carrera_id
LEFT JOIN p ON p.alumno_id = m.alumno_id
WHERE ($2::text IS NULL OR ca.clave = $2)
ORDER BY ca.clave, m.semestre, a.apellido_1, a.apellido_2, a.nombre`,
    agruparSugerido: ["carrera", "tipo_ingreso"],
  },
  {
    id: "relacion-bajas", grupo: "SEP · Relaciones y control escolar",
    titulo: "Alumnos que no se reinscribieron",
    descripcion: "Alumnos cuyo último ciclo fue el elegido, sin haber egresado: bajas y deserción.",
    ayuda: "El sistema anterior no registra las bajas de los alumnos: aquí aparecen quienes cursaron este ciclo y ya no se inscribieron al siguiente, sin haber terminado el plan. Sirve para el reporte de bajas y para el seguimiento de deserción. El ciclo más reciente no aplica (todavía no hay ciclo siguiente).",
    params: [{ ...ciclo, requerido: true, ejemplo: "24-1" }, carrera],
    sql: `WITH ${TRAYECTORIA}
SELECT ca.clave AS carrera, a.numerocuenta, fn_nombre_completo(a.nombre, a.apellido_1, a.apellido_2) AS alumno, a.sexo,
       ${CLAVE("t.o_ini")} AS ciclo_ingreso, t.sem_max AS semestre_alcanzado,
       (SELECT count(DISTINCT i.materia_id) FROM inscripcion_materia i
         WHERE i.alumno_id = t.alumno_id AND i.aprobada IS FALSE
           AND NOT EXISTS (SELECT 1 FROM v_materias_acreditadas v WHERE v.alumno_id = i.alumno_id AND v.materia_id = i.materia_id)
       ) AS materias_no_acreditadas,
       (SELECT round(avg(i.calificacion_final), 2) FROM inscripcion_materia i
         WHERE i.alumno_id = t.alumno_id AND i.calificacion_final IS NOT NULL AND i.fecha_baja IS NULL) AS promedio
FROM tray t
JOIN alumnos a ON a.id = t.alumno_id
JOIN carreras ca ON ca.id = t.carrera_id
CROSS JOIN ciclos_ref r
WHERE NOT t.egresado AND t.o_fin = fn_ciclo_orden($1::text) AND t.o_fin < r.ultimo
  AND ($2::text IS NULL OR ca.clave = $2)
ORDER BY ca.clave, t.sem_max, alumno`,
    agruparSugerido: ["carrera", "semestre_alcanzado"],
    vista: { tipo: "barras", x: "semestre_alcanzado", y: "registros" },
  },
  {
    id: "relacion-egresados", grupo: "SEP · Relaciones y control escolar",
    titulo: "Relación de egresados",
    descripcion: "Alumnos que terminaron el plan, con generación, ciclos de ingreso y egreso, materias acreditadas y promedio general.",
    ayuda: "Base para certificados totales y para el seguimiento de egresados. Deja el ciclo vacío para todos, o elige el ciclo de egreso. «Promedio general» es el de las materias acreditadas.",
    params: [ciclo, carrera],
    sql: `WITH ${TRAYECTORIA}
SELECT ca.clave AS carrera, ca.rvoe, a.numerocuenta, a.curp, a.apellido_1, a.apellido_2, a.nombre, a.sexo,
       t.generacion, ${CLAVE("t.o_ini")} AS ciclo_ingreso, ${CLAVE("t.o_fin")} AS ciclo_egreso,
       (SELECT count(*) FROM v_materias_acreditadas v WHERE v.alumno_id = t.alumno_id) AS materias_acreditadas,
       (SELECT round(avg(i.calificacion_final), 2) FROM inscripcion_materia i
         WHERE i.alumno_id = t.alumno_id AND i.aprobada AND i.fecha_baja IS NULL) AS promedio_general,
       t.titulado
FROM tray t
JOIN alumnos a ON a.id = t.alumno_id
JOIN carreras ca ON ca.id = t.carrera_id
WHERE t.egresado AND ($1::text IS NULL OR t.o_fin = fn_ciclo_orden($1::text)) AND ($2::text IS NULL OR ca.clave = $2)
ORDER BY t.o_fin DESC, ca.clave, a.apellido_1, a.apellido_2, a.nombre`,
    agruparSugerido: ["generacion"],
    vista: { tipo: "barras", x: "generacion", y: "registros" },
  },
  {
    id: "relacion-titulados", grupo: "SEP · Relaciones y control escolar",
    titulo: "Relación de titulados",
    descripcion: "Titulados con CURP, generación, modalidad de titulación, estatus de cédula y promedio general.",
    ayuda: "Base para el registro de títulos y cédulas. La fecha de titulación y el estatus de la cédula se capturan en el sistema nuevo; en lo migrado vienen vacíos.",
    params: [carrera],
    sql: `WITH ${TRAYECTORIA}
SELECT ca.clave AS carrera, ca.rvoe, a.numerocuenta, a.curp, a.apellido_1, a.apellido_2, a.nombre, a.sexo,
       t.generacion, ti.tipo_titulacion AS modalidad, ti.fecha_titulacion, ti.cedula_estatus,
       (SELECT round(avg(i.calificacion_final), 2) FROM inscripcion_materia i
         WHERE i.alumno_id = a.id AND i.aprobada AND i.fecha_baja IS NULL) AS promedio_general
FROM alumnos a
JOIN carreras ca ON ca.id = a.carrera_id
LEFT JOIN tray t ON t.alumno_id = a.id
LEFT JOIN titulacion ti ON ti.alumno_id = a.id
WHERE a.titulado AND ($1::text IS NULL OR ca.clave = $1)
ORDER BY ca.clave, a.apellido_1, a.apellido_2, a.nombre`,
    agruparSugerido: ["carrera", "modalidad"],
    vista: { tipo: "barras", x: "generacion", y: "registros" },
  },
  {
    id: "eficiencia-terminal", grupo: "SEP · Relaciones y control escolar",
    titulo: "Eficiencia terminal por generación",
    descripcion: "De los que ingresaron cada año: cuántos egresaron, se titularon, siguen estudiando o dejaron de inscribirse.",
    ayuda: "Eficiencia terminal = egresados ÷ ingreso de la generación; % titulación = titulados ÷ ingreso. Las generaciones de los últimos 5 años todavía están estudiando, así que sus porcentajes aún van a subir. Lo piden la SEP, los organismos acreditadores (COPAES) y rectoría.",
    params: [carrera],
    sql: `WITH ${TRAYECTORIA}
SELECT t.generacion, count(*) AS ingreso,
       count(*) FILTER (WHERE t.egresado) AS egresados,
       count(*) FILTER (WHERE t.situacion = 'Titulados') AS titulados,
       count(*) FILTER (WHERE t.situacion = 'Egresados sin título') AS egresados_sin_titulo,
       count(*) FILTER (WHERE t.situacion = 'Siguen estudiando') AS siguen_estudiando,
       count(*) FILTER (WHERE t.situacion = 'Dejaron de inscribirse') AS dejaron_de_inscribirse,
       round(100.0 * count(*) FILTER (WHERE t.egresado) / count(*), 1) AS eficiencia_terminal,
       round(100.0 * count(*) FILTER (WHERE t.titulado) / count(*), 1) AS pct_titulacion
FROM tray t JOIN carreras ca ON ca.id = t.carrera_id
WHERE t.generacion >= 2001 AND ($1::text IS NULL OR ca.clave = $1)
GROUP BY t.generacion
ORDER BY t.generacion`,
    vista: { tipo: "linea", x: "generacion", y: "eficiencia_terminal" },
  },
  {
    id: "datos-faltantes", grupo: "SEP · Relaciones y control escolar",
    titulo: "Datos faltantes para la SEP",
    descripcion: "Por carrera: cuántos alumnos no tienen CURP, sexo, fecha de nacimiento o lengua indígena, y cuántas materias no tienen clave SEP.",
    ayuda: "Muestra qué hay que completar antes de entregar los formatos. Sin ciclo cuenta a los alumnos activos; con ciclo, a los inscritos en él. La CURP es el dato más incompleto del sistema anterior.",
    params: [ciclo],
    sql: `WITH al AS (
  SELECT a.* FROM alumnos a
  WHERE ($1::text IS NULL AND a.activo)
     OR EXISTS (SELECT 1 FROM inscripcion_materia i JOIN ciclos_escolares c ON c.id = i.ciclo_id
                WHERE i.alumno_id = a.id AND c.clave = $1::text)
)
SELECT ca.clave AS carrera, ca.nombre AS nombre_carrera, count(al.id) AS alumnos,
       count(al.id) FILTER (WHERE al.curp IS NULL) AS sin_curp,
       count(al.id) FILTER (WHERE al.sexo IS NULL) AS sin_sexo,
       count(al.id) FILTER (WHERE al.fecha_nacimiento IS NULL) AS sin_fecha_nacimiento,
       count(al.id) FILTER (WHERE al.habla_lengua_indigena IS NULL) AS sin_lengua_indigena,
       round(100.0 * count(al.id) FILTER (WHERE al.curp IS NOT NULL AND al.sexo IS NOT NULL AND al.fecha_nacimiento IS NOT NULL)
             / nullif(count(al.id), 0), 1) AS pct_completos,
       (SELECT count(*) FROM materias m WHERE m.carrera_id = ca.id AND m.activo AND m.clave_sep IS NULL) AS materias_sin_clave_sep
FROM carreras ca
JOIN al ON al.carrera_id = ca.id
GROUP BY ca.id
ORDER BY ca.clave`,
    vista: { tipo: "barras", x: "carrera", y: "sin_curp" },
  },
  {
    id: "layout-sep", funcion: "sp_layout_sep", grupo: "SEP · Relaciones y control escolar",
    titulo: "Concentrado de calificaciones para la SEP",
    descripcion: "Alumnos y materias con calificación, con la clave SEP de cada materia.",
    ayuda: "La columna «clave_sep» está vacía hasta que UNIMES envíe las claves SEP de las materias. Exporta a Excel para entregarlo.",
    params: [carrera, ciclo],
  },

  // ------------------------------------------------------------------ Evaluación docente
  {
    id: "evaluacion-docente", funcion: "sp_resultados_evaluacion_docente", grupo: "Evaluación docente",
    titulo: "Resultados de la evaluación docente",
    descripcion: "Promedio por pregunta, docente y materia.",
    ayuda: "No hay datos todavía: falta cargar las preguntas de la encuesta que enviará UNIMES.",
    params: [
      { ...ciclo, requerido: true },
      { nombre: "p_numero_parcial", etiqueta: "Parcial", tipo: "numero" },
      { nombre: "p_docente_clave", etiqueta: "Clave del docente", tipo: "texto" },
    ],
  },
];

const CAST: Record<TipoParam, string> = {
  texto: "text", numero: "numeric", fecha: "date", booleano: "boolean", carrera: "text", ciclo: "text", opcion: "text",
};

function valor(prm: Param, v: string | undefined): unknown {
  const t = v?.trim();
  if (!t) {
    if (prm.requerido) throw new Error(`Falta «${prm.etiqueta}»`);
    return null;
  }
  return prm.tipo === "booleano" ? t === "true" : t;
}

/** Arma la consulta del reporte. Funciones: notación de nombre con los parámetros que traen valor. */
export function armarLlamada(p: Procedimiento, valores: Record<string, string | undefined>) {
  if (p.sql) {
    return { texto: p.sql, params: p.params.map((prm) => valor(prm, valores[prm.nombre])) };
  }
  const args: string[] = [];
  const params: unknown[] = [];
  for (const prm of p.params) {
    const v = valor(prm, valores[prm.nombre]);
    if (v === null) continue;
    params.push(v);
    // p_numero_parcial y p_oferta_grupo_id son integer en la función
    const cast = prm.tipo === "numero" && /_id$|numero_parcial/.test(prm.nombre) ? "integer" : CAST[prm.tipo];
    args.push(`${prm.nombre} => $${params.length}::${cast}`);
  }
  return { texto: `SELECT * FROM ${p.funcion}(${args.join(", ")})`, params };
}

/** Versión legible de la llamada (solo para mostrar; la ejecución usa parámetros). */
export function llamadaLegible(texto: string, params: unknown[]): string {
  return (
    texto.replace(/\$(\d+)(::\w+)?/g, (_, n) => {
      const v = params[Number(n) - 1];
      if (v === null || v === undefined) return "NULL";
      return typeof v === "boolean" ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
    }) + ";"
  );
}
