"use client";
import { useState, useTransition } from "react";
import { Tabla } from "@/components/Tabla";
import { Aviso, Sql } from "@/components/ui";
import {
  inscripcionesDe,
  simularOperacion,
  type Inscripcion,
  type Operacion,
  type ResultadoSimulacion,
} from "./actions";

type Tipo = { clave: string; nombre: string; requiere_autorizacion: boolean };
type ClaveOp = Operacion["tipo"];

const OPERACIONES: { clave: ClaveOp; titulo: string; ayuda: string }[] = [
  { clave: "registrar_intento", titulo: "Capturar calificación", ayuda: "Parcial, final, extraordinario o recursamiento. El tercer extraordinario y repetir un tipo exigen autorización." },
  { clave: "corregir_final", titulo: "Corregir calificación final", ayuda: "Requiere motivo y quién autoriza. Aplica el redondeo del reglamento." },
  { clave: "baja_materia", titulo: "Baja de materia", ayuda: "La materia queda inactiva con fecha y motivo; ya no acepta calificaciones." },
  { clave: "reingreso", titulo: "Reingreso del alumno", ayuda: "Reactiva al alumno sin tocar su historial." },
];

const campo = "rounded-md border border-border px-3 py-2";

export function Simulador({ tipos }: { tipos: Tipo[] }) {
  const [cuenta, setCuenta] = useState("21102010");
  const [alumno, setAlumno] = useState<string | null>(null);
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [elegida, setElegida] = useState<string>("");
  const [op, setOp] = useState<ClaveOp>("registrar_intento");
  const [tipoIntento, setTipoIntento] = useState(tipos[0]?.clave ?? "PARCIAL_1");
  const [calificacion, setCalificacion] = useState("8.5");
  const [autorizadoPor, setAutorizadoPor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [resultado, setResultado] = useState<ResultadoSimulacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, iniciar] = useTransition();

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResultado(null);
    iniciar(async () => {
      try {
        const r = await inscripcionesDe(cuenta);
        setAlumno(r.alumno);
        setInscripciones(r.filas);
        setElegida(r.filas[0]?.id ?? "");
        if (!r.alumno) setError("No existe esa matrícula.");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function ejecutar(e: React.FormEvent) {
    e.preventDefault();
    let operacion: Operacion;
    if (op === "registrar_intento") operacion = { tipo: op, inscripcion: elegida, tipoIntento, calificacion, autorizadoPor, motivo };
    else if (op === "corregir_final") operacion = { tipo: op, inscripcion: elegida, calificacion, autorizadoPor, motivo };
    else if (op === "baja_materia") operacion = { tipo: op, inscripcion: elegida, motivo };
    else operacion = { tipo: op, cuenta, motivo };
    iniciar(async () => setResultado(await simularOperacion(operacion)));
  }

  const actual = OPERACIONES.find((o) => o.clave === op)!;
  const necesitaMateria = op !== "reingreso";

  return (
    <div className="space-y-6">
      <form onSubmit={buscar} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">1. Matrícula del alumno</span>
          <input value={cuenta} onChange={(e) => setCuenta(e.target.value)} className={campo} />
        </label>
        <button disabled={cargando} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          Ver materias
        </button>
        {alumno && <span className="text-sm text-muted">{alumno} · {inscripciones.length} materias</span>}
      </form>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {alumno && (
        <form onSubmit={ejecutar} className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div>
            <p className="mb-2 text-sm font-medium">2. Operación</p>
            <div className="flex flex-wrap gap-2">
              {OPERACIONES.map((o) => (
                <button
                  type="button"
                  key={o.clave}
                  onClick={() => { setOp(o.clave); setResultado(null); }}
                  className={`rounded-md border px-3 py-1.5 text-sm ${op === o.clave ? "border-brand bg-brand text-white" : "border-border hover:border-brand"}`}
                >
                  {o.titulo}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">{actual.ayuda}</p>
          </div>

          {necesitaMateria && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">3. Materia</span>
              <select value={elegida} onChange={(e) => setElegida(e.target.value)} className={campo}>
                {inscripciones.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.ciclo ?? "sin ciclo"} · {i.clave} {i.materia} · final {i.calificacion_final ?? "—"} · {i.estatus}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex flex-wrap gap-3">
            {op === "registrar_intento" && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Tipo</span>
                <select value={tipoIntento} onChange={(e) => setTipoIntento(e.target.value)} className={campo}>
                  {tipos.map((t) => (
                    <option key={t.clave} value={t.clave}>
                      {t.nombre}{t.requiere_autorizacion ? " (requiere autorización)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(op === "registrar_intento" || op === "corregir_final") && (
              <>
                <label className="flex w-32 flex-col gap-1 text-sm">
                  <span className="font-medium">Calificación</span>
                  <input type="number" min="0" max="10" step="0.01" value={calificacion} onChange={(e) => setCalificacion(e.target.value)} className={campo} />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Autorizado por</span>
                  <input value={autorizadoPor} onChange={(e) => setAutorizadoPor(e.target.value)} placeholder="Ej. Dirección" className={campo} />
                </label>
              </>
            )}
            <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">Motivo</span>
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Error de captura" className={campo} />
            </label>
          </div>

          <button disabled={cargando || (necesitaMateria && !elegida)} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {cargando ? "Ejecutando…" : "Ejecutar en modo prueba"}
          </button>
        </form>
      )}

      {resultado && (
        <section className="space-y-4">
          <Aviso tipo={resultado.ok ? "ok" : "error"}>
            {resultado.ok ? resultado.mensaje : <>La base rechazó la operación: <strong>{resultado.mensaje}</strong></>}
            {resultado.devolvio && <> Valor devuelto: <strong>{resultado.devolvio}</strong>.</>}
          </Aviso>
          <Sql>{resultado.llamada}</Sql>
          {resultado.antes && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm font-medium">Antes</p>
                <Tabla columnas={resultado.antes.columnas} filas={resultado.antes.filas} archivo="antes" />
              </div>
              {resultado.despues && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Después (antes de revertir)</p>
                  <Tabla columnas={resultado.despues.columnas} filas={resultado.despues.filas} archivo="despues" />
                </div>
              )}
            </div>
          )}
          {resultado.bitacora && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Lo que registró la bitácora</p>
              <Tabla columnas={resultado.bitacora.columnas} filas={resultado.bitacora.filas} archivo="bitacora" />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
