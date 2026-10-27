"use client";
import { useActionState } from "react";
import { entrar } from "./actions";

export default function Login() {
  const [error, accion, enviando] = useActionState(entrar, null);
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form action={accion} className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div>
          <p className="text-xl font-semibold text-brand">UNIMES · Control Escolar</p>
          <p className="text-sm text-muted">Demo de la nueva base de datos, plantel San Luis Potosí</p>
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Contraseña</span>
          <input
            name="password"
            type="password"
            required
            autoFocus
            className="w-full rounded-md border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </label>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          disabled={enviando}
          className="w-full rounded-md bg-brand px-3 py-2 font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
