/**
 * Cabeceras de seguridad HTTP. Lógica PURA, con pruebas (se usa desde next.config.ts).
 *
 * - CSP: la página solo carga scripts, estilos, imágenes y conexiones de sitios conocidos.
 *   Next.js inserta pequeños scripts en línea, por eso `script-src` lleva 'unsafe-inline'
 *   (una CSP con nonce obligaría a renderizar todo dinámico y perder la caché).
 * - frame-ancestors 'none' + X-Frame-Options: nadie puede incrustar el sitio (clickjacking).
 * - HSTS: el navegador solo usa HTTPS (solo en producción).
 */

export type Cabecera = { key: string; value: string };

export function construirCSP({ supabaseUrl, produccion }: { supabaseUrl?: string | null; produccion: boolean }): string {
  let origenSupabase = "";
  let wsSupabase = "";
  if (supabaseUrl) {
    try {
      const u = new URL(supabaseUrl);
      origenSupabase = u.origin;
      wsSupabase = `wss://${u.host}`;
    } catch {
      /* URL inválida: se ignora, queda solo 'self' */
    }
  }
  const directivas = [
    "default-src 'self'",
    // En desarrollo Next necesita eval para el recargado en caliente.
    `script-src 'self' 'unsafe-inline'${produccion ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${origenSupabase ? ` ${origenSupabase}` : ""}`,
    "font-src 'self' data:",
    `connect-src 'self'${origenSupabase ? ` ${origenSupabase} ${wsSupabase}` : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];
  if (produccion) directivas.push("upgrade-insecure-requests");
  return directivas.join("; ");
}

export function cabecerasDeSeguridad(opts: { supabaseUrl?: string | null; produccion: boolean }): Cabecera[] {
  const cabeceras: Cabecera[] = [
    { key: "Content-Security-Policy", value: construirCSP(opts) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  ];
  if (opts.produccion) {
    cabeceras.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  }
  return cabeceras;
}
