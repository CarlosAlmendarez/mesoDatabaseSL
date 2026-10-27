import { Suspense } from "react";
import Link from "next/link";
import { filas } from "@/lib/db";
import { etiquetaCiclo } from "@/lib/etiquetas";
import { CLAVE, LIC, nombreLicenciatura, TRAYECTORIA } from "@/lib/trayectoria";
import { Barras } from "@/components/Barras";
import { Grafica } from "@/components/Grafica";
import { SERIES } from "@/lib/paleta";
import { Imprimir } from "@/components/Imprimir";
import { Selector } from "@/components/Selector";
import { Cargando, Titulo } from "@/components/ui";

type Props = { searchParams: Promise<{ lic?: string }> };

export default function Tablero(props: Props) {
  return (
    <>
      <Titulo
        titulo="Tablero para rectoría"
        subtitulo="Indicadores del plantel en una sola pantalla: matrícula, nuevo ingreso, reprobación y qué pasó con cada generación (eficiencia terminal, titulación y deserción). Cada gráfica lleva a su reporte para ver el detalle y exportarlo."
      />
      <Suspense fallback={<Cargando texto="Calculando los indicadores…" />}>
        <Contenido {...props} />
      </Suspense>
    </>
  );
}

type PorCiclo = {
  ciclo: string; orden: number; alumnos: number; nuevo_ingreso: number;
  promedio: number | null; pct_reprobacion: number | null; ultimo: number; cerrado: number;
};
type Generacion = {
  generacion: number; ingreso: number; titulados: number; egresados_sin_titulo: number; siguen: number;
  dejaron: number; egresados: number; base_retencion: number; retenidos: number;
};
type PorGrupo = {
  grupo: string; orden: number; mujeres: number; hombres: number; sin_dato: number; alumnos: number; pct_reprobacion: number | null;
};

const FILTRO = "($1::text IS NULL OR licenciatura = $1)";

async function Contenido({ searchParams }: Props) {
  const { lic: licParam } = await searchParams;
  const lic = licParam?.trim() || null;
  const [licenciaturas, ciclos, generaciones, grupos] = await Promise.all([
    filas<{ valor: string; alumnos: number; claves: string }>(`
      SELECT ${LIC()} AS valor, count(a.id) AS alumnos, string_agg(DISTINCT ca.clave, ', ' ORDER BY ca.clave) AS claves
      FROM carreras ca JOIN alumnos a ON a.carrera_id = ca.id
      GROUP BY 1 ORDER BY 2 DESC`),
    filas<PorCiclo>(`
      WITH ${TRAYECTORIA},
      f AS (SELECT * FROM tray WHERE ${FILTRO})
      SELECT ${CLAVE("m.o")} AS ciclo, m.o AS orden, m.alumnos, coalesce(n.nuevo, 0) AS nuevo_ingreso,
             m.promedio, m.pct_reprobacion, r.ultimo, r.cerrado
      FROM (SELECT fn_ciclo_orden(c.clave) AS o, count(DISTINCT i.alumno_id) AS alumnos,
                   round(avg(i.calificacion_final), 2) AS promedio,
                   round(100.0 * count(*) FILTER (WHERE NOT i.aprobada AND i.calificacion_final IS NOT NULL)
                         / nullif(count(i.calificacion_final), 0), 1) AS pct_reprobacion
            FROM inscripcion_materia i
            JOIN ciclos_escolares c ON c.id = i.ciclo_id
            JOIN f ON f.alumno_id = i.alumno_id
            WHERE c.clave ~ '^\\d\\d-[12]$' AND i.fecha_baja IS NULL
            GROUP BY 1) m
      LEFT JOIN (SELECT o_ini, count(*) AS nuevo FROM f GROUP BY o_ini) n ON n.o_ini = m.o
      CROSS JOIN ciclos_ref r
      WHERE m.o >= 20011
      ORDER BY m.o`, [lic]),
    filas<Generacion>(`
      WITH ${TRAYECTORIA}
      SELECT generacion, count(*) AS ingreso,
             count(*) FILTER (WHERE situacion = 'Titulados') AS titulados,
             count(*) FILTER (WHERE situacion = 'Egresados sin título') AS egresados_sin_titulo,
             count(*) FILTER (WHERE situacion = 'Siguen estudiando') AS siguen,
             count(*) FILTER (WHERE situacion = 'Dejaron de inscribirse') AS dejaron,
             count(*) FILTER (WHERE egresado) AS egresados,
             count(*) FILTER (WHERE o_ini + 10 <= r.ultimo) AS base_retencion,
             count(*) FILTER (WHERE o_ini + 10 <= r.ultimo AND o_fin >= o_ini + 10) AS retenidos
      FROM tray CROSS JOIN ciclos_ref r
      WHERE generacion >= 2001 AND ${FILTRO}
      GROUP BY generacion
      ORDER BY generacion`, [lic]),
    filas<PorGrupo>(`
      WITH ${TRAYECTORIA},
      ac AS (
        SELECT i.alumno_id, fn_ciclo_orden(c.clave) AS o, max(i.semestre) AS sem, count(i.calificacion_final) AS calif,
               count(*) FILTER (WHERE NOT i.aprobada AND i.calificacion_final IS NOT NULL) AS reprob
        FROM inscripcion_materia i
        JOIN ciclos_escolares c ON c.id = i.ciclo_id
        CROSS JOIN ciclos_ref r
        WHERE fn_ciclo_orden(c.clave) IN (r.ultimo, r.cerrado, r.cerrado - 10) AND i.fecha_baja IS NULL
        GROUP BY 1, 2)
      SELECT CASE WHEN $1::text IS NULL THEN t.licenciatura ELSE 'Semestre ' || ac.sem END AS grupo, ac.o AS orden,
             count(*) FILTER (WHERE t.sexo = 'mujer') AS mujeres, count(*) FILTER (WHERE t.sexo = 'hombre') AS hombres,
             count(*) FILTER (WHERE t.sexo IS NULL) AS sin_dato, count(*) AS alumnos,
             round(100.0 * sum(ac.reprob) / nullif(sum(ac.calif), 0), 1) AS pct_reprobacion
      FROM ac JOIN tray t ON t.alumno_id = ac.alumno_id
      WHERE ${FILTRO}
      GROUP BY 1, 2`, [lic]),
  ]);

  const opciones = licenciaturas.map((l) => ({
    valor: l.valor,
    etiqueta: nombreLicenciatura(l.valor),
    detalle: `clave${l.claves.includes(",") ? "s" : ""} ${l.claves} · ${Number(l.alumnos).toLocaleString("es-MX")} alumnos`,
  }));
  const filtro = (
    <form className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 print:hidden">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Licenciatura</span>
        <Selector name="lic" opciones={opciones} defaultValue={lic ?? ""} vacio="Todo el plantel" ancho="w-80" />
      </label>
      <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white">Aplicar</button>
      {lic && <Link href="/tablero" className="px-2 py-2 text-sm text-muted hover:text-brand">Ver todo el plantel</Link>}
      <span className="ml-auto"><Imprimir /></span>
      <p className="w-full text-xs text-muted">Une los planes de una misma licenciatura (por ejemplo, Derecho = claves 05, 50 y 55).</p>
    </form>
  );
  if (ciclos.length === 0) return <>{filtro}<p className="text-sm text-muted">No hay datos para esta licenciatura.</p></>;

  const { ultimo, cerrado } = ciclos[0];
  const enCiclo = (o: number) => ciclos.find((c) => Number(c.orden) === o);
  const clave = (o: number) => `${String(Math.floor(o / 10)).slice(2)}-${o % 10}`;
  const ult = enCiclo(ultimo), ultAnt = enCiclo(ultimo - 10);
  const cer = enCiclo(cerrado), cerAnt = enCiclo(cerrado - 10);
  // Ciclo escolar (ago–jul) del último ciclo: el -1 y el -2 del mismo año.
  const anioEsc = Math.floor(ultimo / 10);
  const nuevo = (a: number) => ciclos.filter((c) => Math.floor(Number(c.orden) / 10) === a).reduce((t, c) => t + Number(c.nuevo_ingreso), 0);
  // Generaciones cerradas: empezaron hace 6 años o más (planes de 8–9 semestres + margen).
  const ultimaCerrada = Math.floor(ultimo / 10) - 6;
  const cerradas = generaciones.filter((g) => g.generacion <= ultimaCerrada && g.generacion > ultimaCerrada - 5);
  const sumar = (k: keyof Generacion) => cerradas.reduce((t, g) => t + Number(g[k]), 0);
  const ingresoCerradas = sumar("ingreso");
  const ultimaConTitulados = generaciones.filter((g) => Number(g.titulados) > 0).at(-1)?.generacion;
  const pct = (a: number, b: number) => (b > 0 ? (100 * a) / b : null);

  const n = (v: number | null | undefined, d = 0) =>
    v === null || v === undefined ? "—" : Number(v).toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });
  const rangoCerradas = cerradas.length ? `${cerradas[0].generacion}–${cerradas[cerradas.length - 1].generacion}` : "";

  const kpis: Kpi[] = [
    {
      titulo: `Matrícula ${clave(ultimo)}`, valor: n(ult?.alumnos),
      nota: ultAnt ? `${delta(ult?.alumnos, ultAnt.alumnos)} contra ${clave(ultimo - 10)} (${n(ultAnt.alumnos)})` : undefined,
    },
    {
      titulo: `Nuevo ingreso ${anioEsc - 1}–${anioEsc}`, valor: n(nuevo(anioEsc)),
      nota: `${delta(nuevo(anioEsc), nuevo(anioEsc - 1))} contra ${anioEsc - 2}–${anioEsc - 1} (${n(nuevo(anioEsc - 1))})`,
    },
    {
      titulo: `Reprobación ${clave(cerrado)}`, valor: `${n(cer?.pct_reprobacion, 1)} %`,
      nota: cerAnt ? `${puntos(cer?.pct_reprobacion, cerAnt.pct_reprobacion)} contra ${clave(cerrado - 10)} (${n(cerAnt.pct_reprobacion, 1)} %)` : undefined,
    },
    {
      titulo: `Promedio ${clave(cerrado)}`, valor: n(cer?.promedio, 2),
      nota: cerAnt ? `${clave(cerrado - 10)}: ${n(cerAnt.promedio, 2)}` : undefined,
    },
    {
      titulo: "Eficiencia terminal", valor: `${n(pct(sumar("egresados"), ingresoCerradas), 1)} %`,
      nota: `Egresados de las generaciones ${rangoCerradas} (${n(ingresoCerradas)} alumnos)`,
    },
    sumar("titulados") > 0
      ? {
          titulo: "Titulación", valor: `${n(pct(sumar("titulados"), ingresoCerradas), 1)} %`,
          nota: `Titulados de las generaciones ${rangoCerradas}`,
        }
      : {
          titulo: "Titulación", valor: "Sin registro",
          nota: `El sistema anterior no tiene titulados de las generaciones ${rangoCerradas}${
            ultimaConTitulados ? `; el último registro es de la generación ${ultimaConTitulados}` : ""}.`,
        },
  ];

  // Por ciclo escolar (ago–jul), como el 911: matrícula de inicio de cursos (ciclo -1) y nuevo ingreso
  // del año (-1 y -2; casi todo entra en agosto). Formato largo para la gráfica de líneas con series.
  const matricula = ciclos
    .filter((c) => Number(c.orden) % 10 === 1)
    .flatMap((c) => {
      const a = Math.floor(Number(c.orden) / 10);
      const escolar = `${a - 1}–${String(a).slice(2)}`;
      return [
        { ciclo_escolar: escolar, serie: "Matrícula (agosto)", alumnos: Number(c.alumnos) },
        { ciclo_escolar: escolar, serie: "Nuevo ingreso del año", alumnos: nuevo(a) },
      ];
    });
  const reprobacion = ciclos.filter((c) => Number(c.orden) <= cerrado);

  const situacion = generaciones.map((g) => ({
    x: `${g.generacion} · ${n(g.ingreso)}`,
    Titulados: Number(g.titulados),
    "Egresados sin título": Number(g.egresados_sin_titulo),
    "Siguen estudiando": Number(g.siguen),
    "Dejaron de inscribirse": Number(g.dejaron),
  }));
  const indicadores = generaciones.flatMap((g) => {
    const filasG = [
      { generacion: g.generacion, indicador: "Eficiencia terminal", porcentaje: pct(Number(g.egresados), Number(g.ingreso)) },
      { generacion: g.generacion, indicador: "Titulación", porcentaje: pct(Number(g.titulados), Number(g.ingreso)) },
    ];
    if (Number(g.base_retencion) === Number(g.ingreso)) {
      filasG.push({ generacion: g.generacion, indicador: "Siguió al 2.º año", porcentaje: pct(Number(g.retenidos), Number(g.ingreso)) });
    }
    return filasG.map((f) => ({ ...f, porcentaje: f.porcentaje === null ? null : Math.round(f.porcentaje * 10) / 10 }));
  });

  const nombreGrupo = (g: string) => (lic ? g : nombreLicenciatura(g));
  const ordenGrupos = (a: PorGrupo, b: PorGrupo) =>
    lic ? Number(a.grupo.replace(/\D/g, "")) - Number(b.grupo.replace(/\D/g, "")) : Number(b.alumnos) - Number(a.alumnos);
  const sexo = grupos
    .filter((g) => Number(g.orden) === ultimo)
    .sort(ordenGrupos)
    .map((g) => ({ x: nombreGrupo(g.grupo), Mujeres: Number(g.mujeres), Hombres: Number(g.hombres), "Sin dato": Number(g.sin_dato) }));
  const actual = grupos.filter((g) => Number(g.orden) === cerrado).sort(ordenGrupos);
  const reprobGrupo = actual.map((g) => {
    const antes = grupos.find((x) => x.grupo === g.grupo && Number(x.orden) === cerrado - 10);
    return {
      x: nombreGrupo(g.grupo),
      [etiquetaCiclo(clave(cerrado))]: Number(g.pct_reprobacion ?? 0),
      [etiquetaCiclo(clave(cerrado - 10))]: Number(antes?.pct_reprobacion ?? 0),
    };
  });
  const dimension = lic ? "semestre" : "licenciatura";
  const titLic = lic ? ` · ${nombreLicenciatura(lic)}` : "";

  return (
    <>
      {filtro}
      <p className="mb-4 text-sm text-muted">
        Datos hasta el ciclo <strong className="text-foreground">{etiquetaCiclo(clave(ultimo))}</strong>
        {cerrado !== ultimo && <> (todavía sin calificaciones; el último ciclo con calificaciones es {etiquetaCiclo(clave(cerrado))})</>}.
        Los ciclos 25-1 a 27-1 llegan con el respaldo más reciente.{titLic && <> Filtro: <strong className="text-foreground">{titLic.slice(3)}</strong>.</>}
      </p>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.titulo} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{k.titulo}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{k.valor}</p>
            {k.nota && <p className="mt-1 text-xs text-muted">{k.nota}</p>}
          </div>
        ))}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel titulo={`Matrícula y nuevo ingreso por ciclo escolar${titLic}`} enlace="/reportes/tendencia-ciclos" texto="Tendencia por ciclo"
          nota="Como en el 911: matrícula de inicio de cursos (alumnos con materias en el ciclo de agosto) y nuevo ingreso del año (agosto y enero).">
          <Grafica filas={matricula} config={{ tipo: "linea", x: "ciclo_escolar", y: "alumnos", series: "serie" }} alto={280} />
        </Panel>
        <Panel titulo={`Porcentaje de reprobación por ciclo${titLic}`} enlace="/reportes/estad-materias" texto="Estadística por materia"
          nota="Materias no acreditadas entre materias con calificación final. Hasta el último ciclo con calificaciones.">
          <Grafica filas={reprobacion} config={{ tipo: "linea", x: "ciclo", y: "pct_reprobacion" }} alto={280} />
        </Panel>
      </div>

      <Panel titulo={`¿Qué pasó con cada generación?${titLic}`} enlace="/reportes/eficiencia-terminal" texto="Eficiencia terminal por generación"
        nota="Cada barra es una generación (año en que empezó · alumnos que ingresaron), repartida según su situación actual. Pasa el cursor para ver números y porcentajes. Las generaciones recientes todavía están estudiando.">
        <Barras datos={situacion} modo="pct" series={[
          { clave: "Titulados", color: SERIES[0] },
          { clave: "Egresados sin título", color: SERIES[2] },
          { clave: "Siguen estudiando", color: SERIES[3] },
          { clave: "Dejaron de inscribirse", color: SERIES[1] },
        ]} />
      </Panel>

      <Panel titulo={`Eficiencia terminal, titulación y permanencia por generación${titLic}`} enlace="/reportes/eficiencia-terminal" texto="Eficiencia terminal por generación"
        nota={`Eficiencia terminal = egresados ÷ ingreso. Titulación = titulados ÷ ingreso. «Siguió al 2.º año» = alumnos que seguían inscritos un año después de entrar (deserción temprana).${
          ultimaConTitulados ? ` La titulación cae a cero después de la generación ${ultimaConTitulados} porque el sistema anterior dejó de registrarla, no porque nadie se titule.` : ""}`}>
        <Grafica filas={indicadores} config={{ tipo: "linea", x: "generacion", y: "porcentaje", series: "indicador" }} alto={300} />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel titulo={`Matrícula ${clave(ultimo)} por ${dimension} y sexo`} enlace={`/reportes/f911-matricula?ejecutar=1&p_ciclo=${clave(ultimo)}`} texto="Matrícula para el 911"
          nota={`Alumnos con materias en ${etiquetaCiclo(clave(ultimo))}. «Sin dato»: el sistema anterior no tiene el sexo capturado.`}>
          <Barras datos={sexo} modo="apiladas" series={[
            { clave: "Mujeres", color: SERIES[0] },
            { clave: "Hombres", color: SERIES[1] },
            { clave: "Sin dato", color: "#b4b9c2" },
          ]} />
        </Panel>
        <Panel titulo={`Reprobación por ${dimension}: ${clave(cerrado)} contra ${clave(cerrado - 10)}`}
          enlace={`/reportes/estad-materias?ejecutar=1&p_ciclo=${clave(cerrado)}`} texto="Materias con más reprobados"
          nota="Mismo periodo del año anterior, para comparar sin el efecto del semestre.">
          <Barras datos={reprobGrupo} sufijo=" %" series={[
            { clave: etiquetaCiclo(clave(cerrado)), color: SERIES[0] },
            { clave: etiquetaCiclo(clave(cerrado - 10)), color: "#9fb8d6" },
          ]} />
        </Panel>
      </div>

      <details className="mt-2 rounded-xl border border-border bg-card p-4 text-sm text-muted">
        <summary className="cursor-pointer font-medium text-foreground">Cómo se calculan los indicadores</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><strong>Generación:</strong> año en que el alumno empezó su primer ciclo (24-1 empieza en agosto de 2023 → generación 2023).</li>
          <li><strong>Egresado:</strong> titulado, o cursó el último semestre de su plan y ya no se inscribió después. El sistema anterior no registra el egreso; el sistema nuevo lo registrará con fecha.</li>
          <li><strong>Siguen estudiando:</strong> no han egresado y tienen materias en alguno de los dos últimos ciclos.</li>
          <li><strong>Dejaron de inscribirse:</strong> el resto (bajas, deserción o cambio de escuela).</li>
          <li><strong>Eficiencia terminal y titulación del encabezado:</strong> de las 5 generaciones más recientes que ya tuvieron tiempo de terminar ({rangoCerradas}).</li>
          <li>Solo ciclos ordinarios. El historial anterior a 2001 está marcado como por clasificar y no se incluye.</li>
        </ul>
      </details>
    </>
  );
}

type Kpi = { titulo: string; valor: string; nota?: string };

function delta(actual?: number, antes?: number): string {
  if (!actual || !antes) return "";
  const d = (100 * (Number(actual) - Number(antes))) / Number(antes);
  return `${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toLocaleString("es-MX", { maximumFractionDigits: 1 })} %`;
}

function puntos(actual?: number | null, antes?: number | null): string {
  if (actual === null || actual === undefined || antes === null || antes === undefined) return "";
  const d = Number(actual) - Number(antes);
  return `${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toLocaleString("es-MX", { maximumFractionDigits: 1 })} puntos`;
}

function Panel({ titulo, nota, enlace, texto, children }: {
  titulo: string; nota: string; enlace: string; texto: string; children: React.ReactNode;
}) {
  return (
    <section className="mt-6 break-inside-avoid rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{titulo}</h2>
        <Link href={enlace} className="text-sm text-brand hover:underline print:hidden">{texto} →</Link>
      </div>
      <p className="mb-3 mt-1 text-xs text-muted">{nota}</p>
      {children}
    </section>
  );
}
