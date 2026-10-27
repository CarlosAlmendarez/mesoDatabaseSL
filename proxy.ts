import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE, tokenValido } from "@/lib/session";

// Sin sesión válida, todo redirige a /login.
export async function proxy(request: NextRequest) {
  if (await tokenValido(request.cookies.get(COOKIE)?.value)) return NextResponse.next();
  const destino = new URL("/login", request.url);
  return NextResponse.redirect(destino);
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
