"use client";
import { useState } from "react";
import Link from "next/link";

type Item = { id: string; titulo: string; descripcion: string; grupo: string; procedimiento: boolean; grafica: boolean };

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function CatalogoReportes({ grupos, reportes }: { grupos: string[]; reportes: Item[] }) {
  const [q, setQ] = useState("");
  const [grupo, setGrupo] = useState("");
  const filtrados = reportes.filter(
    (r) => (!grupo || r.grupo === grupo) && (!q || sinAcentos(`${r.titulo} ${r.descripcion}`).includes(sinAcentos(q))),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar reporte: becas, reprobación, docentes…"
          className="w-full max-w-md rounded-md border border-border bg-white px-3 py-2 text-sm" />
        <div className="flex flex-wrap gap-1.5">
          {["", ...grupos].map((g) => (
            <button key={g || "todos"} onClick={() => setGrupo(g)}
              className={`rounded-full border px-3 py-1 text-xs ${grupo === g ? "border-brand bg-brand text-white" : "border-border bg-white hover:border-brand"}`}>
              {g || "Todos"}
            </button>
          ))}
        </div>
      </div>
      {grupos.map((g) => {
        const lista = filtrados.filter((r) => r.grupo === g);
        if (lista.length === 0) return null;
        return (
          <section key={g}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{g}</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {lista.map((r) => (
                <Link key={r.id} href={`/reportes/${r.id}`} className="flex flex-col rounded-xl border border-border bg-card p-4 hover:border-brand">
                  <p className="font-semibold text-brand">{r.titulo}</p>
                  <p className="mt-1 flex-1 text-sm text-muted">{r.descripcion}</p>
                  <div className="mt-3 flex gap-1.5 text-[11px]">
                    <span className="rounded bg-background px-1.5 py-0.5 text-muted">{r.procedimiento ? "Procedimiento almacenado" : "Consulta"}</span>
                    {r.grafica && <span className="rounded bg-brand-soft px-1.5 py-0.5 text-brand">Con gráfica</span>}
                    <span className="rounded bg-[#e5f4e4] px-1.5 py-0.5 text-[#1d6f42]">Excel</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
      {filtrados.length === 0 && <p className="text-sm text-muted">Ningún reporte coincide con la búsqueda.</p>}
    </div>
  );
}
