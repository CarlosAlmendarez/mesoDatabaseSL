import "server-only";
import { cookies } from "next/headers";
import { COOKIE, tokenValido } from "./session";

/** Verificación en cada acción del servidor: proxy.ts solo hace la revisión optimista. */
export async function exigirSesion(): Promise<void> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!(await tokenValido(token))) throw new Error("La sesión expiró. Vuelve a entrar.");
}
