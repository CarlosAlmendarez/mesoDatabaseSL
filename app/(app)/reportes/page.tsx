import Link from "next/link";
import { GRUPOS, PROCEDIMIENTOS } from "@/lib/procedimientos";
import { Titulo } from "@/components/ui";

export default function Reportes() {
  return (
    <>
      <Titulo
        titulo="Reportes"
        subtitulo="Cada reporte es un procedimiento almacenado en la base: se llama con un solo comando y entrega la información lista, sin buscar tabla por tabla."
      />
      <div className="space-y-8">
        {GRUPOS.map((g) => (
          <section key={g}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{g}</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {PROCEDIMIENTOS.filter((p) => p.grupo === g).map((p) => (
                <Link key={p.id} href={`/reportes/${p.id}`} className="rounded-xl border border-border bg-card p-4 hover:border-brand">
                  <p className="font-semibold text-brand">{p.titulo}</p>
                  <p className="mt-1 text-sm text-muted">{p.descripcion}</p>
                  <p className="mt-3 font-mono text-xs text-muted">{p.funcion}()</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
