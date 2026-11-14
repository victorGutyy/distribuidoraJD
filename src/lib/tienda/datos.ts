import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/publico";
import type { CategoriaTienda } from "@/lib/tienda/categorias";
import { leerConfigTienda, type ConfigTienda } from "@/lib/tienda/config";

/**
 * Lecturas PÚBLICAS de la tienda, guardadas en caché unos minutos: el encabezado,
 * el menú de categorías y el pie se piden en cada página y casi nunca cambian.
 * (Los productos y precios NO pasan por aquí: se leen frescos en cada visita.)
 * La etiqueta "tienda" permite vaciar esta caché desde el panel cuando haga falta.
 */

export async function obtenerConfigTienda(): Promise<ConfigTienda> {
  "use cache";
  cacheLife("minutes");
  cacheTag("tienda");
  const { data } = await createPublicClient()
    .from("configuracion")
    .select("clave, valor");
  return leerConfigTienda(data ?? []);
}

/** Categorías visibles para el público (RLS: activas y con padre activo). */
export async function obtenerCategoriasTienda(): Promise<CategoriaTienda[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("tienda");
  const { data } = await createPublicClient()
    .from("categorias")
    .select("id, nombre, slug, parent_id, orden, icono_url")
    .order("orden")
    .order("nombre");
  return data ?? [];
}
