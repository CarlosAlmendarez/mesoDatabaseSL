"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { carrerasLote, descartarLote, deshacerLote, finalizarLote, procesarCarrera } from "../actions";

export function Acciones({ lote, estado }: { lote: number; estado: string }) {
  const router = useRouter();
  const [progreso, setProgreso] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ocupado = progreso !== "";

  async function aplicar() {
    if (!confirm("Se van a escribir en la base los cambios de esta vista previa. ¿Continuar?")) return;
    setError(null);
    try {
      const cs = await carrerasLote(lote);
      if (!cs.ok) throw new Error(cs.error);
      for (const [i, c] of cs.carreras.entries()) {
        setProgreso(`Aplicando carrera ${c} (${i + 1} de ${cs.carreras.length})…`);
        const r = await procesarCarrera(lote, true, c);
        if (!r.ok) throw new Error(`Carrera ${c}: ${r.error}`);
      }
      setProgreso("Terminando…");
      const f = await finalizarLote(lote, true);
      if (!f.ok) throw new Error(f.error);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : String(e)}. Las carreras ya aplicadas quedaron en la base; vuelve a pulsar «Aplicar» para continuar con las demás.`);
    }
    setProgreso("");
    router.refresh();
  }

  async function descartar() {
    if (!confirm("Se descartará esta vista previa sin cambiar la base. ¿Continuar?")) return;
    setProgreso("Descartando…");
    const r = await descartarLote(lote);
    setProgreso("");
    if (!r.ok) setError(r.error ?? "No se pudo descartar");
    router.refresh();
  }

  async function deshacer() {
    if (!confirm("Se va a deshacer esta actualización: se borra lo que agregó y se restauran los valores anteriores. ¿Continuar?")) return;
    setError(null);
    setProgreso("Deshaciendo…");
    const r = await deshacerLote(lote);
    setProgreso("");
    if (!r.ok) setError(r.error);
    router.refresh();
  }

  const boton = "rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {(estado === "comparado" || estado === "aplicando") && (
          <button onClick={aplicar} disabled={ocupado} className={`${boton} bg-brand text-white`}>
            {estado === "aplicando" ? "Continuar aplicando" : "Aplicar a la base"}
          </button>
        )}
        {(estado === "comparado" || estado === "recibiendo") && (
          <button onClick={descartar} disabled={ocupado} className={`${boton} border border-border`}>Descartar</button>
        )}
        {estado === "aplicado" && (
          <button onClick={deshacer} disabled={ocupado} className={`${boton} border border-red-300 text-red-700`}>Deshacer esta actualización</button>
        )}
      </div>
      {progreso && <p className="animate-pulse text-sm text-brand">{progreso}</p>}
      {error && <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
    </div>
  );
}
