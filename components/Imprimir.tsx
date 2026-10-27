"use client";

/** Abre el diálogo de impresión del navegador (sirve para guardar la página como PDF). */
export function Imprimir() {
  return (
    <button type="button" onClick={() => window.print()}
      className="rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground hover:border-brand hover:text-brand">
      Imprimir o guardar PDF
    </button>
  );
}
