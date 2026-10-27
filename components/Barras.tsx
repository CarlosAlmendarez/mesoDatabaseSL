"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SERIES } from "@/lib/paleta";

const TINTA = "#52514e";
const REJILLA = "#e6e8ec";
const fmt = (v: number) => v.toLocaleString("es-MX", { maximumFractionDigits: 1 });

export type Serie = { clave: string; color?: string };

/**
 * Barras horizontales por categoría: agrupadas, apiladas o apiladas al 100 % (composición).
 * Cada fila de `datos` es { x, [serie]: valor }. Con «pct» la ventana muestra el número y su porcentaje.
 */
export function Barras({
  datos,
  series,
  modo = "agrupadas",
  sufijo = "",
}: {
  datos: Record<string, string | number>[];
  series: Serie[];
  modo?: "agrupadas" | "apiladas" | "pct";
  sufijo?: string;
}) {
  if (datos.length === 0) return <p className="p-4 text-sm text-muted">Sin datos.</p>;
  const apilar = modo !== "agrupadas";
  const porFila = apilar ? 1 : series.length;
  const alto = Math.max(200, datos.length * (porFila * 12 + 14) + 70);
  const largo = Math.min(Math.max(...datos.map((d) => String(d.x).length)) * 6.8, 220);
  const color = (s: Serie, i: number) => s.color ?? SERIES[i];

  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart data={datos} layout="vertical" stackOffset={modo === "pct" ? "expand" : "none"}
        margin={{ top: 4, right: 24, bottom: 4, left: 4 }} barCategoryGap={modo === "agrupadas" ? 6 : 3} barGap={1}>
        <CartesianGrid stroke={REJILLA} horizontal={false} />
        <XAxis type="number" tick={{ fill: TINTA, fontSize: 11 }} tickLine={false} axisLine={false}
          tickFormatter={(v: number) => (modo === "pct" ? `${Math.round(v * 100)} %` : fmt(v) + sufijo)} />
        <YAxis type="category" dataKey="x" tick={{ fill: TINTA, fontSize: 11 }} tickLine={false}
          axisLine={{ stroke: REJILLA }} width={largo} interval={0} />
        <Tooltip cursor={{ fill: "rgba(31,78,121,0.06)" }} content={<Ventana series={series} pct={modo === "pct"} sufijo={sufijo} />} />
        {series.length > 1 && (
          <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: TINTA }}>{v}</span>} />
        )}
        {series.map((s, i) => (
          <Bar key={s.clave} dataKey={s.clave} name={s.clave} stackId={apilar ? "a" : undefined} fill={color(s, i)}
            stroke={apilar ? "#fff" : undefined} strokeWidth={apilar ? 1 : 0} animationDuration={400}
            radius={apilar ? (i === series.length - 1 ? [0, 4, 4, 0] : 0) : [0, 4, 4, 0]} maxBarSize={apilar ? 22 : 14} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function Ventana({
  active, payload, label, series, pct, sufijo,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string; payload: Record<string, number> }[];
  label?: string;
  series: Serie[];
  pct: boolean;
  sufijo: string;
}) {
  if (!active || !payload?.length) return null;
  const fila = payload[0].payload;
  const total = series.reduce((t, s) => t + (Number(fila[s.clave]) || 0), 0);
  return (
    <div className="rounded-md border border-border bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      {[...payload].reverse().map((p) => {
        const v = Number(fila[p.name]) || 0;
        return (
          <p key={p.name} className="flex items-center gap-2 text-foreground">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
            <span className="text-muted">{p.name}:</span>
            <span className="tabular-nums">{fmt(v)}{sufijo}{pct && total > 0 ? ` (${fmt((100 * v) / total)} %)` : ""}</span>
          </p>
        );
      })}
      {pct && <p className="mt-1 border-t border-border pt-1 text-muted">Total: <span className="tabular-nums text-foreground">{fmt(total)}</span></p>}
    </div>
  );
}
