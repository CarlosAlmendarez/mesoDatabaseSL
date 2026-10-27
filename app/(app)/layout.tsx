import { Suspense } from "react";
import { Enlaces, Nav } from "@/components/Nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="bg-brand px-4 py-5 md:w-60 md:shrink-0 print:hidden">
        <div className="mb-6 px-3">
          <p className="text-lg font-semibold text-white">UNIMES</p>
          <p className="text-xs text-white/70">Control Escolar · San Luis Potosí</p>
        </div>
        <Suspense fallback={<Enlaces />}>
          <Nav />
        </Suspense>
        <p className="mt-8 hidden px-3 text-xs leading-relaxed text-white/50 md:block">
          Demo de la nueva base de datos: solo consulta y exportación. Nada de lo que hagas aquí modifica los datos.
        </p>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
