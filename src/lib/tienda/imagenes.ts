/**
 * Seguridad de enlaces e imágenes que vienen de la base (banners, íconos). Lógica
 * PURA, con pruebas.
 */

/**
 * Enlace de un banner: solo rutas internas ("/catalogo?ofertas=1") o https. Todo
 * lo demás (javascript:, "//otro-sitio", http:) se descarta para que nadie pueda
 * colar un enlace malicioso desde el panel o la base.
 */
export function enlaceSeguro(valor: string | null | undefined): string | null {
  const v = valor?.trim();
  if (!v) return null;
  if (v.startsWith("/") && !v.startsWith("//") && !v.includes("\\")) return v;
  try {
    const url = new URL(v);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** ¿El enlace sale de este sitio? (para abrirlo en otra pestaña con rel seguro). */
export function esEnlaceExterno(enlace: string): boolean {
  return !enlace.startsWith("/");
}

/**
 * next/image solo acepta imágenes de los servidores autorizados en next.config.ts:
 * el bucket público "catalogo" de nuestro Supabase. Una URL de otro lugar rompería
 * la página, así que se descarta.
 */
export function imagenPermitida(
  url: string | null | undefined,
  supabaseUrl: string | undefined,
): string | null {
  if (!url || !supabaseUrl) return null;
  try {
    const u = new URL(url);
    const permitido = new URL(supabaseUrl);
    return u.protocol === "https:" &&
      u.hostname === permitido.hostname &&
      u.pathname.startsWith("/storage/v1/object/public/catalogo/")
      ? url
      : null;
  } catch {
    return null;
  }
}
