import "server-only";
import { headers } from "next/headers";

/** URL base de la aplicación (para armar enlaces que se envían a otras personas). */
export async function obtenerOrigen(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
