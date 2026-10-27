"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { salir } from "@/app/login/actions";

// Íconos de trazo simple (24×24).
const ICONOS: Record<string, React.ReactNode> = {
  inicio: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  alumnos: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
  tablero: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
  reportes: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  consola: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9l3 3-3 3M13 15h4" /></>,
  guia: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.5" /></>,
  salir: <><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l4-4-4-4M14 12H4" /></>,
};

function Icono({ nombre }: { nombre: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONOS[nombre]}
    </svg>
  );
}

const ENLACES = [
  { href: "/", texto: "Inicio", icono: "inicio", ayuda: "Resumen y gráficas" },
  { href: "/tablero", texto: "Tablero", icono: "tablero", ayuda: "Indicadores para rectoría" },
  { href: "/alumnos", texto: "Alumnos", icono: "alumnos", ayuda: "Buscar y ver kárdex" },
  { href: "/reportes", texto: "Reportes", icono: "reportes", ayuda: "Consultas listas" },
  { href: "/consola", texto: "Consola SQL", icono: "consola", ayuda: "Consultas propias" },
  { href: "/guia", texto: "Guía", icono: "guia", ayuda: "Cómo usar la demo" },
];

/** Menú con la sección activa resaltada (lee la ruta: va dentro de <Suspense>). */
export function Nav() {
  return <Enlaces ruta={usePathname()} />;
}

/** Menú sin sección activa: respaldo mientras se resuelve la ruta. */
export function Enlaces({ ruta = "" }: { ruta?: string }) {
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {ENLACES.map((e) => {
        const activo = e.href === "/" ? ruta === "/" : ruta.startsWith(e.href);
        return (
          <Link key={e.href} href={e.href}
            className={`flex shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm ${
              activo ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
            }`}>
            <Icono nombre={e.icono} />
            <span>
              <span className="block font-medium">{e.texto}</span>
              <span className="hidden text-[11px] text-white/55 md:block">{e.ayuda}</span>
            </span>
          </Link>
        );
      })}
      <form action={salir} className="md:mt-4">
        <button className="flex w-full shrink-0 items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-white/60 hover:bg-white/10 hover:text-white">
          <Icono nombre="salir" />
          Salir
        </button>
      </form>
    </nav>
  );
}
