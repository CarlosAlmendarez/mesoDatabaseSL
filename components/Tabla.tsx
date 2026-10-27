"use client";
import Link from "next/link";

type Fila = Record<string, unknown>;

function texto(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function aCsv(columnas: string[], filas: Fila[]): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [columnas.join(","), ...filas.map((f) => columnas.map((c) => esc(texto(f[c]))).join(","))].join("\n");
}

export function Tabla({
  columnas,
  filas,
  truncado,
  archivo = "resultado",
  enlaceMatricula = true,
}: {
  columnas: string[];
  filas: Fila[];
  truncado?: boolean;
  archivo?: string;
  enlaceMatricula?: boolean;
}) {
  function descargar() {
    const blob = new Blob(["﻿" + aCsv(columnas, filas)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${archivo}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (filas.length === 0) {
    return <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted">Sin resultados.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          {filas.length.toLocaleString("es-MX")} filas{truncado ? " (se muestran las primeras 1,000)" : ""}
        </span>
        <button onClick={descargar} className="rounded-md border border-border bg-card px-3 py-1 font-medium text-brand hover:bg-brand-soft">
          Descargar CSV
        </button>
      </div>
      <div className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-brand-soft text-left">
            <tr>
              {columnas.map((c) => (
                <th key={c} className="whitespace-nowrap border-b border-border px-3 py-2 font-semibold text-foreground">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i} className="odd:bg-white even:bg-background/60">
                {columnas.map((c) => {
                  const v = f[c];
                  const num = typeof v === "number" || (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) && c !== "numerocuenta");
                  return (
                    <td key={c} className={`whitespace-nowrap border-b border-border/60 px-3 py-1.5 ${num ? "text-right tabular-nums" : ""}`}>
                      {enlaceMatricula && c === "numerocuenta" && v ? (
                        <Link href={`/alumnos/${String(v)}`} className="text-brand underline-offset-2 hover:underline">
                          {texto(v)}
                        </Link>
                      ) : (
                        texto(v)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
