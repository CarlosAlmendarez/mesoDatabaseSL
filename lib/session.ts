// Sesión de la demo: una sola contraseña (DEMO_PASSWORD). La cookie lleva la fecha de
// expiración firmada con HMAC (SESSION_SECRET). Usa Web Crypto: sirve en proxy.ts y en el servidor.

export const COOKIE = "unimes_demo";
export const DURACION_SEG = 8 * 60 * 60;

const codificador = new TextEncoder();

async function hmac(texto: string): Promise<string> {
  const secreto = process.env.SESSION_SECRET;
  if (!secreto) throw new Error("Falta la variable de entorno SESSION_SECRET");
  const llave = await crypto.subtle.importKey(
    "raw", codificador.encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const firma = await crypto.subtle.sign("HMAC", llave, codificador.encode(texto));
  return Array.from(new Uint8Array(firma), (b) => b.toString(16).padStart(2, "0")).join("");
}

function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function crearToken(): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + DURACION_SEG;
  return `${exp}.${await hmac(String(exp))}`;
}

export async function tokenValido(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [exp, firma] = token.split(".");
  if (!exp || !firma || Number(exp) < Date.now() / 1000) return false;
  return iguales(firma, await hmac(exp));
}

/** Compara la contraseña escrita con DEMO_PASSWORD sin filtrar su longitud por tiempo. */
export async function passwordCorrecta(intento: string): Promise<boolean> {
  const real = process.env.DEMO_PASSWORD;
  if (!real) throw new Error("Falta la variable de entorno DEMO_PASSWORD");
  return iguales(await hmac(`pw:${intento}`), await hmac(`pw:${real}`));
}
