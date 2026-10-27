"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { salir } from "@/app/login/actions";

const ENLACES = [
  { href: "/", texto: "Inicio" },
  { href: "/alumnos", texto: "Alumnos" },
  { href: "/reportes", texto: "Reportes" },
  { href: "/operaciones", texto: "Operaciones (prueba)" },
  { href: "/consola", texto: "Consola SQL" },
];

/** Menú con la sección activa resaltada (lee la ruta: va dentro de <Suspense>). */
export function Nav() {
  return <Enlaces ruta={usePathname()} />;
}

/** Menú sin sección activa: respaldo mientras se resuelve la ruta. */
export function Enlaces({ ruta = "" }: { ruta?: string }) {
  return (
    <nav className="flex flex-col gap-1">
      {ENLACES.map((e) => {
        const activo = e.href === "/" ? ruta === "/" : ruta.startsWith(e.href);
        return (
          <Link
            key={e.href}
            href={e.href}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              activo ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
            }`}
          >
            {e.texto}
          </Link>
        );
      })}
      <form action={salir} className="mt-4">
        <button className="w-full rounded-md px-3 py-2 text-left text-sm text-white/60 hover:bg-white/10 hover:text-white">
          Salir
        </button>
      </form>
    </nav>
  );
}
