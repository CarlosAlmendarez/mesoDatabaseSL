"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, DURACION_SEG, crearToken, passwordCorrecta } from "@/lib/session";

export async function entrar(_prev: string | null, form: FormData): Promise<string | null> {
  const intento = String(form.get("password") ?? "");
  if (!(await passwordCorrecta(intento))) return "Contraseña incorrecta.";
  (await cookies()).set(COOKIE, await crearToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_SEG,
  });
  redirect("/");
}

export async function salir() {
  (await cookies()).delete(COOKIE);
  redirect("/login");
}
