// Catálogo de procedimientos de consulta (migración 0015 de la base). La app arma el formulario
// y la llamada a partir de esta lista: los nombres de función y parámetros son fijos, los valores
// siempre viajan como parámetros ($1, $2…).

export type TipoParam = "texto" | "numero" | "fecha" | "booleano" | "carrera" | "ciclo" | "opcion";

export type Param = {
  nombre: string; // nombre del parámetro en la función (p_…)
  etiqueta: string;
  tipo: TipoParam;
  requerido?: boolean;
  opciones?: { valor: string; etiqueta: string }[];
  ejemplo?: string;
};

export type Procedimiento = {
  id: string;
  funcion: string;
  titulo: string;
  descripcion: string;
  grupo: string;
  params: Param[];
};

export const GRUPOS = [
  "Alumnos e historial",
  "Grupos y ciclos",
  "Docentes",
  "Becas, servicio y titulación",
  "SEP y estadística",
  "Evaluación docente",
] as const;

export const PROCEDIMIENTOS: Procedimiento[] = [
  {
    id: "historial", funcion: "sp_historial_academico", grupo: "Alumnos e historial",
    titulo: "Historial académico (kárdex)",
    descripcion: "Todas las materias del alumno con parciales, extraordinarios, calificación final y forma de aprobación.",
    params: [{ nombre: "p_numerocuenta", etiqueta: "Matrícula", tipo: "texto", requerido: true, ejemplo: "21102010" }],
  },
  {
    id: "promedio", funcion: "sp_promedio_alumno", grupo: "Alumnos e historial",
    titulo: "Promedio por ciclo y general",
    descripcion: "Promedio del alumno en cada ciclo y el general.",
    params: [
      { nombre: "p_numerocuenta", etiqueta: "Matrícula", tipo: "texto", requerido: true, ejemplo: "21102010" },
      { nombre: "p_ciclo", etiqueta: "Ciclo", tipo: "ciclo" },
      { nombre: "p_solo_acreditadas", etiqueta: "Solo materias acreditadas", tipo: "booleano" },
    ],
  },
  {
    id: "riesgo", funcion: "sp_alumnos_en_riesgo", grupo: "Alumnos e historial",
    titulo: "Alumnos en riesgo",
    descripcion: "Alumnos activos con materias no acreditadas y oportunidades de excepción usadas.",
    params: [{ nombre: "p_carrera", etiqueta: "Carrera", tipo: "carrera" }],
  },
  {
    id: "buscar", funcion: "sp_buscar_alumnos", grupo: "Alumnos e historial",
    titulo: "Búsqueda de alumnos",
    descripcion: "Filtros libres: nombre o matrícula, carrera, fechas de ingreso, sexo, activos y titulados.",
    params: [
      { nombre: "p_texto", etiqueta: "Nombre o matrícula", tipo: "texto" },
      { nombre: "p_carrera", etiqueta: "Carrera", tipo: "carrera" },
      { nombre: "p_ingreso_desde", etiqueta: "Ingreso desde", tipo: "fecha" },
      { nombre: "p_ingreso_hasta", etiqueta: "Ingreso hasta", tipo: "fecha" },
      {
        nombre: "p_sexo", etiqueta: "Sexo", tipo: "opcion",
        opciones: [{ valor: "hombre", etiqueta: "Hombre" }, { valor: "mujer", etiqueta: "Mujer" }],
      },
      { nombre: "p_activo", etiqueta: "Activo", tipo: "booleano" },
      { nombre: "p_titulado", etiqueta: "Titulado", tipo: "booleano" },
    ],
  },
  {
    id: "inscritos", funcion: "sp_inscritos_por_ciclo", grupo: "Grupos y ciclos",
    titulo: "Inscritos por ciclo",
    descripcion: "Alumnos e inscripciones por ciclo, carrera y semestre.",
    params: [{ nombre: "p_ciclo", etiqueta: "Ciclo", tipo: "ciclo" }],
  },
  {
    id: "lista-grupo", funcion: "sp_lista_grupo", grupo: "Grupos y ciclos",
    titulo: "Lista de un grupo",
    descripcion: "Lista de asistencia del grupo, separada por licenciatura en grupos combinados.",
    params: [
      { nombre: "p_oferta_grupo_id", etiqueta: "Id del grupo", tipo: "numero", requerido: true },
      { nombre: "p_carrera", etiqueta: "Carrera", tipo: "carrera" },
    ],
  },
  {
    id: "asistencia-docente", funcion: "sp_reporte_asistencia_docente", grupo: "Docentes",
    titulo: "Asistencia docente (contabilidad)",
    descripcion: "Faltas, retardos, reposiciones y adelantos por docente y materia en un periodo.",
    params: [
      { nombre: "p_desde", etiqueta: "Desde", tipo: "fecha", requerido: true, ejemplo: "2023-01-01" },
      { nombre: "p_hasta", etiqueta: "Hasta", tipo: "fecha", requerido: true, ejemplo: "2024-12-31" },
      { nombre: "p_docente_clave", etiqueta: "Clave del docente", tipo: "texto" },
    ],
  },
  {
    id: "constancia-docente", funcion: "sp_constancia_docente", grupo: "Docentes",
    titulo: "Constancia de trabajo",
    descripcion: "Periodos y ciclos en que el docente impartió clases, aunque ya no esté activo.",
    params: [{ nombre: "p_docente_clave", etiqueta: "Clave del docente", tipo: "texto", requerido: true, ejemplo: "0320011" }],
  },
  {
    id: "ranking-becas", funcion: "sp_ranking_becas", grupo: "Becas, servicio y titulación",
    titulo: "Ranking para becas",
    descripcion: "Alumnos ordenados por promedio del ciclo, por carrera, con su beca actual.",
    params: [
      { nombre: "p_ciclo", etiqueta: "Ciclo", tipo: "ciclo", requerido: true },
      { nombre: "p_carrera", etiqueta: "Carrera", tipo: "carrera" },
      { nombre: "p_promedio_minimo", etiqueta: "Promedio mínimo", tipo: "numero" },
    ],
  },
  {
    id: "elegibles-servicio", funcion: "sp_elegibles_practica_servicio", grupo: "Becas, servicio y titulación",
    titulo: "Elegibles para servicio o prácticas",
    descripcion: "Alumnos con 70 % del plan acreditado y desde 5.º semestre.",
    params: [
      {
        nombre: "p_tipo", etiqueta: "Tipo", tipo: "opcion",
        opciones: [{ valor: "servicio_social", etiqueta: "Servicio social" }, { valor: "practica", etiqueta: "Prácticas profesionales" }],
      },
      { nombre: "p_carrera", etiqueta: "Carrera", tipo: "carrera" },
    ],
  },
  {
    id: "candidatos-titulacion", funcion: "sp_candidatos_titulacion", grupo: "Becas, servicio y titulación",
    titulo: "Candidatos a titulación",
    descripcion: "Qué le falta a cada alumno: materias, servicio, prácticas, fotografías o certificado.",
    params: [
      { nombre: "p_carrera", etiqueta: "Carrera", tipo: "carrera" },
      { nombre: "p_solo_candidatos", etiqueta: "Solo candidatos", tipo: "booleano" },
    ],
  },
  {
    id: "cedula", funcion: "sp_seguimiento_cedula", grupo: "Becas, servicio y titulación",
    titulo: "Seguimiento de cédula profesional",
    descripcion: "Titulados con el estatus de su cédula.",
    params: [
      { nombre: "p_carrera", etiqueta: "Carrera", tipo: "carrera" },
      {
        nombre: "p_estatus", etiqueta: "Estatus", tipo: "opcion",
        opciones: ["TIENE", "SOLICITADA", "EN_TRAMITE", "NO", "SIN_DATO"].map((v) => ({ valor: v, etiqueta: v })),
      },
    ],
  },
  {
    id: "layout-sep", funcion: "sp_layout_sep", grupo: "SEP y estadística",
    titulo: "Concentrado para la SEP",
    descripcion: "Alumnos y materias con calificación, con la clave SEP de cada materia.",
    params: [
      { nombre: "p_carrera", etiqueta: "Carrera", tipo: "carrera" },
      { nombre: "p_ciclo", etiqueta: "Ciclo", tipo: "ciclo" },
    ],
  },
  {
    id: "estadistica", funcion: "sp_estadistica_alumnos", grupo: "SEP y estadística",
    titulo: "Estadística de alumnos",
    descripcion: "Conteo y promedio por carrera, sexo, edad, discapacidad y lengua indígena.",
    params: [
      { nombre: "p_carrera", etiqueta: "Carrera", tipo: "carrera" },
      { nombre: "p_ciclo", etiqueta: "Ciclo", tipo: "ciclo" },
      { nombre: "p_solo_activos", etiqueta: "Solo activos", tipo: "booleano" },
    ],
  },
  {
    id: "evaluacion-docente", funcion: "sp_resultados_evaluacion_docente", grupo: "Evaluación docente",
    titulo: "Resultados de la evaluación docente",
    descripcion: "Promedio por pregunta, docente y materia (sin datos hasta cargar la encuesta).",
    params: [
      { nombre: "p_ciclo", etiqueta: "Ciclo", tipo: "ciclo", requerido: true },
      { nombre: "p_numero_parcial", etiqueta: "Parcial", tipo: "numero" },
      { nombre: "p_docente_clave", etiqueta: "Clave del docente", tipo: "texto" },
    ],
  },
];

const CAST: Record<TipoParam, string> = {
  texto: "text", numero: "numeric", fecha: "date", booleano: "boolean", carrera: "text", ciclo: "text", opcion: "text",
};

/** Arma la llamada con notación de nombre y solo los parámetros con valor. */
export function armarLlamada(p: Procedimiento, valores: Record<string, string | undefined>) {
  const args: string[] = [];
  const params: unknown[] = [];
  for (const prm of p.params) {
    const v = valores[prm.nombre]?.trim();
    if (!v) {
      if (prm.requerido) throw new Error(`Falta «${prm.etiqueta}»`);
      continue;
    }
    params.push(prm.tipo === "booleano" ? v === "true" : v);
    // p_numero_parcial y p_oferta_grupo_id son integer en la función
    const cast = prm.tipo === "numero" && /_id$|numero_parcial/.test(prm.nombre) ? "integer" : CAST[prm.tipo];
    args.push(`${prm.nombre} => $${params.length}::${cast}`);
  }
  return { texto: `SELECT * FROM ${p.funcion}(${args.join(", ")})`, params };
}
