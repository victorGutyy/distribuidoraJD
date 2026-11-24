import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/publico";
import { exigir } from "@/lib/tienda/errores";
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
  const { data, error } = await createPublicClient()
    .from("configuracion")
    .select("clave, valor");
  exigir(error, "la configuración de la tienda");
  return leerConfigTienda(data ?? []);
}

/** Categorías visibles para el público (RLS: activas y con padre activo). */
export async function obtenerCategoriasTienda(): Promise<CategoriaTienda[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("tienda");
  const { data, error } = await createPublicClient()
    .from("categorias")
    .select("id, nombre, slug, parent_id, orden, icono_url")
    .order("orden")
    .order("nombre");
  exigir(error, "las categorías");
  return data ?? [];
}

export type ZonaTienda = {
  id: number;
  nombre: string;
  sectores: { id: number; nombre: string; diasReparto: number[]; costoEnvio: number }[];
};

/**
 * Municipios activos que tienen al menos un sector activo (lo que el cliente puede
 * elegir al pedir). Lo que no sea público lo oculta RLS.
 */
export async function obtenerZonasTienda(): Promise<ZonaTienda[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("tienda");
  const supabase = createPublicClient();
  const [{ data: municipios, error: errorMunicipios }, { data: sectores, error: errorSectores }] = await Promise.all([
    supabase.from("municipios").select("id, nombre").eq("activo", true).order("nombre"),
    supabase
      .from("sectores")
      .select("id, municipio_id, nombre, dias_reparto, costo_envio")
      .eq("activo", true)
      .order("nombre"),
  ]);
  exigir(errorMunicipios, "los municipios");
  exigir(errorSectores, "los sectores de entrega");
  return (municipios ?? [])
    .map((m) => ({
      id: m.id,
      nombre: m.nombre,
      sectores: (sectores ?? [])
        .filter((s) => s.municipio_id === m.id)
        .map((s) => ({ id: s.id, nombre: s.nombre, diasReparto: s.dias_reparto, costoEnvio: s.costo_envio })),
    }))
    .filter((m) => m.sectores.length > 0);
}
