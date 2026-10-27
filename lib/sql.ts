// Revisión de las consultas libres de la consola (la ejecución siempre es de solo lectura).

// Quita literales y comentarios para revisar que haya una sola instrucción.
export function sinLiterales(t: string): string {
  return t
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\$([A-Za-z_]\w*)?\$[\s\S]*?\$\1\$/g, "''")
    .replace(/[eE]'(?:[^'\\]|\\[\s\S]|'')*'/g, "''")
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""');
}

/** Devuelve la consulta limpia o lanza un error con la explicación. */
export function validarSqlLibre(texto: string): string {
  const sql = texto.trim().replace(/;+\s*$/, "");
  if (!sql) throw new Error("Escribe una consulta.");
  if (sql.length > 20000) throw new Error("La consulta es demasiado larga.");
  if (sinLiterales(sql).includes(";")) throw new Error("Escribe una sola instrucción por consulta (sin ; en medio).");
  return sql;
}

/** ¿Se puede usar como subconsulta (para agrupar, limitar o exportar)? */
export function esLectura(sql: string): boolean {
  return /^\s*(select|with|values|table)\b/i.test(sinLiterales(sql));
}

/** Identificador entre comillas dobles, para nombres de columna ya validados. */
export function ident(nombre: string): string {
  return `"${nombre.replace(/"/g, '""')}"`;
}
