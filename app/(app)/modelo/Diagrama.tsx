"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Resultado } from "@/components/Resultado";
import { Aviso } from "@/components/ui";
import type { Resultado as Datos } from "@/lib/db";
import { AREAS, COLUMNAS_COMUNES, DISPOSICION, TABLAS, tipoLegible } from "@/lib/modelo";
import { verDatos } from "./actions";

export type ColumnaVivo = { nombre: string; tipo: string; nulo: boolean; comentario: string | null; pk: boolean; ref: string | null };
export type TablaVivo = { nombre: string; registros: number; comentario: string | null; columnas: ColumnaVivo[] };
export type FuenteVivo = {
  archivo: string;
  estado: string;
  motivo: string | null;
  filas_origen: number | null;
  filas_cargadas: number | null;
  tablas: string[];
};

// Geometría de las cajas (unidades del lienzo).
const ANCHO = 232;
const CABECERA = 42;
const FILA = 18;
const PIE = 20;
const SEPARACION_X = 96;
const SEPARACION_Y = 26;

const TINTA = "#1f2933";
const TENUE = "#5b6676";
const BORDE = "#d5dae1";
const LINEA = "#b4bcc8";

const ESTADOS: Record<string, string> = {
  migrado: "Migrado",
  migrado_parcial: "Migrado en parte",
  excluido: "No se migró",
  pendiente_validacion: "Pendiente",
};

const num = (n: number) => n.toLocaleString("es-MX");
const area = (tabla: string) => AREAS.find((a) => a.id === TABLAS[tabla]?.area) ?? AREAS[AREAS.length - 1];
const titulo = (tabla: string) => TABLAS[tabla]?.titulo ?? tabla;

/** Columnas que se dibujan en la caja: llaves primarias y foráneas (el resto se ve en la ficha). */
const visibles = (t: TablaVivo) => t.columnas.filter((c) => c.pk || c.ref);
const alto = (t: TablaVivo) => {
  const v = visibles(t).length;
  return CABECERA + v * FILA + (t.columnas.length > v ? PIE : 6);
};

type Punto = { x: number; y: number };
type Vista = { x: number; y: number; k: number };
type Arrastre =
  | { tipo: "lienzo"; px: number; py: number; vx: number; vy: number; movido: boolean }
  | { tipo: "tabla"; tabla: string; px: number; py: number; ox: number; oy: number; movido: boolean };

function posicionesIniciales(tablas: TablaVivo[]): Record<string, Punto> {
  const porNombre = new Map(tablas.map((t) => [t.nombre, t]));
  const colocadas = new Set(DISPOSICION.flat());
  const columnas = [...DISPOSICION, tablas.map((t) => t.nombre).filter((n) => !colocadas.has(n)).sort()];
  const pos: Record<string, Punto> = {};
  let i = 0;
  for (const col of columnas) {
    const presentes = col.filter((n) => porNombre.has(n));
    if (presentes.length === 0) continue;
    let y = 0;
    for (const n of presentes) {
      pos[n] = { x: i * (ANCHO + SEPARACION_X), y };
      y += alto(porNombre.get(n)!) + SEPARACION_Y;
    }
    i++;
  }
  return pos;
}

export function Diagrama({ tablas, fuentes }: { tablas: TablaVivo[]; fuentes: FuenteVivo[] }) {
  const porNombre = useMemo(() => new Map(tablas.map((t) => [t.nombre, t])), [tablas]);
  const relaciones = useMemo(
    () =>
      tablas.flatMap((t) =>
        visibles(t).flatMap((c, fila) => (c.ref && porNombre.has(c.ref) ? [{ de: t.nombre, columna: c.nombre, fila, a: c.ref }] : [])),
      ),
    [tablas, porNombre],
  );

  const [pos, setPos] = useState(() => posicionesIniciales(tablas));
  const [vista, setVista] = useState<Vista>({ x: 0, y: 0, k: 1 });
  const [tam, setTam] = useState<{ w: number; h: number } | null>(null);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [encima, setEncima] = useState<string | null>(null);
  const [areaActiva, setAreaActiva] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [muestra, setMuestra] = useState<{ tabla: string; sql: string; datos: Datos } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, iniciar] = useTransition();
  const arrastre = useRef<Arrastre | null>(null);
  const lienzo = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const zonaMuestra = useRef<HTMLDivElement>(null);
  const ficha = useRef<HTMLElement>(null);
  const ajustado = useRef(false);

  /** Vista inicial: todo el diagrama si cabe legible; si no, a 60 % centrado en el historial (el centro del modelo). */
  function inicial(p = pos, t = tam) {
    if (!t) return;
    const k = escalaAjuste(p, t);
    const centro = p.inscripcion_materia;
    if (k >= 0.6 || !centro) return ajustar(p, t);
    setVista({ k: 0.6, x: t.w / 2 - (centro.x + ANCHO / 2) * 0.6, y: 16 - Math.min(...Object.values(p).map((q) => q.y)) * 0.6 });
  }

  function escalaAjuste(p: Record<string, Punto>, t: { w: number; h: number }) {
    const xs = Object.entries(p).map(([n, q]) => [q.x, q.y, q.x + ANCHO, q.y + alto(porNombre.get(n)!)]);
    const w = Math.max(...xs.map((b) => b[2])) - Math.min(...xs.map((b) => b[0]));
    const h = Math.max(...xs.map((b) => b[3])) - Math.min(...xs.map((b) => b[1]));
    return Math.min(t.w / (w + 48), t.h / (h + 48), 1);
  }

  function ajustar(p = pos, t = tam) {
    if (!t) return;
    const xs = Object.entries(p).map(([n, q]) => [q.x, q.y, q.x + ANCHO, q.y + alto(porNombre.get(n)!)]);
    const x0 = Math.min(...xs.map((b) => b[0])), y0 = Math.min(...xs.map((b) => b[1]));
    const x1 = Math.max(...xs.map((b) => b[2])), y1 = Math.max(...xs.map((b) => b[3]));
    const k = Math.min(t.w / (x1 - x0 + 48), t.h / (y1 - y0 + 48), 1);
    setVista({ k, x: (t.w - (x1 - x0) * k) / 2 - x0 * k, y: (t.h - (y1 - y0) * k) / 2 - y0 * k });
  }

  // Tamaño del lienzo; la primera vez se ajusta el diagrama completo a la vista.
  useEffect(() => {
    const el = lienzo.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTam({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (tam && !ajustado.current) {
      ajustado.current = true;
      inicial(pos, tam);
    }
  });

  // Rueda del ratón: acercar o alejar alrededor del puntero (listener no pasivo para evitar el scroll).
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const rueda = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      setVista((v) => {
        const k = Math.min(2, Math.max(0.2, v.k * Math.exp(-e.deltaY * 0.0015)));
        return { k, x: mx - ((mx - v.x) * k) / v.k, y: my - ((my - v.y) * k) / v.k };
      });
    };
    el.addEventListener("wheel", rueda, { passive: false });
    return () => el.removeEventListener("wheel", rueda);
  }, [tam]);

  function zoom(f: number) {
    if (!tam) return;
    setVista((v) => {
      const k = Math.min(2, Math.max(0.2, v.k * f));
      return { k, x: tam.w / 2 - ((tam.w / 2 - v.x) * k) / v.k, y: tam.h / 2 - ((tam.h / 2 - v.y) * k) / v.k };
    });
  }

  /** Selecciona una tabla y la centra en el lienzo. */
  function elegir(tabla: string, centrar = true) {
    setSeleccion(tabla);
    setError(null);
    if (centrar && tam && pos[tabla]) {
      const k = Math.max(vista.k, 0.75);
      const t = porNombre.get(tabla)!;
      setVista({ k, x: tam.w / 2 - (pos[tabla].x + ANCHO / 2) * k, y: tam.h / 2 - (pos[tabla].y + alto(t) / 2) * k });
    }
  }

  function abajo(e: React.PointerEvent, tabla?: string) {
    if (e.button !== 0) return;
    e.stopPropagation();
    svg.current?.setPointerCapture(e.pointerId);
    arrastre.current = tabla
      ? { tipo: "tabla", tabla, px: e.clientX, py: e.clientY, ox: pos[tabla].x, oy: pos[tabla].y, movido: false }
      : { tipo: "lienzo", px: e.clientX, py: e.clientY, vx: vista.x, vy: vista.y, movido: false };
  }
  function mover(e: React.PointerEvent) {
    const a = arrastre.current;
    if (!a) return;
    const dx = e.clientX - a.px, dy = e.clientY - a.py;
    if (Math.abs(dx) + Math.abs(dy) > 3) a.movido = true;
    if (a.tipo === "lienzo") setVista((v) => ({ ...v, x: a.vx + dx, y: a.vy + dy }));
    else {
      if (a.movido) setPos((p) => ({ ...p, [a.tabla]: { x: a.ox + dx / vista.k, y: a.oy + dy / vista.k } }));
    }
  }
  function arriba() {
    const a = arrastre.current;
    arrastre.current = null;
    // Un toque sin arrastrar: en una tabla la elige; en el fondo quita la selección.
    if (a && !a.movido) {
      if (a.tipo === "tabla") {
        elegir(a.tabla, false);
        // En pantallas angostas la ficha queda debajo del lienzo: se lleva a la vista.
        if (window.innerWidth < 1280) setTimeout(() => ficha.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      }
      else setSeleccion(null);
    }
  }

  function cargarDatos(tabla: string) {
    setError(null);
    iniciar(async () => {
      const r = await verDatos(tabla);
      if (r.ok) {
        setMuestra({ tabla, sql: r.sql, datos: r });
        setTimeout(() => zonaMuestra.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      } else setError(r.error);
    });
  }

  function buscar(texto: string) {
    setBusqueda(texto);
    const q = texto.trim().toLowerCase();
    const t = tablas.find((x) => x.nombre === q) ?? tablas.find((x) => titulo(x.nombre).toLowerCase() === q);
    if (t) elegir(t.nombre);
  }

  // Qué se resalta: la tabla bajo el puntero o la seleccionada, con sus vecinas; o un área completa.
  const foco = encima ?? seleccion;
  const vecinas = useMemo(() => {
    if (!foco) return null;
    const s = new Set([foco]);
    for (const r of relaciones) {
      if (r.de === foco) s.add(r.a);
      if (r.a === foco) s.add(r.de);
    }
    return s;
  }, [foco, relaciones]);
  const resaltada = (n: string) => (vecinas ? vecinas.has(n) : areaActiva ? TABLAS[n]?.area === areaActiva : true);

  const totalRegistros = tablas.reduce((s, t) => s + t.registros, 0);
  const sel = seleccion ? porNombre.get(seleccion) : undefined;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* ── Lienzo ── */}
        <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
            <input
              list="tablas-modelo"
              value={busqueda}
              onChange={(e) => buscar(e.target.value)}
              placeholder="Buscar tabla…"
              aria-label="Buscar tabla"
              className="w-44 rounded-md border border-border bg-white px-2 py-1 text-sm"
            />
            <datalist id="tablas-modelo">
              {tablas.map((t) => (
                <option key={t.nombre} value={t.nombre} label={titulo(t.nombre)} />
              ))}
            </datalist>
            <div className="ml-auto flex items-center gap-1">
              <BotonLienzo onClick={() => zoom(1 / 1.25)} etiqueta="Alejar">−</BotonLienzo>
              <span className="w-12 text-center text-xs tabular-nums text-muted">{Math.round(vista.k * 100)} %</span>
              <BotonLienzo onClick={() => zoom(1.25)} etiqueta="Acercar">+</BotonLienzo>
              <BotonLienzo onClick={() => ajustar()} etiqueta="Ver todo">Ver todo</BotonLienzo>
              <BotonLienzo
                onClick={() => {
                  const p = posicionesIniciales(tablas);
                  setPos(p);
                  inicial(p);
                }}
                etiqueta="Reacomodar las tablas">
                Reacomodar
              </BotonLienzo>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2">
            {AREAS.map((a) => {
              const activa = areaActiva === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => {
                    setAreaActiva(activa ? null : a.id);
                    setSeleccion(null);
                  }}
                  title={a.descripcion}
                  aria-pressed={activa}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${
                    activa ? "border-foreground/40 bg-background text-foreground" : "border-border text-muted hover:text-foreground"
                  }`}>
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: a.color }} />
                  {a.nombre}
                </button>
              );
            })}
          </div>
          <div ref={lienzo} className="relative h-[460px] md:h-[620px]" style={{ touchAction: "none" }}>
            {tam && (
              <svg
                ref={svg}
                width={tam.w}
                height={tam.h}
                className="block cursor-grab select-none active:cursor-grabbing"
                onPointerDown={(e) => abajo(e)}
                onPointerMove={mover}
                onPointerUp={arriba}
                onPointerCancel={() => (arrastre.current = null)}
                role="img"
                aria-label={`Diagrama de ${tablas.length} tablas y ${relaciones.length} relaciones`}>
                <defs>
                  <pattern id="puntos" width={24 * vista.k} height={24 * vista.k} patternUnits="userSpaceOnUse" x={vista.x} y={vista.y}>
                    <circle cx={1} cy={1} r={1} fill="#e3e7ec" />
                  </pattern>
                </defs>
                <rect width={tam.w} height={tam.h} fill="#fbfcfd" />
                <rect width={tam.w} height={tam.h} fill="url(#puntos)" />
                <g transform={`translate(${vista.x},${vista.y}) scale(${vista.k})`}>
                  {relaciones.map((r) => {
                    const activa = foco ? r.de === foco || r.a === foco : areaActiva ? TABLAS[r.de]?.area === areaActiva || TABLAS[r.a]?.area === areaActiva : false;
                    const atenuada = (foco || areaActiva) && !activa;
                    const color = activa ? area(foco ?? r.de).color : LINEA;
                    return (
                      <Relacion key={`${r.de}.${r.columna}`} r={r} pos={pos} destino={porNombre.get(r.a)!}
                        color={color} grosor={activa ? 2 : 1.25} opacidad={atenuada ? 0.12 : 1} />
                    );
                  })}
                  {tablas.map((t) => (
                    <Caja
                      key={t.nombre}
                      t={t}
                      p={pos[t.nombre]}
                      seleccionada={seleccion === t.nombre}
                      atenuada={!resaltada(t.nombre)}
                      foco={foco}
                      onPointerDown={(e) => abajo(e, t.nombre)}
                      onEnter={() => !arrastre.current && setEncima(t.nombre)}
                      onLeave={() => setEncima(null)}
                      onElegir={() => elegir(t.nombre)}
                    />
                  ))}
                </g>
              </svg>
            )}
            <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-muted">
              Arrastra para moverte o mover tablas · rueda o +/− para acercar · toca una tabla para ver su ficha
            </p>
          </div>
        </section>

        {/* ── Ficha ── */}
        <aside ref={ficha} className="scroll-mt-4 rounded-lg border border-border bg-card p-4 xl:max-h-[731px] xl:overflow-y-auto">
          {sel ? (
            <Ficha
              t={sel}
              fuentes={fuentes.filter((f) => f.tablas.includes(sel.nombre))}
              relaciones={relaciones}
              cargando={cargando}
              error={error}
              onElegir={elegir}
              onVerDatos={() => cargarDatos(sel.nombre)}
              onCerrar={() => setSeleccion(null)}
            />
          ) : (
            <Indice tablas={tablas} relaciones={relaciones.length} registros={totalRegistros} onElegir={elegir} />
          )}
        </aside>
      </div>

      {/* ── Datos de la tabla ── */}
      <div ref={zonaMuestra} className="scroll-mt-4">
        {muestra && (
          <section className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                Datos de «{titulo(muestra.tabla)}» <span className="font-mono text-sm font-normal text-muted">{muestra.tabla}</span>
              </h2>
              <button onClick={() => setMuestra(null)} className="text-sm text-muted hover:text-foreground">Cerrar</button>
            </div>
            <Resultado
              key={muestra.sql}
              fuente={{ t: "sql", q: muestra.sql }}
              inicial={muestra.datos}
              titulo={`Tabla ${muestra.tabla}`}
              filtros={[["Tabla", muestra.tabla]]}
            />
          </section>
        )}
      </div>

      <Procedencia fuentes={fuentes} onElegir={(t) => { elegir(t); lienzo.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }} />
    </div>
  );
}

function BotonLienzo({ onClick, etiqueta, children }: { onClick: () => void; etiqueta: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={etiqueta} aria-label={etiqueta}
      className="min-w-8 rounded-md border border-border bg-white px-2 py-1 text-xs text-foreground hover:bg-background">
      {children}
    </button>
  );
}

function Relacion({
  r, pos, destino, color, grosor, opacidad,
}: {
  r: { de: string; fila: number; a: string };
  pos: Record<string, Punto>;
  destino: TablaVivo;
  color: string;
  grosor: number;
  opacidad: number;
}) {
  const s = pos[r.de], t = pos[r.a];
  const sy = s.y + CABECERA + r.fila * FILA + FILA / 2;
  // Llega a la fila de la llave primaria del destino (o a su cabecera si no la dibuja).
  const filaPk = visibles(destino).findIndex((c) => c.pk);
  const ty = filaPk >= 0 ? t.y + CABECERA + filaPk * FILA + FILA / 2 : t.y + CABECERA / 2;
  let d: string, fx: number;
  if (r.de === r.a) {
    const x = s.x + ANCHO;
    d = `M${x},${sy} C${x + 44},${sy} ${x + 44},${ty} ${x},${ty}`;
    fx = x;
  } else if (t.x > s.x + ANCHO / 2) {
    const sx = s.x + ANCHO, tx = t.x, c = Math.max(40, (tx - sx) / 2);
    d = `M${sx},${sy} C${sx + c},${sy} ${tx - c},${ty} ${tx},${ty}`;
    fx = tx;
  } else if (t.x < s.x - ANCHO / 2) {
    const sx = s.x, tx = t.x + ANCHO, c = Math.max(40, (sx - tx) / 2);
    d = `M${sx},${sy} C${sx - c},${sy} ${tx + c},${ty} ${tx},${ty}`;
    fx = tx;
  } else {
    // Misma columna: rodea por la derecha.
    const x = Math.max(s.x, t.x) + ANCHO, c = 36 + Math.min(Math.abs(ty - sy) / 8, 40);
    d = `M${s.x + ANCHO},${sy} C${x + c},${sy} ${x + c},${ty} ${t.x + ANCHO},${ty}`;
    fx = t.x + ANCHO;
  }
  return (
    <g opacity={opacidad} pointerEvents="none">
      <path d={d} fill="none" stroke={color} strokeWidth={grosor} />
      <circle cx={fx} cy={ty} r={3.5} fill="#fff" stroke={color} strokeWidth={grosor} />
    </g>
  );
}

function Caja({
  t, p, seleccionada, atenuada, foco, onPointerDown, onEnter, onLeave, onElegir,
}: {
  t: TablaVivo;
  p: Punto;
  seleccionada: boolean;
  atenuada: boolean;
  foco: string | null;
  onPointerDown: (e: React.PointerEvent) => void;
  onEnter: () => void;
  onLeave: () => void;
  onElegir: () => void;
}) {
  const a = area(t.nombre);
  const cols = visibles(t);
  const h = alto(t);
  const resto = t.columnas.length - cols.length;
  return (
    <g
      transform={`translate(${p.x},${p.y})`}
      opacity={atenuada ? 0.28 : 1}
      onPointerDown={onPointerDown}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onElegir())}
      tabIndex={0}
      role="button"
      aria-label={`${titulo(t.nombre)}: ${num(t.registros)} registros`}
      className="cursor-pointer outline-none">
      <rect width={ANCHO} height={h} rx={8} fill="#fff" stroke={seleccionada ? a.color : BORDE} strokeWidth={seleccionada ? 2.5 : 1} />
      <path d={`M0,8 a8,8 0 0 1 8,-8 h${ANCHO - 16} a8,8 0 0 1 8,8 v${CABECERA - 8} h-${ANCHO} z`} fill={a.color} fillOpacity={0.14} />
      <rect width={4} height={CABECERA - 12} x={0} y={6} fill={a.color} />
      <text x={12} y={18} fontSize={12} fontWeight={600} fill={TINTA} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">{t.nombre}</text>
      <text x={12} y={33} fontSize={10.5} fill={TENUE}>
        {titulo(t.nombre) !== t.nombre ? `${titulo(t.nombre).slice(0, 24)}${titulo(t.nombre).length > 24 ? "…" : ""} · ` : ""}
        {num(t.registros)} reg.
      </text>
      {cols.map((c, i) => {
        const y = CABECERA + i * FILA;
        const liga = foco && c.ref === foco && foco !== t.nombre;
        return (
          <g key={c.nombre} transform={`translate(0,${y})`}>
            {liga && <rect x={1} width={ANCHO - 2} height={FILA} fill={area(foco).color} fillOpacity={0.12} />}
            <text x={12} y={13} fontSize={9} fontWeight={700} fill={c.pk ? "#9a6b00" : TENUE}>{c.pk ? "PK" : "FK"}</text>
            <text x={34} y={13} fontSize={11} fill={TINTA} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">{c.nombre}</text>
          </g>
        );
      })}
      {resto > 0 && (
        <text x={12} y={CABECERA + cols.length * FILA + 14} fontSize={10.5} fill={TENUE}>
          + {resto} {resto === 1 ? "campo" : "campos"} más
        </text>
      )}
    </g>
  );
}

function Indice({
  tablas, relaciones, registros, onElegir,
}: {
  tablas: TablaVivo[];
  relaciones: number;
  registros: number;
  onElegir: (t: string) => void;
}) {
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          [tablas.length, "tablas"],
          [relaciones, "relaciones"],
          [registros, "registros"],
        ].map(([n, t]) => (
          <div key={t} className="rounded-md bg-background px-2 py-2">
            <p className="text-lg font-semibold tabular-nums text-foreground">{num(Number(n))}</p>
            <p className="text-xs text-muted">{t}</p>
          </div>
        ))}
      </div>
      <p className="text-muted">
        Cada <b className="text-foreground">tabla</b> guarda un solo tipo de cosa y cada <b className="text-foreground">relación</b> (línea) une una
        columna <b className="text-foreground">FK</b> con la <b className="text-foreground">PK</b> (identificador) de otra tabla. Así un dato se
        escribe una sola vez: el nombre de una materia vive en «materias» y el historial solo apunta a ella.
      </p>
      {AREAS.map((a) => {
        const del = tablas.filter((t) => area(t.nombre).id === a.id);
        if (del.length === 0) return null;
        return (
          <div key={a.id}>
            <p className="flex items-center gap-2 font-medium text-foreground">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: a.color }} />
              {a.nombre}
            </p>
            <p className="mb-1 text-xs text-muted">{a.descripcion}</p>
            <ul className="space-y-0.5">
              {del.map((t) => (
                <li key={t.nombre}>
                  <button onClick={() => onElegir(t.nombre)} className="flex w-full items-baseline justify-between gap-2 rounded px-1 text-left hover:bg-background">
                    <span className="text-foreground">{titulo(t.nombre)}</span>
                    <span className="text-xs tabular-nums text-muted">{num(t.registros)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function Ficha({
  t, fuentes, relaciones, cargando, error, onElegir, onVerDatos, onCerrar,
}: {
  t: TablaVivo;
  fuentes: FuenteVivo[];
  relaciones: { de: string; columna: string; a: string }[];
  cargando: boolean;
  error: string | null;
  onElegir: (t: string) => void;
  onVerDatos: () => void;
  onCerrar: () => void;
}) {
  const info = TABLAS[t.nombre];
  const a = area(t.nombre);
  const usa = relaciones.filter((r) => r.de === t.nombre && r.a !== t.nombre);
  const usadaPor = relaciones.filter((r) => r.a === t.nombre && r.de !== t.nombre);
  const descripcion = (c: ColumnaVivo) =>
    info?.columnas?.[c.nombre] ?? c.comentario ?? (c.ref ? `Liga con «${titulo(c.ref)}».` : COLUMNAS_COMUNES[c.nombre] ?? "");

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: a.color }} />
            {a.nombre}
          </p>
          <h2 className="text-lg font-semibold text-foreground">{titulo(t.nombre)}</h2>
          <p className="font-mono text-xs text-muted">{t.nombre} · {num(t.registros)} registros · {t.columnas.length} columnas</p>
        </div>
        <button onClick={onCerrar} className="text-muted hover:text-foreground" aria-label="Cerrar ficha">✕</button>
      </div>

      <button onClick={onVerDatos} disabled={cargando || t.registros === 0}
        className="w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50">
        {cargando ? "Consultando…" : t.registros === 0 ? "Esta tabla aún no tiene registros" : "Ver sus datos"}
      </button>
      {error && <Aviso tipo="error">{error}</Aviso>}

      {info ? (
        <>
          <Bloque titulo="Qué guarda">{info.que}</Bloque>
          <Bloque titulo="Por qué es una tabla">{info.porque}</Bloque>
          <Bloque titulo="De dónde vienen sus datos">
            {info.origen}
            {fuentes.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {fuentes.map((f) => (
                  <li key={f.archivo} className="rounded-md bg-background px-2 py-1.5 text-xs">
                    <span className="font-mono text-foreground">{f.archivo}</span>{" "}
                    <Estado estado={f.estado} />
                    {f.filas_origen !== null && (
                      <span className="block text-muted">
                        {num(f.filas_origen)} filas leídas → {num(f.filas_cargadas ?? 0)} registros cargados
                      </span>
                    )}
                    {f.motivo && <span className="block text-muted">{f.motivo}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Bloque>
        </>
      ) : (
        t.comentario && <Bloque titulo="Qué guarda">{t.comentario}</Bloque>
      )}

      {(usa.length > 0 || usadaPor.length > 0) && (
        <div className="space-y-2">
          {usa.length > 0 && (
            <Vinculos titulo="Apunta a" lista={usa.map((r) => ({ tabla: r.a, por: r.columna }))} onElegir={onElegir} />
          )}
          {usadaPor.length > 0 && (
            <Vinculos titulo="La usan" lista={usadaPor.map((r) => ({ tabla: r.de, por: r.columna }))} onElegir={onElegir} />
          )}
        </div>
      )}

      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Columnas</h3>
        <ul className="divide-y divide-border rounded-md border border-border">
          {t.columnas.map((c) => (
            <li key={c.nombre} className="px-2 py-1.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-xs font-medium text-foreground">{c.nombre}</span>
                {c.pk && <span className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">PK</span>}
                {c.ref && (
                  <button onClick={() => onElegir(c.ref!)} className="rounded bg-background px-1 text-[10px] font-semibold text-brand hover:underline">
                    FK → {c.ref}
                  </button>
                )}
                <span className="ml-auto text-[11px] text-muted">{tipoLegible(c.tipo)}{c.nulo ? "" : " · obligatorio"}</span>
              </div>
              {descripcion(c) && <p className="text-xs text-muted">{descripcion(c)}</p>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-muted">{titulo}</h3>
      <div className="leading-relaxed text-foreground">{children}</div>
    </div>
  );
}

function Vinculos({ titulo: t, lista, onElegir }: { titulo: string; lista: { tabla: string; por: string }[]; onElegir: (t: string) => void }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{t}</h3>
      <div className="flex flex-wrap gap-1.5">
        {lista.map((v) => (
          <button key={`${v.tabla}.${v.por}`} onClick={() => onElegir(v.tabla)} title={`por la columna ${v.por}`}
            className="flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs text-foreground hover:bg-background">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: area(v.tabla).color }} />
            {titulo(v.tabla)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Estado({ estado }: { estado: string }) {
  const color =
    estado === "migrado" ? "bg-green-100 text-green-800"
    : estado === "migrado_parcial" ? "bg-amber-100 text-amber-800"
    : estado === "excluido" ? "bg-slate-200 text-slate-700"
    : "bg-blue-100 text-blue-800";
  return <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold ${color}`}>{ESTADOS[estado] ?? estado}</span>;
}

function Procedencia({ fuentes, onElegir }: { fuentes: FuenteVivo[]; onElegir: (t: string) => void }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-lg font-semibold text-foreground">De dónde salieron los datos</h2>
        <p className="max-w-3xl text-sm text-muted">
          Cada archivo del sistema anterior y a qué tablas fue a dar. Las filas leídas suelen ser más que los registros cargados porque el mismo
          dato estaba copiado en varias carpetas (expediente, Web, reportes); nada se descartó sin quedar registrado.
        </p>
      </div>
      <ul className="divide-y divide-border md:hidden">
        {fuentes.map((f) => (
          <li key={f.archivo} className="space-y-1 px-4 py-3 text-sm">
            <p className="flex flex-wrap items-center gap-2">
              <span className="break-all font-mono text-xs text-foreground">{f.archivo}</span>
              <Estado estado={f.estado} />
            </p>
            {f.filas_origen !== null && (
              <p className="text-xs text-muted">
                {num(f.filas_origen)} filas leídas → {num(f.filas_cargadas ?? 0)} registros cargados
              </p>
            )}
            {f.tablas.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {f.tablas.map((t) => (
                  <button key={t} onClick={() => onElegir(t)} className="rounded bg-background px-1.5 font-mono text-xs text-brand">{t}</button>
                ))}
              </div>
            )}
            {f.motivo && <p className="text-xs text-muted">{f.motivo}</p>}
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-background text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Archivo del sistema anterior</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium">Tablas destino</th>
              <th className="px-4 py-2 text-right font-medium">Filas leídas</th>
              <th className="px-4 py-2 text-right font-medium">Registros cargados</th>
              <th className="px-4 py-2 font-medium">Nota</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {fuentes.map((f) => (
              <tr key={f.archivo} className="align-top">
                <td className="px-4 py-2 font-mono text-xs text-foreground">{f.archivo}</td>
                <td className="px-4 py-2"><Estado estado={f.estado} /></td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {f.tablas.map((t) => (
                      <button key={t} onClick={() => onElegir(t)} className="rounded bg-background px-1.5 font-mono text-xs text-brand hover:underline">{t}</button>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{f.filas_origen === null ? "—" : num(f.filas_origen)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{f.filas_cargadas === null ? "—" : num(f.filas_cargadas)}</td>
                <td className="max-w-md px-4 py-2 text-xs text-muted">{f.motivo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
