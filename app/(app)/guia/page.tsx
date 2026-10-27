import Link from "next/link";
import { Titulo } from "@/components/ui";

const MENUS = [
  { href: "/", titulo: "Inicio", texto: "Cifras generales, alumnos por ciclo y por carrera. Clic en una carrera para ver a sus alumnos activos." },
  { href: "/tablero", titulo: "Tablero", texto: "Indicadores para rectoría: matrícula, nuevo ingreso, reprobación, eficiencia terminal y deserción por generación. Filtra por licenciatura e imprime o guarda en PDF." },
  { href: "/alumnos", titulo: "Alumnos", texto: "Busca por nombre, apellido o matrícula, o filtra por carrera. La matrícula abre la ficha con promedios y kárdex." },
  { href: "/reportes", titulo: "Reportes", texto: "Consultas listas por tema, incluidos el formato 911 y las relaciones para la SEP (inscripción, bajas, egresados, titulados). Cada una explica cómo usarla." },
  { href: "/modelo", titulo: "Modelo de datos", texto: "El mapa de la base: cada caja es una tabla y cada línea una relación. Arrastra para moverte, usa la rueda o +/− para acercar y toca una tabla para ver qué guarda, por qué existe, de dónde salieron sus datos y sus registros. Abajo está la lista de archivos del sistema anterior y a qué tablas fueron a dar." },
  { href: "/consola", titulo: "Consola SQL", texto: "Para quien sabe SQL: escribe una consulta o carga un ejemplo. Solo lectura." },
];

const PASOS = [
  { titulo: "Tabla", texto: "Clic en el encabezado de una columna para ordenar (otra vez para invertir). El cuadro «Filtrar en estos resultados» busca en todas las columnas." },
  { titulo: "Gráfica", texto: "Cambia a «Gráfica» y elige la categoría (eje horizontal), el valor y, si quieres, una columna para separar en series. Pasa el cursor sobre las barras o la línea para ver cada valor." },
  { titulo: "Agrupar y resumir", texto: "Elige una o dos columnas para agrupar y agrega cálculos: suma, promedio, mínimo, máximo, valores distintos o % de «Sí». Se calcula en la base con todos los registros, no solo los que se ven." },
  { titulo: "Exportar", texto: "«Exportar a Excel» descarga un .xlsx con dos hojas: «Datos» (con filtros y encabezados) e «Información» (reporte, filtros usados, fecha y consulta). Si agrupaste, se exporta la agrupación. Hasta 50,000 filas." },
];

const GLOSARIO: [string, string][] = [
  ["Matrícula", "Número de cuenta del alumno. Formato AA P CC NNN: año de ingreso, periodo, clave de carrera y consecutivo."],
  ["Ciclo", "Semestre escolar. El -1 va de agosto a diciembre del año anterior y el -2 de enero a julio. Ejemplo: 24-1 = ago–dic 2023; 24-2 = ene–jul 2024."],
  ["Clave de carrera", "Identifica el plan de estudios. Una misma licenciatura puede tener dos claves (plan anterior y plan nuevo), por ejemplo 05 y 55 en Derecho."],
  ["RVOE", "Reconocimiento de Validez Oficial de Estudios: acuerdo de la SEP o autoridad estatal que reconoce el plan. Varias claves pueden compartirlo."],
  ["Calificación final", "Entero. Si es 6 o más, sube desde .5 (6.5 → 7); si es menor de 6, baja al entero anterior (5.9 → 5)."],
  ["Forma de aprobación", "Símbolo del sistema anterior: «-» cursada, «/» equivalencia, «Y» regularización, «.» en curso."],
  ["Por clasificar", "Historial anterior a 2001 y exámenes 98-2 a 04-1: pueden ser del plantel de Oaxaca (el sistema se copió de allá). Se conservan marcados."],
  ["Generación", "Año en que el alumno empezó su primer ciclo. 24-1 empieza en agosto de 2023, así que quien entró en 24-1 es de la generación 2023."],
  ["Eficiencia terminal", "Egresados de una generación entre los que ingresaron en ella. Egresado: titulado, o cursó el último semestre del plan y ya no se inscribió (el sistema anterior no registra el egreso)."],
  ["Formato 911", "Cuestionario estadístico de la SEP al inicio y fin de cursos: matrícula, primer ingreso, edad, egresados y docentes, todo por sexo. Está en Reportes → SEP · Formato 911."],
  ["PK y FK", "PK (llave primaria) es la columna que identifica a cada registro de una tabla. FK (llave foránea) es una columna que guarda la PK de otra tabla: así se relacionan, por ejemplo cada calificación apunta al alumno y a la materia. Se ven en Modelo de datos."],
  ["Procedimiento almacenado", "Consulta guardada dentro de la base. Cualquier sistema la llama con un solo comando, por ejemplo SELECT * FROM sp_historial_academico('21102010')."],
];

export default function Guia() {
  return (
    <div className="max-w-5xl space-y-10">
      <Titulo
        titulo="Guía rápida"
        subtitulo="Esta demo muestra la nueva base de datos de Control Escolar con los datos migrados del sistema anterior. Todo es de consulta: nada de lo que hagas aquí cambia la información."
      />

      <section>
        <h2 className="mb-3 text-lg font-semibold">Qué hay en cada menú</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {MENUS.map((m) => (
            <Link key={m.href} href={m.href} className="rounded-xl border border-border bg-card p-4 hover:border-brand">
              <p className="font-semibold text-brand">{m.titulo} →</p>
              <p className="mt-1 text-sm text-muted">{m.texto}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Cómo trabajar con cualquier resultado</h2>
        <p className="mb-3 text-sm text-muted">Reportes, búsquedas, kárdex y consola muestran sus resultados con la misma barra de herramientas:</p>
        <ol className="grid gap-3 md:grid-cols-2">
          {PASOS.map((p, i) => (
            <li key={p.titulo} className="rounded-xl border border-border bg-card p-4">
              <p className="font-semibold"><span className="mr-2 text-brand">{i + 1}.</span>{p.titulo}</p>
              <p className="mt-1 text-sm text-muted">{p.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-xl border border-brand/30 bg-brand-soft/60 p-5">
        <h2 className="text-lg font-semibold">Ejemplo: ¿en qué materias se reprueba más?</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          <li>Abre <Link href="/reportes/estad-materias" className="text-brand underline">Reportes → Estadística por materia</Link>.</li>
          <li>Elige el ciclo (escribe «24» en el menú para encontrarlo rápido) y, si quieres, una carrera. Pulsa Consultar.</li>
          <li>Cambia a «Gráfica»: verás las materias con más reprobados.</li>
          <li>Pulsa «Agrupar y resumir», elige «Carrera» y agrega «Suma de reprobados» para el total por carrera.</li>
          <li>Pulsa «Exportar a Excel» para llevártelo.</li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Glosario</h2>
        <dl className="divide-y divide-border rounded-xl border border-border bg-card">
          {GLOSARIO.map(([t, d]) => (
            <div key={t} className="grid gap-1 px-4 py-3 text-sm md:grid-cols-[14rem_1fr]">
              <dt className="font-semibold">{t}</dt>
              <dd className="text-muted">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="text-sm text-muted">
        <h2 className="mb-2 text-lg font-semibold text-foreground">Lo que viene</h2>
        <p>
          La captura de calificaciones, bajas y reingresos (con las reglas del reglamento y la bitácora de cambios) ya existe en la
          base y se habilitará en una siguiente etapa. Los datos llegan hasta el ciclo 24-2; los ciclos 25-1 a 27-1 se cargarán
          con el respaldo más reciente.
        </p>
      </section>
    </div>
  );
}
