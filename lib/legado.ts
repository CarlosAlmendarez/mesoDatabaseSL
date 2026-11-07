// Lectura de los archivos .mdb del sistema anterior (Alumnos.exe) para la actualización incremental.
// Corre en el navegador (los archivos no se suben completos: solo viajan los datos que sirven) y en Node
// para pruebas. Solo extrae texto; la limpieza (fechas, escalas, catálogos) la hace la base: carga.sp_procesar.
//
// Mismas reglas que el rescate (rescate_datos.ps1): carpeta → tipo de origen, código de carrera = dos
// dígitos del nombre del archivo, tablas «Patrón A» = historial por alumno (nombre de tabla = matrícula),
// tablas "1".."9" de los archivos de plan (Archivos/01CONTA.mdb…) = materias de cada semestre.

import type MDBReaderType from "mdb-reader";

export type OrigenTipo =
  | "egresado_titulado" | "baja" | "revalidacion" | "expediente_archivado" | "web_copia" | "especiales"
  | "archivos_principal" | "plan_estudios";

export type FilaExpediente = Record<(typeof CAMPOS_EXPEDIENTE)[number], string | null> & Procedencia;
export type FilaHistorial = Record<(typeof CAMPOS_HISTORIAL)[number], string | null> & Procedencia;
export type FilaPlan = Record<(typeof CAMPOS_PLAN)[number], string | null> & Procedencia;
type Procedencia = { ruta: string; origen_tipo: OrigenTipo; carrera_codigo: string; fila: number };

export type ArchivoLeido = {
  ruta: string;
  origen_tipo: OrigenTipo;
  carrera_codigo: string;
  expedientes: FilaExpediente[];
  historial: FilaHistorial[];
  plan: FilaPlan[];
  tablasHistorial: number;
};

/** Columnas de `datosgenerales` que usa la base (destino ← origen). */
const MAPA_EXPEDIENTE: Record<string, string> = {
  numerocuenta: "numerocuenta", nombre: "nombre", apellidopat: "apellidopat", apellidomat: "apellidomat",
  curp: "curp", fecha_nacimiento: "fecha_nacimiento", sexo: "sexo", nacimiento: "nacimiento",
  nacionalidad: "nacionalidad", estadocivil: "estadocivil", telefono: "telefono", correoe: "correoe", calle: "calle",
  colonia: "colonia", poblacion: "poblacion", estado: "estado", codigopostal: "codigopostal", secundaria: "secundaria",
  promediosec: "promediosec", preparatoria: "preparatoria", promedioprep: "promedioprep",
  fechainscripcion: "fechainscripcion", semestreactivo: "semestreactivo", grupo: "grupo", turno: "turno",
  especialidad: "especialidad", tipoalumno: "tipoalumno", generacion: "generacion", titulado: "titulado",
  certsec: "certsec", certprep: "certprep", certparcial: "certparcial", fotos: "fotos", fotostitulo: "fotostitulo",
  conducta: "conducta", fechabaja: "fechabaja", tipobaja: "tipobaja",
};
export const CAMPOS_EXPEDIENTE = [
  "numerocuenta", "nombre", "apellidopat", "apellidomat", "curp", "fecha_nacimiento", "sexo", "nacimiento",
  "nacionalidad", "estadocivil", "telefono", "correoe", "calle", "colonia", "poblacion", "estado", "codigopostal",
  "secundaria", "promediosec", "preparatoria", "promedioprep", "fechainscripcion", "semestreactivo", "grupo", "turno",
  "especialidad", "tipoalumno", "generacion", "titulado", "certsec", "certprep", "certparcial", "fotos",
  "fotostitulo", "conducta", "fechabaja", "tipobaja",
] as const;

/** Historial Patrón A (destino ← columna de la tabla por alumno). */
const MAPA_HISTORIAL: Record<string, string> = {
  clave: "clave", materia: "materia", semestre: "semestre", especialidad: "especialidad", grupo: "grupo",
  turno: "turno", f1: "1fecha", f2: "2fecha", f3: "3fecha", f4: "4fecha", c1: "c1", c2: "c2", c3: "c3", cf: "cf",
  cf1: "cf1", cf2: "cf2", cf3: "cf3", activo: "activo", pasado: "pasado", rev: "rev", catedratico: "catedratico",
  asistencias1: "asistencias1", asistencias2: "asistencias2", asistencias3: "asistencias3",
  faltas1: "faltas1", faltas2: "faltas2", faltas3: "faltas3",
};
export const CAMPOS_HISTORIAL = ["matricula", ...Object.keys(MAPA_HISTORIAL)] as const;
const NOTAS = ["c1", "c2", "c3", "cf", "cf1", "cf2", "cf3"] as const;

/** Plan de estudios: tablas "1".."9" (el nombre es el semestre). */
const MAPA_PLAN: Record<string, string> = {
  materia: "materia", clave: "clave", seriacion: "seriacion", doblegrupo: "doblegrupo",
  horas_semana: "h/s", horas_totales: "h/t", semanas: "s/t", creditos: "creditos",
};
export const CAMPOS_PLAN = ["semestre", ...Object.keys(MAPA_PLAN)] as const;
/** Archivos de plan: dos dígitos + abreviatura (01CONTA, 55DER…); LINF.MDB es el plan de la 42. */
const NOMBRE_PLAN = /^(\d{2})([a-z]+)\.mdb$/i;
const NO_PLAN = /(expe|reva|baja|egre|espe|hora)|(old|ant)$/i;
const PLAN_SIN_CLAVE: Record<string, string> = { LINF: "42" };

// Firma de una tabla Patrón A (rescate_datos.ps1 -Numerico): al menos 22 de estas columnas, 25 a 34 en total.
const FIRMA_A = new Set([
  "materia", "clave", "seriacion", "semestre", "especialidad", "grupo", "1fecha", "c1", "c2", "c3", "cf", "2fecha",
  "cf1", "3fecha", "cf2", "4fecha", "cf3", "activo", "pasado", "rev", "catedratico", "turno", "asistencias1",
  "asistencias2", "asistencias3", "total asistencias", "total faltas", "faltas1", "faltas2", "faltas3",
]);

/** Archivos de expediente por carrera: 01expe, 55reva, 99BAJA, 66EGRE, 60espe… */
const NOMBRE_EXPEDIENTE = /^(\d{2})\D*(expe|reva|baja|egre|espe)\w*\.mdb$/i;
/** Carpetas que no se leen: espejos, respaldos y copias de instalación. */
const CARPETA_EXCLUIDA = /(^|\/)(reportes|respaldo[^/]*|install|ejecutables)\//i;

/** ¿Se lee este archivo? Devuelve su origen o un motivo para omitirlo. */
export function clasificar(ruta: string): { ok: true; origen_tipo: OrigenTipo; carrera_codigo: string } | { ok: false; motivo: string } {
  const r = ruta.replace(/\\/g, "/");
  const partes = r.split("/");
  const nombre = partes.pop() ?? r;
  if (CARPETA_EXCLUIDA.test(r)) return { ok: false, motivo: "copia de respaldo o espejo (carpeta reportes / respaldo)" };
  // Plan de estudios: solo de la carpeta Archivos (o un archivo suelto), sin versiones OLD/ANT.
  const base = nombre.replace(/\.mdb$/i, "");
  const mp = nombre.match(NOMBRE_PLAN);
  const carpeta = partes.length ? partes[partes.length - 1].toLowerCase() : "archivos";
  if (((mp && !NO_PLAN.test(mp[2])) || PLAN_SIN_CLAVE[base.toUpperCase()]) && carpeta === "archivos") {
    return { ok: true, origen_tipo: "plan_estudios", carrera_codigo: mp ? mp[1] : PLAN_SIN_CLAVE[base.toUpperCase()] };
  }
  const m = nombre.match(NOMBRE_EXPEDIENTE);
  if (!m) return { ok: false, motivo: "no es un archivo de expedientes ni de plan de estudios por carrera" };
  const p = r.toLowerCase();
  const tipo = m[2].toLowerCase();
  let origen: OrigenTipo;
  if (/archexpe\/revalid/.test(p)) origen = "revalidacion";
  else if (/archexpe\/regular/.test(p)) origen = "expediente_archivado";
  else if (/regstemp/.test(p) || tipo === "baja") origen = "baja";
  else if (/titulo/.test(p) || tipo === "egre") origen = "egresado_titulado";
  else if (/(^|\/)web\//.test(p)) origen = "web_copia";
  else if (/especiales/.test(p) || tipo === "espe") origen = "especiales";
  else if (tipo === "reva") origen = "revalidacion";
  else origen = "expediente_archivado";   // NNexpe.mdb suelto: expediente vigente
  return { ok: true, origen_tipo: origen, carrera_codigo: m[1] };
}

/** Valor de Access → texto como lo exportaba el rescate. */
function texto(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  if (typeof v === "number") return Number.isFinite(v) ? String(Number(v.toPrecision(7))) : null; // Single de Access: 9.399999… → 9.4
  if (typeof v === "boolean") return v ? "True" : "False";
  const s = String(v).replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
}

/** Lee un .mdb ya cargado en memoria. `Lector` es la clase MDBReader (se pasa para no atar este módulo al bundle). */
export function leerArchivo(
  Lector: typeof MDBReaderType,
  datos: Uint8Array,
  ruta: string,
): ArchivoLeido | { ruta: string; error: string } {
  const c = clasificar(ruta);
  if (!c.ok) return { ruta, error: c.motivo };
  let lector: MDBReaderType;
  try {
    // mdb-reader espera un Buffer; en el navegador se pasa el polyfill (ver el componente de carga).
    lector = new Lector(datos as unknown as Buffer);
  } catch (e) {
    return { ruta, error: `no se pudo abrir (${e instanceof Error ? e.message : e})` };
  }
  const base = { ruta, origen_tipo: c.origen_tipo, carrera_codigo: c.carrera_codigo };
  const expedientes: FilaExpediente[] = [];
  const historial: FilaHistorial[] = [];
  const plan: FilaPlan[] = [];
  let tablasHistorial = 0;

  if (c.origen_tipo === "plan_estudios") {
    for (const nombre of lector.getTableNames()) {
      if (!/^[1-9]$/.test(nombre)) continue;
      const t = lector.getTable(nombre);
      const cols = new Map(t.getColumnNames().map((n) => [n.toLowerCase(), n]));
      if (!cols.has("clave") || !cols.has("materia")) continue;
      t.getData().forEach((r, i) => {
        const fila = { ...base, fila: i + 1, semestre: nombre } as unknown as FilaPlan;
        for (const [dest, orig] of Object.entries(MAPA_PLAN)) {
          const col = cols.get(orig);
          (fila as Record<string, unknown>)[dest] = col ? texto(r[col]) : null;
        }
        if (fila.clave && fila.materia) plan.push(fila);
      });
    }
    return { ...base, expedientes, historial, plan, tablasHistorial };
  }

  for (const nombre of lector.getTableNames()) {
    if (nombre.toLowerCase() === "datosgenerales") {
      const t = lector.getTable(nombre);
      const cols = new Map(t.getColumnNames().map((n) => [n.toLowerCase(), n]));
      t.getData().forEach((r, i) => {
        const fila = { ...base, fila: i + 1 } as FilaExpediente;
        for (const [dest, orig] of Object.entries(MAPA_EXPEDIENTE)) {
          const col = cols.get(orig);
          (fila as Record<string, unknown>)[dest] = col ? texto(r[col]) : null;
        }
        if (fila.numerocuenta) expedientes.push(fila);
      });
    } else if (/^\d{5,9}$/.test(nombre)) {
      const t = lector.getTable(nombre);
      const nombres = t.getColumnNames();
      const coinciden = nombres.filter((n) => FIRMA_A.has(n.toLowerCase())).length;
      if (coinciden < 22 || nombres.length < 25 || nombres.length > 34) continue;   // otro patrón (horarios, carga)
      tablasHistorial++;
      const cols = new Map(nombres.map((n) => [n.toLowerCase(), n]));
      t.getData().forEach((r, i) => {
        const fila = { ...base, fila: i + 1, matricula: nombre } as unknown as FilaHistorial;
        for (const [dest, orig] of Object.entries(MAPA_HISTORIAL)) {
          const col = cols.get(orig);
          (fila as Record<string, unknown>)[dest] = col ? texto(r[col]) : null;
        }
        // Materias precargadas del plan sin ninguna calificación: el alumno no las ha cursado (el ETL las omite).
        const conDatos = NOTAS.some((k) => fila[k] !== null) || (fila.pasado ?? "").toUpperCase() === "SI";
        if (conDatos && fila.clave) historial.push(fila);
      });
    }
  }
  return { ...base, expedientes, historial, plan, tablasHistorial };
}
