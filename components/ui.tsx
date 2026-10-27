export function Titulo({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold text-foreground">{titulo}</h1>
      {subtitulo && <p className="mt-1 max-w-3xl text-sm text-muted">{subtitulo}</p>}
    </header>
  );
}

export function Cargando({ texto = "Consultando la base…" }: { texto?: string }) {
  return <p className="animate-pulse rounded-lg border border-border bg-card p-4 text-sm text-muted">{texto}</p>;
}

export function Aviso({ tipo = "info", children }: { tipo?: "info" | "error" | "ok"; children: React.ReactNode }) {
  const color = {
    info: "border-brand/30 bg-brand-soft text-brand",
    error: "border-red-300 bg-red-50 text-red-800",
    ok: "border-green-300 bg-green-50 text-green-800",
  }[tipo];
  return <div className={`rounded-lg border px-4 py-3 text-sm ${color}`}>{children}</div>;
}

export function Sql({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-[#16202c] px-4 py-3 font-mono text-xs leading-relaxed text-[#d7e3f0]">
      {children}
    </pre>
  );
}
