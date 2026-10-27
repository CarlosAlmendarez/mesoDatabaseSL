import ExcelJS from "exceljs";
import { exigirSesion } from "@/lib/auth";
import { consultar, consultarParaExportar, LIMITE_EXPORTAR, type Resultado } from "@/lib/db";
import { etiqueta } from "@/lib/etiquetas";
import { consultaAgrupada, consultaBase, decodificar, type Agrupacion, type Fuente } from "@/lib/fuentes";
import { llamadaLegible } from "@/lib/procedimientos";

export const maxDuration = 60;

export type PedidoExportacion = {
  fuente: Fuente;
  agrupacion?: Agrupacion | null;
  titulo: string;
  filtros?: [string, string][];
};

// GET /api/exportar?p=<pedido en base64url>&formato=xlsx|csv
export async function GET(request: Request) {
  try {
    await exigirSesion();
  } catch {
    return new Response("Sesión expirada", { status: 401 });
  }
  const url = new URL(request.url);
  const formato = url.searchParams.get("formato") === "csv" ? "csv" : "xlsx";
  let pedido: PedidoExportacion;
  try {
    pedido = decodificar<PedidoExportacion>(url.searchParams.get("p") ?? "");
  } catch {
    return new Response("Pedido inválido", { status: 400 });
  }

  let r: Resultado;
  let consulta: { texto: string; params: unknown[] };
  try {
    const base = consultaBase(pedido.fuente);
    if (!base.envolvible) return new Response("Solo se pueden exportar consultas SELECT.", { status: 400 });
    consulta = base;
    if (pedido.agrupacion?.grupos.length) {
      const { tipos } = await consultar(`SELECT * FROM (${base.texto}\n) AS base LIMIT 0`, base.params);
      consulta = consultaAgrupada(base, tipos, pedido.agrupacion);
    }
    r = await consultarParaExportar(consulta.texto, consulta.params);
  } catch (e) {
    return new Response(e instanceof Error ? e.message : String(e), { status: 400 });
  }

  const nombre = `${pedido.titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "_").slice(0, 60)}_${new Date().toISOString().slice(0, 10)}`;

  if (formato === "csv") {
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : typeof v === "boolean" ? (v ? "Sí" : "No") : typeof v === "object" ? JSON.stringify(v) : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [r.columnas.map((c) => esc(etiqueta(c))).join(","), ...r.filas.map((f) => r.columnas.map((c) => esc(f[c])).join(","))].join("\r\n");
    return new Response("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nombre}.csv"`,
      },
    });
  }

  const libro = new ExcelJS.Workbook();
  libro.creator = "UNIMES · Control Escolar (demo)";
  libro.created = new Date();
  const hoja = libro.addWorksheet("Datos", { views: [{ state: "frozen", ySplit: 1 }] });
  hoja.columns = r.columnas.map((c) => {
    const largo = Math.max(etiqueta(c).length, ...r.filas.slice(0, 300).map((f) => String(f[c] ?? "").length));
    const tipo = r.tipos[c];
    // Enteros sin decimales; años, semestres y claves numéricas sin separador de miles.
    const enteros = r.filas.every((f) => f[c] === null || f[c] === undefined || Number.isInteger(Number(f[c])));
    const formato = /anio|semestre|generacion|lugar|^id$|_id$/.test(c) ? "0" : enteros ? "#,##0" : "#,##0.00";
    return {
      header: etiqueta(c),
      key: c,
      width: Math.min(Math.max(largo + 2, 8), 60),
      style: tipo === "fecha" ? { numFmt: "dd/mm/yyyy" } : tipo === "numero" ? { numFmt: formato } : {},
    };
  });
  for (const f of r.filas) {
    const fila: Record<string, unknown> = {};
    for (const c of r.columnas) {
      const v = f[c];
      if (r.tipos[c] === "fecha" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) fila[c] = new Date(v.slice(0, 10) + "T12:00:00");
      else if (typeof v === "boolean") fila[c] = v ? "Sí" : "No";
      else if (v !== null && typeof v === "object") fila[c] = JSON.stringify(v);
      else fila[c] = v;
    }
    hoja.addRow(fila);
  }
  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true, color: { argb: "FF1F4E79" } };
  encabezado.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F0F8" } };
  if (r.columnas.length) hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: r.columnas.length } };

  const info = libro.addWorksheet("Información");
  info.columns = [{ width: 24 }, { width: 100 }];
  const filasInfo: [string, string][] = [
    ["Reporte", pedido.titulo],
    ...(pedido.filtros ?? []),
    ...(pedido.agrupacion?.grupos.length ? [["Agrupado por", pedido.agrupacion.grupos.map(etiqueta).join(", ")] as [string, string]] : []),
    ["Filas", r.filas.length.toLocaleString("es-MX") + (r.truncado ? ` (se exportaron las primeras ${LIMITE_EXPORTAR.toLocaleString("es-MX")})` : "")],
    ["Generado", new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" })],
    ["Origen", "Base de datos de Control Escolar UNIMES, plantel San Luis Potosí"],
    ["Consulta", llamadaLegible(consulta.texto, consulta.params)],
  ];
  for (const [k, v] of filasInfo) {
    const fila = info.addRow([k, v]);
    fila.getCell(1).font = { bold: true };
    fila.getCell(2).alignment = { wrapText: true, vertical: "top" };
  }

  const buffer = await libro.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}.xlsx"`,
    },
  });
}
