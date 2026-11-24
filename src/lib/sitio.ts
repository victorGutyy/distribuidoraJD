/**
 * Dirección pública del sitio (para robots, sitemap, canonical y vistas previas al compartir).
 * Lógica PURA, con pruebas. Orden: NEXT_PUBLIC_SITE_URL (el dominio definitivo) → dominio de
 * producción que Vercel entrega solo → localhost (desarrollo).
 */
export function resolverUrlSitio(env: Record<string, string | undefined>): string {
  const candidatos = [env.NEXT_PUBLIC_SITE_URL, env.VERCEL_PROJECT_PRODUCTION_URL];
  for (const c of candidatos) {
    const limpio = c?.trim();
    if (!limpio) continue;
    const conProtocolo = /^https?:\/\//i.test(limpio) ? limpio : `https://${limpio}`;
    try {
      return new URL(conProtocolo).origin;
    } catch {
      /* valor inválido: se prueba el siguiente */
    }
  }
  return "http://localhost:3000";
}

export const urlSitio = () => resolverUrlSitio(process.env);
