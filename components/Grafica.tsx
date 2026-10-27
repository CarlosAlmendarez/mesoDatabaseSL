"use client";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { etiqueta } from "@/lib/etiquetas";

type Fila = Record<string, unknown>;

// Paleta categórica de referencia (validada para daltonismo en orden fijo; nunca se cicla).
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const MAX_SERIES = 8;
const MAX_CATEGORIAS = 30;
const TINTA = "#52514e";
const REJILLA = "#e6e8ec";

const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
const fmt = (v: unknown) => (typeof v === "number" ? v.toLocaleString("es-MX", { maximumFractionDigits: 2 }) : String(v ?? ""));

export type ConfigGrafica = { tipo: "barras" | "linea"; x: string; y: string; series?: string };

/** Pivotea las filas a { x, serie1, serie2… }; las series de menor total se juntan en «Otros». */
function preparar(filas: Fila[], c: ConfigGrafica) {
  if (!c.series) {
    // Nombres repetidos (p. ej. «INGLES I» de varias carreras) se distinguen para no encimarse en el eje.
    const vistos = new Map<string, number>();
    const datos = filas
      .filter((f) => f[c.x] !== null && f[c.x] !== undefined && !Number.isNaN(num(f[c.y])))
      .map((f) => {
        const base = String(f[c.x]);
        const n = (vistos.get(base) ?? 0) + 1;
        vistos.set(base, n);
        return { x: n > 1 ? `${base} (${n})` : base, [c.y]: num(f[c.y]) };
      });
    return { datos, claves: [c.y] };
  }
  const serie: string = c.series;
  const totales = new Map<string, number>();
  for (const f of filas) {
    const s: string = String(f[serie] ?? "sin dato");
    totales.set(s, (totales.get(s) ?? 0) + (num(f[c.y]) || 0));
  }
  const orden = [...totales.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  const visibles = orden.length > MAX_SERIES ? orden.slice(0, MAX_SERIES - 1) : orden;
  const claves = orden.length > MAX_SERIES ? [...visibles, "Otros"] : visibles;
  const porX = new Map<string, Record<string, number | string>>();
  for (const f of filas) {
    const x: string = String(f[c.x] ?? "");
    const s: string = String(f[serie] ?? "sin dato");
    const k: string = visibles.includes(s) ? s : "Otros";
    const fila: Record<string, number | string> = porX.get(x) ?? { x };
    fila[k] = (Number(fila[k]) || 0) + (num(f[c.y]) || 0);
    porX.set(x, fila);
  }
  return { datos: [...porX.values()], claves };
}

function Ventana({ active, payload, label }: { active?: boolean; payload?: { name: string; value: unknown; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
          <span className="text-muted">{etiqueta(p.name)}:</span> <span className="tabular-nums">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

/** Ejes con orden propio (tiempo, semestre, calificación): se respetan; no se reordenan por valor. */
function esOrdinal(x: string, datos: Record<string, string | number>[]): boolean {
  return /ciclo|anio|semestre|calificacion|edad|fecha|generacion/.test(x) || datos.every((d) => /^-?\d+(\.\d+)?$/.test(String(d.x)));
}

export function Grafica({ filas, config, alto }: { filas: Fila[]; config: ConfigGrafica; alto?: number }) {
  const { datos: todos, claves } = preparar(filas, config);
  const varias = claves.length > 1;
  const categorias = config.tipo === "barras" && !varias && !esOrdinal(config.x, todos);
  // Barras de categorías: de mayor a menor; con muchas, horizontales y solo las más grandes.
  const horizontal = categorias && todos.length > 12;
  let datos = categorias ? [...todos].sort((a, b) => num(b[config.y]) - num(a[config.y])) : todos;
  const recortado = horizontal && datos.length > MAX_CATEGORIAS;
  if (recortado) datos = datos.slice(0, MAX_CATEGORIAS);
  if (datos.length === 0) return <p className="p-4 text-sm text-muted">No hay valores numéricos para graficar.</p>;

  const largoEtiqueta = Math.min(Math.max(...datos.map((d) => String(d.x).length)) * 6.5, 260);
  const h = alto ?? (horizontal ? Math.max(260, datos.length * 26 + 60) : 340);
  const ejeTexto = { fill: TINTA, fontSize: 11 };
  const leyenda = varias ? <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: TINTA }}>{v}</span>} /> : null;

  return (
    <div>
      <ResponsiveContainer width="100%" height={h}>
        {config.tipo === "linea" ? (
          <LineChart data={datos} margin={{ top: 12, right: 24, bottom: 8, left: 8 }}>
            <CartesianGrid stroke={REJILLA} vertical={false} />
            <XAxis dataKey="x" tick={ejeTexto} tickLine={false} axisLine={{ stroke: REJILLA }} minTickGap={16} />
            <YAxis tick={ejeTexto} tickLine={false} axisLine={false} tickFormatter={fmt} width={56} />
            <Tooltip content={<Ventana />} cursor={{ stroke: "#9aa3af", strokeWidth: 1 }} />
            {leyenda}
            {claves.map((k, i) => (
              <Line key={k} dataKey={k} name={k} type="monotone" animationDuration={400} stroke={SERIES[i]} strokeWidth={2}
                dot={datos.length <= 24 ? { r: 3, strokeWidth: 0, fill: SERIES[i] } : false} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} />
            ))}
          </LineChart>
        ) : horizontal ? (
          <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 8 }} barCategoryGap={4}>
            <CartesianGrid stroke={REJILLA} horizontal={false} />
            <XAxis type="number" tick={ejeTexto} tickLine={false} axisLine={false} tickFormatter={fmt} />
            <YAxis type="category" dataKey="x" tick={ejeTexto} tickLine={false} axisLine={{ stroke: REJILLA }} width={largoEtiqueta} interval={0} />
            <Tooltip content={<Ventana />} cursor={{ fill: "rgba(31,78,121,0.06)" }} />
            <Bar dataKey={config.y} name={config.y} fill={SERIES[0]} radius={[0, 4, 4, 0]} maxBarSize={18} animationDuration={400} />
          </BarChart>
        ) : (
          <BarChart data={datos} margin={{ top: 12, right: 24, bottom: 8, left: 8 }} barGap={2}>
            <CartesianGrid stroke={REJILLA} vertical={false} />
            <XAxis dataKey="x" tick={ejeTexto} tickLine={false} axisLine={{ stroke: REJILLA }} minTickGap={8} />
            <YAxis tick={ejeTexto} tickLine={false} axisLine={false} tickFormatter={fmt} width={56} />
            <Tooltip content={<Ventana />} cursor={{ fill: "rgba(31,78,121,0.06)" }} />
            {leyenda}
            {claves.map((k, i) => (
              <Bar key={k} dataKey={k} name={k} fill={SERIES[i]} radius={[4, 4, 0, 0]} maxBarSize={48} animationDuration={400} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
      {recortado && (
        <p className="mt-1 text-xs text-muted">
          Se muestran las {MAX_CATEGORIAS} categorías más grandes de {todos.length}. La tabla y la exportación tienen todas.
        </p>
      )}
    </div>
  );
}
