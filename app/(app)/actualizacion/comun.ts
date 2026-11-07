// Textos compartidos de las pantallas de actualización (servidor y cliente).

export const ESTADOS: Record<string, string> = {
  recibiendo: "Incompleto (no se terminó de enviar)",
  comparado: "Comparado: falta aplicarlo",
  aplicando: "Aplicándose (incompleto)",
  aplicado: "Aplicado",
  descartado: "Descartado",
  deshecho: "Deshecho",
};

export const ENTIDADES: Record<string, string> = {
  alumnos: "Alumnos (expediente)",
  documentos: "Documentos entregados",
  bajas: "Bajas del programa",
  ciclos: "Ciclos escolares",
  materias: "Materias (plan de estudios)",
  docentes: "Docentes",
  inscripciones: "Materias cursadas",
  calificaciones: "Calificaciones (parciales, final, extraordinarios)",
};

export const ACCIONES: Record<string, { titulo: string; ayuda: string }> = {
  nuevo: { titulo: "Nuevos", ayuda: "No existen en la base: se agregan." },
  cambio: { titulo: "Cambios", ayuda: "Existen con otro valor: se actualizan con el del archivo." },
  conflicto: { titulo: "Conflictos", ayuda: "Se corrigieron en el sistema nuevo: se conserva lo de la base." },
  revisar: { titulo: "Por revisar", ayuda: "No se aplican solos (cambio de carrera, reactivación, matrícula sin expediente…)." },
};

export function totales(resumen: unknown): Record<"nuevo" | "cambio" | "conflicto" | "revisar", number> {
  const t = { nuevo: 0, cambio: 0, conflicto: 0, revisar: 0 };
  const por = (resumen as { por_entidad?: Record<string, Record<string, number>> } | null)?.por_entidad ?? {};
  for (const acc of Object.values(por)) for (const [k, n] of Object.entries(acc)) if (k in t) t[k as keyof typeof t] += n;
  return t;
}
