"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { agrupar } from "@/app/acciones";
import type { PedidoExportacion } from "@/app/api/exportar/route";
import type { Resultado as Datos, TipoColumna } from "@/lib/db";
import { etiqueta } from "@/lib/etiquetas";
import { codificar, METRICAS, nombreMetrica, type Agrupacion, type FnMetrica, type Fuente } from "@/lib/fuentes";
import type { Vista } from "@/lib/procedimientos";
import { Grafica, type ConfigGrafica } from "./Grafica";


const NO_GRAFICABLES = /(^id$|_id$|numerocuenta|^clave|curp|registro_id)/;

const SIN_MILES = /(anio|semestre|^id$|_id$|calificacion$|lugar|numero|generacion)/;

function texto(v: unknown, col = ""): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "number") return v.toLocaleString("es-MX", { maximumFractionDigits: 2, useGrouping: !SIN_MILES.test(col) });
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Configuración inicial de la gráfica: la sugerida si sus columnas existen; si no, la primera categoría y el primer número. */
function graficaInicial(d: Datos, sugerida?: Vista): ConfigGrafica | null {
  const nums = d.columnas.filter((c) => d.tipos[c] === "numero" && !NO_GRAFICABLES.test(c));
  if (nums.length === 0) return null;
  if (sugerida && d.columnas.includes(sugerida.x) && d.columnas.includes(sugerida.y)) {
    return { ...sugerida, series: sugerida.series && d.columnas.includes(sugerida.series) ? sugerida.series : undefined };
  }
  const x = d.columnas.find((c) => c !== nums[0] && (d.tipos[c] !== "numero" || c === "ciclo" || /anio|semestre|calificacion$/.test(c))) ?? d.columnas[0];
  return { tipo: x === "ciclo" || /anio|fecha/.test(x) ? "linea" : "barras", x, y: nums.find((c) => c !== x) ?? nums[0] };
}

export function Resultado({
  fuente,
  inicial,
  titulo,
  filtros = [],
  vista,
  agruparSugerido = [],
  enlaceMatricula = true,
  vistaInicial = "tabla",
}: {
  fuente: Fuente;
  inicial: Datos;
  titulo: string;
  filtros?: [string, string][];
  vista?: Vista;
  agruparSugerido?: string[];
  enlaceMatricula?: boolean;
  vistaInicial?: "tabla" | "grafica";
}) {
  const [modo, setModo] = useState<"tabla" | "grafica">(vistaInicial);
  const [agrupado, setAgrupado] = useState<{ a: Agrupacion; d: Datos } | null>(null);
  const [panel, setPanel] = useState(false);
  const [grupos, setGrupos] = useState<string[]>(agruparSugerido.filter((g) => inicial.columnas.includes(g)).slice(0, 1));
  const [metricas, setMetricas] = useState<{ fn: FnMetrica; col: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, iniciar] = useTransition();
  const [filtro, setFiltro] = useState("");
  const [orden, setOrden] = useState<{ col: string; asc: boolean } | null>(null);

  const datos = agrupado?.d ?? inicial;
  const [grafica, setGrafica] = useState<ConfigGrafica | null>(() => graficaInicial(inicial, vista));
  const config = grafica && datos.columnas.includes(grafica.x) && datos.columnas.includes(grafica.y) ? grafica : graficaInicial(datos, vista);

  const filas = useMemo(() => {
    let f = datos.filas;
    const q = filtro.trim().toLowerCase();
    if (q) f = f.filter((r) => datos.columnas.some((c) => texto(r[c], c).toLowerCase().includes(q)));
    if (orden) {
      const { col, asc } = orden;
      f = [...f].sort((a, b) => {
        const x = a[col], y = b[col];
        if (x === y) return 0;
        if (x === null || x === undefined) return 1;
        if (y === null || y === undefined) return -1;
        const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "es", { numeric: true });
        return asc ? r : -r;
      });
    }
    return f;
  }, [datos, filtro, orden]);

  function aplicar() {
    if (grupos.length === 0) return setError("Elige al menos una columna para agrupar.");
    const a = { grupos, metricas };
    setError(null);
    iniciar(async () => {
      const r = await agrupar(fuente, a);
      if (r.ok) {
        setAgrupado({ a, d: r });
        setOrden(null);
        setFiltro("");
        const y = a.metricas[0] ? nombreMetrica(a.metricas[0]) : "registros";
        setGrafica({ tipo: a.grupos[0] === "ciclo" || /anio/.test(a.grupos[0]) ? "linea" : "barras", x: a.grupos[0], y, series: a.grupos[1] });
      } else setError(r.error);
    });
  }

  function quitar() {
    setAgrupado(null);
    setGrafica(graficaInicial(inicial, vista));
    setOrden(null);
  }

  function enlace(formato: "xlsx" | "csv") {
    const pedido: PedidoExportacion = { fuente, agrupacion: agrupado?.a ?? null, titulo, filtros };
    return `/api/exportar?formato=${formato}&p=${codificar(pedido)}`;
  }

  const columnasMetrica = inicial.columnas.filter((c) => inicial.tipos[c] !== "otro");
  const numericas = datos.columnas.filter((c) => datos.tipos[c] === "numero");

  return (
    <div className="space-y-3">
      {/* Barra de herramientas */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-sm">
          {(["tabla", "grafica"] as const).map((m) => (
            <button key={m} onClick={() => setModo(m)}
              className={`rounded px-3 py-1 ${modo === m ? "bg-brand text-white" : "text-foreground hover:bg-brand-soft"}`}>
              {m === "tabla" ? "Tabla" : "Gráfica"}
            </button>
          ))}
        </div>
        <button onClick={() => setPanel(!panel)}
          className={`rounded-md border px-3 py-1.5 text-sm ${panel || agrupado ? "border-brand bg-brand-soft text-brand" : "border-border bg-card hover:border-brand"}`}>
          Agrupar y resumir
        </button>
        {agrupado && (
          <button onClick={quitar} className="rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:border-brand">
            Quitar agrupación
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <a href={enlace("xlsx")} className="rounded-md bg-[#1d6f42] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
            Exportar a Excel
          </a>
          <a href={enlace("csv")} className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand-soft">
            CSV
          </a>
        </div>
      </div>

      {/* Panel de agrupación */}
      {panel && (
        <div className="space-y-3 rounded-xl border border-brand/30 bg-brand-soft/60 p-4 text-sm">
          <div>
            <p className="font-medium">1. Agrupar por <span className="font-normal text-muted">(elige una o dos columnas; la segunda se vuelve series en la gráfica)</span></p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {inicial.columnas.filter((c) => inicial.tipos[c] !== "otro").map((c) => {
                const i = grupos.indexOf(c);
                return (
                  <button key={c} onClick={() => setGrupos(i >= 0 ? grupos.filter((g) => g !== c) : [...grupos, c].slice(-3))}
                    className={`rounded-full border px-2.5 py-1 text-xs ${i >= 0 ? "border-brand bg-brand text-white" : "border-border bg-white hover:border-brand"}`}>
                    {i >= 0 && <span className="mr-1 font-semibold">{i + 1}.</span>}{etiqueta(c)}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="font-medium">2. Calcular <span className="font-normal text-muted">(el número de registros siempre se incluye)</span></p>
            <div className="mt-2 space-y-2">
              {metricas.map((m, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <select value={m.fn} onChange={(e) => setMetricas(metricas.map((x, j) => (j === i ? { ...x, fn: e.target.value as FnMetrica } : x)))}
                    className="rounded-md border border-border bg-white px-2 py-1">
                    {Object.entries(METRICAS).filter(([, d]) => d.tipos.includes(inicial.tipos[m.col] as TipoColumna)).map(([k, d]) => (
                      <option key={k} value={k}>{d.etiqueta}</option>
                    ))}
                  </select>
                  <span className="text-muted">de</span>
                  <select value={m.col} onChange={(e) => {
                    const col = e.target.value;
                    const fn = METRICAS[m.fn].tipos.includes(inicial.tipos[col]) ? m.fn : (Object.entries(METRICAS).find(([, d]) => d.tipos.includes(inicial.tipos[col]))?.[0] as FnMetrica);
                    setMetricas(metricas.map((x, j) => (j === i ? { fn, col } : x)));
                  }} className="rounded-md border border-border bg-white px-2 py-1">
                    {columnasMetrica.map((c) => <option key={c} value={c}>{etiqueta(c)}</option>)}
                  </select>
                  <button onClick={() => setMetricas(metricas.filter((_, j) => j !== i))} className="text-xs text-red-700 hover:underline">quitar</button>
                </div>
              ))}
              <button onClick={() => {
                const col = inicial.columnas.find((c) => inicial.tipos[c] === "numero" && !NO_GRAFICABLES.test(c)) ?? columnasMetrica[0];
                if (!col) return;
                const fn = (Object.entries(METRICAS).find(([, d]) => d.tipos.includes(inicial.tipos[col]))?.[0] ?? "distintos") as FnMetrica;
                setMetricas([...metricas, { fn: inicial.tipos[col] === "numero" ? "promedio" : fn, col }]);
              }} className="rounded-md border border-dashed border-brand/50 bg-white px-3 py-1 text-xs text-brand hover:border-brand">
                + Agregar cálculo
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={aplicar} disabled={cargando} className="rounded-md bg-brand px-4 py-1.5 font-medium text-white disabled:opacity-60">
              {cargando ? "Agrupando…" : "Aplicar"}
            </button>
            <span className="text-xs text-muted">Se calcula en la base sobre todos los registros, no solo los que se ven en pantalla.</span>
          </div>
          {error && <p className="text-red-700">{error}</p>}
        </div>
      )}

      {/* Línea de estado */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span>
          {agrupado ? (
            <>Agrupado por <strong className="text-foreground">{agrupado.a.grupos.map(etiqueta).join(" y ")}</strong> · {datos.filas.length.toLocaleString("es-MX")} grupos</>
          ) : (
            <>{inicial.filas.length.toLocaleString("es-MX")} {inicial.filas.length === 1 ? "fila" : "filas"}</>
          )}
          {datos.truncado && " · se muestran las primeras 1,000 (la exportación incluye hasta 50,000)"}
        </span>
        {modo === "tabla" && (
          <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar en estos resultados…"
            className="ml-auto w-64 rounded-md border border-border bg-white px-3 py-1 text-sm text-foreground" />
        )}
      </div>

      {datos.filas.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted">Sin resultados con estos filtros.</p>
      ) : modo === "grafica" ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          {config ? (
            <>
              <div className="flex flex-wrap items-end gap-3 text-sm">
                <Opcion etiqueta="Tipo">
                  <select value={config.tipo} onChange={(e) => setGrafica({ ...config, tipo: e.target.value as ConfigGrafica["tipo"] })} className="rounded-md border border-border px-2 py-1">
                    <option value="barras">Barras</option>
                    <option value="linea">Línea</option>
                  </select>
                </Opcion>
                <Opcion etiqueta="Categoría (eje horizontal)">
                  <select value={config.x} onChange={(e) => setGrafica({ ...config, x: e.target.value })} className="rounded-md border border-border px-2 py-1">
                    {datos.columnas.map((c) => <option key={c} value={c}>{etiqueta(c)}</option>)}
                  </select>
                </Opcion>
                <Opcion etiqueta="Valor">
                  <select value={config.y} onChange={(e) => setGrafica({ ...config, y: e.target.value })} className="rounded-md border border-border px-2 py-1">
                    {numericas.map((c) => <option key={c} value={c}>{etiqueta(c)}</option>)}
                  </select>
                </Opcion>
                <Opcion etiqueta="Separar por (series)">
                  <select value={config.series ?? ""} onChange={(e) => setGrafica({ ...config, series: e.target.value || undefined })} className="rounded-md border border-border px-2 py-1">
                    <option value="">Ninguna</option>
                    {datos.columnas.filter((c) => c !== config.x && c !== config.y).map((c) => <option key={c} value={c}>{etiqueta(c)}</option>)}
                  </select>
                </Opcion>
              </div>
              <Grafica filas={datos.filas} config={config} />
              {datos.truncado && <p className="text-xs text-muted">La gráfica usa las primeras 1,000 filas. Para resumir todo, usa «Agrupar y resumir».</p>}
            </>
          ) : (
            <p className="text-sm text-muted">Estos resultados no tienen columnas numéricas. Usa «Agrupar y resumir» para contar registros y graficarlos.</p>
          )}
        </div>
      ) : (
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-card">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-brand-soft text-left">
              <tr>
                {datos.columnas.map((c) => (
                  <th key={c} onClick={() => setOrden(orden?.col === c ? (orden.asc ? { col: c, asc: false } : null) : { col: c, asc: true })}
                    className="cursor-pointer select-none whitespace-nowrap border-b border-border px-3 py-2 font-semibold text-foreground hover:bg-brand-soft/70"
                    title="Clic para ordenar">
                    {etiqueta(c)}
                    <span className="ml-1 text-brand">{orden?.col === c ? (orden.asc ? "▲" : "▼") : ""}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={i} className="odd:bg-white even:bg-background/60 hover:bg-brand-soft/40">
                  {datos.columnas.map((c) => {
                    const v = f[c];
                    return (
                      <td key={c} className={`whitespace-nowrap border-b border-border/60 px-3 py-1.5 ${typeof v === "number" ? "text-right tabular-nums" : ""}`}>
                        {enlaceMatricula && c === "numerocuenta" && v ? (
                          <Link href={`/alumnos/${String(v)}`} className="text-brand underline-offset-2 hover:underline">{texto(v)}</Link>
                        ) : (
                          texto(v, c)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {filas.length === 0 && <p className="p-4 text-sm text-muted">Ninguna fila coincide con el filtro.</p>}
        </div>
      )}
    </div>
  );
}

function Opcion({ etiqueta: e, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{e}</span>
      {children}
    </label>
  );
}
