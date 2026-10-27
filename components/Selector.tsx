"use client";
import { useEffect, useMemo, useRef, useState } from "react";

export type OpcionSelector = { valor: string; etiqueta: string; detalle?: string; grupo?: string };

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Menú desplegable con búsqueda. Envía su valor en un input oculto con `name` (sirve en formularios GET). */
export function Selector({
  name,
  opciones,
  defaultValue = "",
  vacio = "Todos",
  requerido = false,
  ancho = "w-72",
}: {
  name: string;
  opciones: OpcionSelector[];
  defaultValue?: string;
  vacio?: string;
  requerido?: boolean;
  ancho?: string;
}) {
  const [valor, setValor] = useState(defaultValue);
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [activo, setActivo] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const visibles = useMemo(() => {
    const q = sinAcentos(busqueda.trim());
    const base = requerido ? opciones : [{ valor: "", etiqueta: vacio }, ...opciones];
    return q ? base.filter((o) => sinAcentos(`${o.etiqueta} ${o.detalle ?? ""} ${o.valor}`).includes(q)) : base;
  }, [busqueda, opciones, requerido, vacio]);

  useEffect(() => {
    if (!abierto) return;
    entrada.current?.focus();
    const cerrar = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [abierto]);

  const actual = opciones.find((o) => o.valor === valor);

  function elegir(o: OpcionSelector) {
    setValor(o.valor);
    setAbierto(false);
    setBusqueda("");
  }

  function teclas(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActivo((a) => Math.min(a + 1, visibles.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (visibles[activo]) elegir(visibles[activo]); }
    else if (e.key === "Escape") setAbierto(false);
  }

  return (
    <div ref={caja} className={`relative ${ancho}`}>
      <input type="hidden" name={name} value={valor} />
      {requerido && <input tabIndex={-1} aria-hidden required value={valor} onChange={() => undefined} className="pointer-events-none absolute inset-0 opacity-0" />}
      <button type="button" onClick={() => { setAbierto(!abierto); setActivo(0); }}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-white px-3 py-2 text-left text-sm hover:border-brand">
        <span className={`truncate ${actual ? "" : "text-muted"}`}>{actual ? actual.etiqueta : requerido ? "Elige…" : vacio}</span>
        <span className="text-muted">▾</span>
      </button>
      {abierto && (
        <div className="absolute z-30 mt-1 w-full min-w-72 rounded-lg border border-border bg-white shadow-lg">
          <input ref={entrada} value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setActivo(0); }} onKeyDown={teclas}
            placeholder="Escribe para buscar…" className="w-full rounded-t-lg border-b border-border px-3 py-2 text-sm outline-none" />
          <ul className="max-h-72 overflow-auto py-1 text-sm" role="listbox">
            {visibles.length === 0 && <li className="px-3 py-2 text-muted">Sin coincidencias</li>}
            {visibles.map((o, i) => {
              const encabezado = o.grupo && o.grupo !== visibles[i - 1]?.grupo ? o.grupo : null;
              return (
                <li key={o.valor || "_vacio"}>
                  {encabezado && <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{encabezado}</p>}
                  <button type="button" role="option" aria-selected={o.valor === valor} onMouseEnter={() => setActivo(i)} onClick={() => elegir(o)}
                    className={`block w-full px-3 py-1.5 text-left ${i === activo ? "bg-brand-soft" : ""} ${o.valor === valor ? "font-semibold text-brand" : ""}`}>
                    {o.etiqueta}
                    {o.detalle && <span className="block text-xs font-normal text-muted">{o.detalle}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
