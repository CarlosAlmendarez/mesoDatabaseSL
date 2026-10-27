// Explicación del modelo de datos para el apartado «Modelo de datos». La estructura (columnas, llaves,
// relaciones y conteos) se lee en vivo de la base; aquí solo va lo que la base no sabe: para qué sirve
// cada tabla, por qué existe y de qué parte del sistema anterior salieron sus datos.
// Fuentes: db/mapeo_fase2.md, las migraciones 0001–0016 y las decisiones de las reuniones con UNIMES.

import { SERIES } from "./paleta";

export type Area = { id: string; nombre: string; color: string; descripcion: string };

export const AREAS: Area[] = [
  { id: "alumnos", nombre: "Alumnos", color: SERIES[0], descripcion: "El expediente de cada alumno y lo que cuelga de él." },
  { id: "plan", nombre: "Plan de estudios", color: SERIES[1], descripcion: "Carreras, materias y ciclos: la estructura académica." },
  { id: "grupos", nombre: "Grupos y exámenes", color: SERIES[2], descripcion: "Qué se abrió en cada ciclo, con qué docente, horario y calendario de exámenes." },
  { id: "historial", nombre: "Historial y calificaciones", color: SERIES[3], descripcion: "Las materias que cursó cada alumno y cada calificación que obtuvo." },
  { id: "docentes", nombre: "Docentes", color: SERIES[4], descripcion: "Catedráticos, su antigüedad y sus asistencias." },
  { id: "egreso", nombre: "Egreso y vinculación", color: SERIES[5], descripcion: "Titulación, prácticas, servicio social, empresas y revalidaciones." },
  { id: "evaluacion", nombre: "Evaluación docente", color: SERIES[6], descripcion: "Cuestionarios con los que los alumnos califican a sus docentes (nuevo)." },
  { id: "catalogos", nombre: "Catálogos y parámetros", color: "#7a828e", descripcion: "Listas cerradas de valores y reglas del reglamento editables." },
];

export type InfoTabla = {
  area: string;
  titulo: string;
  /** Qué guarda (una o dos frases). */
  que: string;
  /** Por qué existe como tabla aparte: la decisión de diseño. */
  porque: string;
  /** De dónde vienen sus datos en el sistema anterior, o «se captura en el sistema nuevo». */
  origen: string;
  /** Notas de columnas que no se explican solas. */
  columnas?: Record<string, string>;
};

const SIN_ORIGEN = "No existía en el sistema anterior: es nueva y se llena desde el sistema nuevo.";

export const TABLAS: Record<string, InfoTabla> = {
  // ── Alumnos ───────────────────────────────────────────────────────────────
  alumnos: {
    area: "alumnos",
    titulo: "Alumnos (expediente)",
    que: "Una fila por alumno con sus datos personales, de contacto, escolares previos y su carrera.",
    porque: "En el sistema anterior el mismo alumno aparecía en varias carpetas (expediente, bajas, egresados, Web) con datos distintos. Aquí hay una sola fila por matrícula y todo lo demás se liga a ella.",
    origen: "Tabla «datosgenerales» de los expedientes .mdb (archexpe, titulo, regstemp y Web). Si el alumno estaba en varias carpetas se tomó el primer dato no vacío en este orden: egresado > baja > revalidación > archivado > Web.",
    columnas: {
      numerocuenta: "Matrícula del alumno, tal cual venía (no se rellenó con ceros).",
      curp: "Solo se cargó si medía 18 caracteres; los valores incompletos quedaron vacíos y registrados como incidencia.",
      sexo: "FEMENINO → mujer, MASCULINO → hombre; vacío si no se capturó.",
      lugar_nacimiento: "En el sistema anterior el campo se llamaba «nacimiento» pero guardaba el lugar, no la fecha.",
      correo: "Solo se cargó si contenía @ (había valores como «a» o «aa»).",
      promedio_secundaria: "Escala 0–10; valores en escala 0–100 se convirtieron.",
      promedio_preparatoria: "Escala 0–10; valores en escala 0–100 se convirtieron.",
      fecha_inscripcion: "Las fechas capturadas con año 2094–2099 se corrigieron restando 100 años (decisión del 7-oct).",
      tipo_alumno: "Solo REGULAR o IRREGULAR; los valores True/False del sistema anterior quedaron vacíos.",
      generacion: "Texto tal como se capturó en el sistema anterior (p. ej. «00-04»).",
      activo: "Se derivó de la carpeta donde estaba el expediente: egresados y bajas → no activo.",
      titulado: "Campo «Titulado» del expediente (SI → sí).",
      habla_lengua_indigena: "Nuevo, para la estadística de la SEP. El sistema anterior no lo tenía.",
      lengua_indigena_id: "Nuevo, para la estadística de la SEP. El catálogo de lenguas lo enviará UNIMES.",
      discapacidad_id: "Nuevo, para la estadística de la SEP. El sistema anterior no lo tenía.",
    },
  },
  alumno_tutor: {
    area: "alumnos",
    titulo: "Tutor del alumno",
    que: "Padre, madre o tutor del alumno con sus datos de contacto y trabajo.",
    porque: "Separar al tutor permite registrar más de uno y no repetir sus columnas vacías en cada alumno.",
    origen: "Bloque de campos «…tutor» de «datosgenerales». Se creó una fila solo cuando venía nombre o apellido del tutor.",
  },
  alumno_documento: {
    area: "alumnos",
    titulo: "Documentos entregados",
    que: "Qué documentos entregó el alumno: acta, CURP, certificados, fotos y carta de conducta.",
    porque: "Es una lista de verificación que crece con el tiempo; tenerla aparte mantiene el expediente limpio.",
    origen: "Campos certsec, certprep, certparcial, fotos, FotosTitulo y conducta de «datosgenerales». «Certificado total» no existía: quedó en No.",
  },
  becas: {
    area: "alumnos",
    titulo: "Becas",
    que: "Beca asignada a un alumno en un ciclo: tipo, porcentaje, horas y perfil socioeconómico.",
    porque: "Un alumno puede tener beca en varios ciclos, así que se registra una fila por alumno y ciclo.",
    origen: "becarios.mdb (166 filas; 6 duplicados de matrícula y ciclo quedaron registrados como incidencia).",
    columnas: {
      perfil_socioeconomico: "Gastos, ingresos, dependientes, vivienda y transporte del estudio socioeconómico, agrupados.",
      datos_adicionales: "Actividades, valoraciones y promedios que traía el formato anterior, sin perder ninguno.",
    },
  },
  colegiatura: {
    area: "alumnos",
    titulo: "Colegiatura",
    que: "Estado de pago de colegiatura del alumno por ciclo.",
    porque: "Prevista para el sistema completo. Está vacía a propósito.",
    origen: "No se migró: las 7,405 filas del sistema anterior eran del ciclo 03-2 con todos los meses en «No pagado», y UNIMES confirmó el 21-oct que no se usa.",
  },
  colegiatura_parcialidad: {
    area: "alumnos",
    titulo: "Parcialidades de colegiatura",
    que: "Cada pago parcial de una colegiatura.",
    porque: "Detalle de la tabla de colegiatura (una colegiatura, varias parcialidades).",
    origen: "Vacía por la misma razón que colegiatura.",
  },

  // ── Plan de estudios ──────────────────────────────────────────────────────
  carreras: {
    area: "plan",
    titulo: "Carreras y planes",
    que: "Cada plan de estudios con su clave, nombre, RVOE, número de semestres y si es plan nuevo o anterior.",
    porque: "Una misma licenciatura puede tener varios planes (p. ej. Derecho 05, 50 y 55). Cada plan es una fila; «carrera base» está lista para ligarlos (aún sin capturar, por ahora se agrupan por nombre).",
    origen: "Catálogo oficial de planes con claves entregado por UNIMES el 8-oct (Excel), con las correcciones de la reunión del 21-oct. El catálogo del sistema anterior está en opciones.mdb, protegida con contraseña.",
    columnas: {
      carrera_base_id: "Plan anterior o equivalente de la misma licenciatura (liga a esta misma tabla).",
      version_plan: "NUEVO o VIEJO según el catálogo oficial.",
      num_semestres: "Duración del plan; se usa para saber si un alumno llegó al último semestre.",
    },
  },
  materias: {
    area: "plan",
    titulo: "Materias del plan",
    que: "Cada materia de cada plan: clave, nombre, semestre, horas y créditos.",
    porque: "Las calificaciones y los grupos apuntan a la materia, así su nombre y sus horas se capturan una sola vez.",
    origen: "Archivos de plan por carrera ({clave}{abreviatura}.mdb). Las materias que aparecían en calificaciones pero no en ningún plan se crearon desde el historial y quedaron listadas para revisión.",
    columnas: {
      clave_sep: "Clave de la materia ante la SEP. El sistema anterior no la tenía: hay que capturarla.",
      doble_grupo: "Campo «doblegrupo» del plan.",
    },
  },
  materia_seriacion: {
    area: "plan",
    titulo: "Seriación de materias",
    que: "Qué materia hay que aprobar antes de cursar otra.",
    porque: "Una materia puede tener varios requisitos; una tabla aparte los guarda sin límite.",
    origen: "Columna «seriacion» de los archivos de plan (NS = sin seriación).",
  },
  ciclos_escolares: {
    area: "plan",
    titulo: "Ciclos escolares",
    que: "Cada ciclo (24-1, 24-2…). El AA-1 empieza en agosto del año anterior y el AA-2 en enero.",
    porque: "Inscripciones, grupos, becas y exámenes se ligan al ciclo, y aquí se podrán guardar sus fechas.",
    origen: "Todos los ciclos que aparecen en calificaciones, grupos, becas y calendario. Las fechas de cada ciclo están en opciones.mdb (protegida), así que siguen vacías.",
    columnas: { clave: "Ciclo como lo escribía el sistema anterior: año de dos dígitos y periodo." },
  },

  // ── Grupos y exámenes ─────────────────────────────────────────────────────
  oferta_grupo: {
    area: "grupos",
    titulo: "Grupos abiertos",
    que: "Cada grupo que se abrió en un ciclo para una materia: grupo, turno, semestre, docente y horas.",
    porque: "Es el punto donde se juntan ciclo, materia y docente; de él cuelgan horarios, exámenes y asistencia.",
    origen: "Archivos de horarios por carrera ({clave}hora.mdb, «patrón B») y grupos que se deducen del calendario de exámenes.",
    columnas: { capacidad_grupo: "Nuevo: el sistema anterior no lo guardaba." },
  },
  oferta_grupo_carrera: {
    area: "grupos",
    titulo: "Grupo compartido entre carreras",
    que: "Qué carreras toman un mismo grupo.",
    porque: "Un grupo puede ser común a varias carreras; antes se repetía en cada archivo y aquí es uno solo.",
    origen: "Columna «licenciatura» de los archivos de horarios.",
  },
  horario_clase: {
    area: "grupos",
    titulo: "Horario de clase",
    que: "Día, hora y aula de cada grupo.",
    porque: "Un grupo tiene varias sesiones a la semana; cada una es una fila.",
    origen: "Vacía: los horarios de la carpeta Web eran un resumen para la página web, sin uso (UNIMES, 21-oct).",
  },
  evento_examen: {
    area: "grupos",
    titulo: "Calendario de exámenes",
    que: "Fecha, hora y docente de cada examen parcial u ordinario de un grupo.",
    porque: "Permite detectar choques de horario y ligar cada calificación con el examen en que se obtuvo.",
    origen: "horaexam*.mdb (59,665 filas, casi todas copias). Las claves antiguas del plantel de Oaxaca se excluyeron; lo demás (98-2 a 04-1) quedó cargado como por clasificar.",
  },

  // ── Historial y calificaciones ────────────────────────────────────────────
  inscripcion_materia: {
    area: "historial",
    titulo: "Materias inscritas (historial)",
    que: "Cada materia que cursó un alumno en un ciclo, con su calificación final y si la aprobó.",
    porque: "Es el corazón del kárdex. En el sistema anterior había una tabla por alumno; aquí todas están en una sola y se pueden consultar juntas.",
    origen: "Las tablas de calificaciones de cada carrera, una por alumno nombrada con su matrícula («patrón A», 734,188 filas). No se cargaron las materias precargadas del plan que el alumno nunca cursó, ni los duplicados entre carpetas.",
    columnas: {
      calificacion_final: "Columna «cf» del sistema anterior: la calificación definitiva (escala 0–10).",
      aprobada: "Columna «pasado» del sistema anterior.",
      revision: "Símbolo original de la columna «rev» (. / Y X -), sin cambios. Su significado está en forma de aprobación.",
      forma_aprobacion_id: "Significado del símbolo «rev»: en curso, equivalencia, regularización…",
      fecha_baja: "Nuevo: fecha en que el alumno dio de baja la materia.",
      motivo_baja: "Nuevo: motivo de la baja de la materia.",
    },
  },
  intento_calificacion: {
    area: "historial",
    titulo: "Calificaciones (parciales y extraordinarios)",
    que: "Cada calificación de una materia inscrita: primer y segundo parcial, final y extraordinarios, con asistencias y faltas.",
    porque: "Antes cada intento era una columna (c1, c2, c3, cf1, cf2, cf3). Como filas se puede agregar un intento nuevo sin cambiar la estructura y saber quién autorizó un tercer extraordinario.",
    origen: "Las mismas tablas de calificaciones: c1 → parcial 1, c2 → parcial 2, c3 → final, cf1–cf3 → extraordinarios 1 a 3, cada uno con el ciclo en que se presentó.",
    columnas: {
      calificacion: "Escala 0–10. Valores en escala 0–100 se convirtieron; los que no tenían arreglo quedaron vacíos y registrados.",
      autorizado_por: "Quién autorizó el intento. El sistema anterior no lo registraba.",
      ciclo_id: "Ciclo en que se presentó: en el sistema anterior las columnas «2fecha», «3fecha» y «4fecha» guardaban el ciclo, no una fecha.",
    },
  },

  // ── Docentes ──────────────────────────────────────────────────────────────
  docentes: {
    area: "docentes",
    titulo: "Docentes",
    que: "Cada catedrático con su clave, nombre, profesión, grado y datos de contacto.",
    porque: "Grupos, calificaciones, exámenes y evaluaciones apuntan al docente; su nombre se escribe una sola vez.",
    origen: "Cate_Biblio.mdb y creden2.mdb (Catedraticos), más los docentes que solo aparecían citados en calificaciones con su clave. El nombre se guardó completo, sin partirlo.",
    columnas: {
      sexo: "El sistema anterior no lo tenía: hay que capturarlo para el formato 911.",
      grado_academico: "El sistema anterior no lo tenía: hay que capturarlo para el formato 911.",
      tipo_grado_id: "Nivel del grado (licenciatura, maestría, doctorado…).",
    },
  },
  docente_antiguedad: {
    area: "docentes",
    titulo: "Antigüedad docente",
    que: "Periodos en que el docente ha dado clases: ciclo de ingreso, de salida y motivo.",
    porque: "Un docente puede irse y regresar; cada periodo es una fila y la antigüedad total se suma.",
    origen: SIN_ORIGEN,
  },
  asistencia_catedratico: {
    area: "docentes",
    titulo: "Asistencia del catedrático",
    que: "Faltas, adelantos y reposiciones de clase de cada docente por grupo.",
    porque: "Sirve para el pago por horas y para la estadística de cumplimiento.",
    origen: "contarep.mdb: cada movimiento con fecha se convirtió en una fila (por eso hay más filas cargadas que leídas).",
  },

  // ── Egreso y vinculación ──────────────────────────────────────────────────
  titulacion: {
    area: "egreso",
    titulo: "Titulación",
    que: "Modalidad de titulación (tesis, curso, maestría…), fechas y estatus de la cédula.",
    porque: "Separa el proceso de titulación del expediente para seguir sus etapas.",
    origen: "Campo FormaTitulacion de «datosgenerales» (carpeta titulo). Los «pasos» del sistema anterior no se migraron: UNIMES indicó que no se usan.",
    columnas: { cedula_estatus: "Nuevo (7-oct): tiene, solicitada, en trámite o no. El sistema anterior no lo traía." },
  },
  encuesta_egresado: {
    area: "egreso",
    titulo: "Seguimiento de egresados",
    que: "Si el egresado trabaja, dónde, en qué puesto y cómo localizarlo.",
    porque: "Un egresado puede contestar la encuesta más de una vez.",
    origen: "Campos Trabaja, Donde, Puesto, Antiguedad y Direcciontrabajo de «datosgenerales» de egresados. Se creó una fila solo cuando había algún dato de empleo.",
  },
  empresa: {
    area: "egreso",
    titulo: "Empresas e instituciones",
    que: "Empresas donde los alumnos hacen prácticas o servicio social, o donde trabajan los egresados.",
    porque: "La misma empresa se repetía escrita a mano en cada alumno; aquí se captura una vez.",
    origen: "Nombres de institución de prácticas y servicio social, unificados por nombre.",
  },
  practica_servicio: {
    area: "egreso",
    titulo: "Prácticas y servicio social",
    que: "Prácticas profesionales y servicio social de cada alumno: empresa, fechas, cargo y cartas entregadas.",
    porque: "Un alumno tiene al menos dos (prácticas y servicio); con «tipo» caben en la misma tabla.",
    origen: "practicasyservicio de cada carrera: los campos P* son prácticas y los S* servicio social.",
  },
  revalidacion: {
    area: "egreso",
    titulo: "Revalidación de estudios",
    que: "Oficio, fecha e institución de origen de los alumnos que revalidaron estudios.",
    porque: "Solo aplica a algunos alumnos; tenerla aparte evita columnas vacías en el expediente.",
    origen: "Campos «Oficio de Revalidación» y «Fecha de Revalidación» de «datosgenerales» (carpeta REVALID).",
  },
  materias_revalidadas: {
    area: "egreso",
    titulo: "Materias revalidadas",
    que: "Qué materias de la otra institución se revalidaron y por cuáles del plan.",
    porque: "Detalle de la revalidación.",
    origen: "Vacía: el sistema anterior no guardaba el detalle por materia.",
  },

  // ── Evaluación docente ────────────────────────────────────────────────────
  evaluacion_cuestionario: {
    area: "evaluacion",
    titulo: "Cuestionarios de evaluación",
    que: "Cada versión del cuestionario con el que los alumnos evalúan al docente, por parcial.",
    porque: "Si cambian las preguntas se crea una versión nueva y las respuestas anteriores siguen siendo válidas.",
    origen: SIN_ORIGEN + " Se pidió en la reunión del 14-oct.",
  },
  evaluacion_pregunta: {
    area: "evaluacion",
    titulo: "Preguntas",
    que: "Las preguntas de cada cuestionario, con su escala (1–10) o texto abierto.",
    porque: "Cada cuestionario tiene un número variable de preguntas (9 en el primer parcial, 10 en el segundo).",
    origen: SIN_ORIGEN,
  },
  evaluacion_respuesta: {
    area: "evaluacion",
    titulo: "Respuestas (encabezado)",
    que: "Una evaluación contestada: qué alumno evaluó a qué docente, en qué grupo y cuándo.",
    porque: "Agrupa las respuestas de una misma evaluación.",
    origen: SIN_ORIGEN,
  },
  evaluacion_respuesta_detalle: {
    area: "evaluacion",
    titulo: "Respuestas (detalle)",
    que: "La respuesta a cada pregunta.",
    porque: "Una fila por pregunta permite promediar por pregunta, docente o grupo.",
    origen: SIN_ORIGEN,
  },

  // ── Catálogos ─────────────────────────────────────────────────────────────
  cat_turno: {
    area: "catalogos",
    titulo: "Turnos",
    que: "Matutino, vespertino y mixto.",
    porque: "Lista cerrada: evita que el mismo turno se escriba de varias formas.",
    origen: "Valores de turno que aparecen en el sistema anterior.",
  },
  cat_tipo_intento: {
    area: "catalogos",
    titulo: "Tipos de calificación",
    que: "Parcial 1, parcial 2, final, extraordinarios 1 a 3 y otros, con su orden y si requieren autorización (el extraordinario 3 sí).",
    porque: "Define qué intentos existen sin cambiar la estructura de la tabla de calificaciones.",
    origen: "Definido con Control Escolar a partir de las columnas c1…cf3 del sistema anterior.",
  },
  cat_forma_aprobacion: {
    area: "catalogos",
    titulo: "Forma de aprobación",
    que: "Significado del símbolo «rev» del historial: en curso, equivalencia, regularización…",
    porque: "El símbolo se conserva tal cual en el historial y este catálogo lo traduce.",
    origen: "Explicado por Control Escolar en la reunión del 7-oct.",
  },
  cat_tipo_asistencia: {
    area: "catalogos",
    titulo: "Tipos de asistencia docente",
    que: "Falta, reposición, adelanto, recuperación, retardo y otros.",
    porque: "Lista cerrada para la asistencia del catedrático.",
    origen: "Columnas de contarep.mdb más «otros» (reunión del 31-ago).",
  },
  cat_tipo_grado: {
    area: "catalogos",
    titulo: "Grados académicos",
    que: "Licenciatura, maestría, doctorado… (por capturar).",
    porque: "Lista cerrada para el grado del docente (formato 911).",
    origen: SIN_ORIGEN,
  },
  cat_discapacidad: {
    area: "catalogos",
    titulo: "Discapacidades",
    que: "Tipos de discapacidad para la estadística de la SEP (por capturar).",
    porque: "Lista cerrada compartida por alumnos y docentes.",
    origen: SIN_ORIGEN,
  },
  cat_lengua_indigena: {
    area: "catalogos",
    titulo: "Lenguas indígenas",
    que: "Lenguas indígenas para la estadística de la SEP.",
    porque: "Lista cerrada para el dato del alumno.",
    origen: "Pendiente: UNIMES enviará el catálogo que usa para su estadística (14-oct).",
  },
  parametro: {
    area: "catalogos",
    titulo: "Parámetros del reglamento",
    que: "Reglas que cambian con el reglamento: tope de créditos, % del plan para servicio, días para dar de baja una materia…",
    porque: "Se pueden ajustar sin modificar la base ni el sistema.",
    origen: "Valores acordados en las reuniones con UNIMES (la columna «fuente» dice en cuál y en qué minuto).",
  },
};

/** Explicación de columnas que se repiten en casi todas las tablas. */
export const COLUMNAS_COMUNES: Record<string, string> = {
  id: "Identificador interno; lo asigna la base.",
  created_at: "Cuándo se creó el registro (automático).",
  updated_at: "Cuándo se modificó por última vez (automático).",
  activo: "Si el registro está vigente.",
  clave: "Clave con la que se identifica en Control Escolar.",
  nombre: "Nombre.",
};

/** Columnas del diagrama, de izquierda a derecha (las tablas se apilan de arriba abajo). */
export const DISPOSICION: string[][] = [
  ["titulacion", "encuesta_egresado", "empresa", "practica_servicio", "revalidacion", "materias_revalidadas"],
  ["alumno_tutor", "alumno_documento", "alumnos", "becas", "colegiatura", "colegiatura_parcialidad"],
  ["inscripcion_materia", "intento_calificacion", "evaluacion_respuesta", "evaluacion_respuesta_detalle"],
  ["materias", "materia_seriacion", "oferta_grupo", "oferta_grupo_carrera", "horario_clase", "evento_examen"],
  ["carreras", "ciclos_escolares", "docentes", "docente_antiguedad", "asistencia_catedratico", "evaluacion_cuestionario", "evaluacion_pregunta"],
  ["cat_turno", "cat_tipo_intento", "cat_forma_aprobacion", "cat_tipo_asistencia", "cat_tipo_grado", "cat_discapacidad", "cat_lengua_indigena", "parametro"],
];

/** Tipo de Postgres en palabras. */
export function tipoLegible(t: string): string {
  if (/^(integer|smallint|bigint)$/.test(t)) return "Número entero";
  if (t.startsWith("numeric")) return "Número";
  if (t === "text" || t.startsWith("character")) return "Texto";
  if (t === "date") return "Fecha";
  if (t.startsWith("timestamp")) return "Fecha y hora";
  if (t.startsWith("time")) return "Hora";
  if (t === "boolean") return "Sí / No";
  if (t === "jsonb" || t === "json") return "Datos agrupados";
  return t;
}
