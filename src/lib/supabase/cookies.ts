import type { CookieOptions } from "@supabase/ssr";

/**
 * Endurece las cookies de sesión: `Secure` en producción (solo viajan por HTTPS) y `SameSite=Lax`
 * (no se envían en peticiones de otros sitios, frena el CSRF). Lógica pura, con pruebas.
 */
export function endurecerCookie(options: CookieOptions | undefined, produccion: boolean): CookieOptions {
  return {
    ...options,
    path: options?.path ?? "/",
    sameSite: "lax",
    ...(produccion ? { secure: true } : {}),
  };
}

export const esProduccion = () => process.env.NODE_ENV === "production";
