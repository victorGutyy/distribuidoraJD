import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/publico";
import { exigir } from "@/lib/tienda/errores";
import { urlSitio } from "@/lib/sitio";

const PAGINA = 1000;

async function leerSlugs() {
  "use cache";
  cacheLife("hours");
  cacheTag("catalogo");
  const supabase = createPublicClient();
  const categorias = await supabase.from("categorias").select("slug");
  exigir(categorias.error, "las categorías del mapa del sitio");

  // Supabase entrega máximo 1.000 filas por consulta: se lee por páginas hasta agotar.
  const slugs: string[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase
      .from("v_tienda_productos")
      .select("slug")
      .order("id")
      .range(desde, desde + PAGINA - 1);
    exigir(error, "los productos del mapa del sitio");
    for (const fila of data ?? []) if (fila.slug) slugs.push(fila.slug);
    if (!data || data.length < PAGINA) break;
  }
  return { productos: slugs, categorias: (categorias.data ?? []).map((c) => c.slug) };
}

/** Mapa del sitio: inicio, catálogo, categorías y cada producto visible. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = urlSitio();
  const { productos, categorias } = await leerSlugs();
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/catalogo`, changeFrequency: "daily", priority: 0.9 },
    ...["preguntas-frecuentes", "contactanos", "terminos", "politica-de-datos"].map((ruta) => ({
      url: `${base}/${ruta}`,
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
    ...categorias.map((slug) => ({
      url: `${base}/catalogo?cat=${encodeURIComponent(slug)}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...productos.map((slug) => ({
      url: `${base}/producto/${encodeURIComponent(slug)}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
