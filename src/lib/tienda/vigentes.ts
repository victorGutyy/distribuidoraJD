import "server-only";
import type { DatosVigentes } from "@/lib/carrito";
import { createPublicClient } from "@/lib/supabase/publico";
import { etiquetaPresentacion, type VarianteDetalle } from "@/lib/tienda/producto";

/**
 * Datos VIGENTES de presentaciones, leídos de la base en este momento (sin caché):
 * precios, oferta, disponibilidad, nombre y SKU. Los usan la revalidación del
 * carrito (RF-08) y la creación del pedido (RN-06), que parte de lo que dice la
 * base y nunca de lo que mande el navegador.
 *
 * Se lee con la clave pública: RLS solo deja ver lo que se vende hoy (RN-01), así
 * que una presentación que no aparezca ya no está a la venta.
 */

const COLUMNAS =
  "id, producto_id, sku, nombre_presentacion, contenido_valor, contenido_unidad, unidad_venta, " +
  "unidades_por_empaque, peso_g, alto_cm, ancho_cm, largo_cm, precio_unidad, precio_mayor, " +
  "cantidad_min_mayor, en_oferta, precio_oferta, disponible";

type FilaVariante = VarianteDetalle & { producto_id: number };

export type Vigente = { datos: DatosVigentes; sku: string };

/** null = no se pudo leer (error de conexión): quien llama no debe decidir nada con eso. */
export async function leerVigentes(ids: readonly number[]): Promise<Map<number, Vigente | null> | null> {
  const pedidas = [...new Set(ids)];
  if (pedidas.length === 0) return new Map();
  const supabase = createPublicClient();

  const { data: variantes, error } = await supabase.from("variantes").select(COLUMNAS).in("id", pedidas);
  if (error) return null;
  const filas = (variantes ?? []) as unknown as FilaVariante[];

  const productoIds = [...new Set(filas.map((v) => v.producto_id))];
  const [productos, imagenes] =
    productoIds.length === 0
      ? [{ data: [] }, { data: [] }]
      : await Promise.all([
          supabase.from("productos").select("id, nombre, slug").in("id", productoIds),
          supabase
            .from("producto_imagenes")
            .select("producto_id, url, url_miniatura")
            .in("producto_id", productoIds)
            .order("es_principal", { ascending: false })
            .order("orden")
            .order("id"),
        ]);
  if ("error" in productos && productos.error) return null;

  const porProducto = new Map((productos.data ?? []).map((p) => [p.id, p]));
  const imagenDe = new Map<number, string>();
  for (const i of imagenes.data ?? []) {
    if (!imagenDe.has(i.producto_id)) imagenDe.set(i.producto_id, i.url_miniatura ?? i.url);
  }

  const resultado = new Map<number, Vigente | null>(pedidas.map((id) => [id, null]));
  for (const v of filas) {
    const p = porProducto.get(v.producto_id);
    if (!p || v.precio_unidad === null || v.precio_unidad <= 0) continue;
    resultado.set(v.id, {
      sku: v.sku,
      datos: {
        varianteId: v.id,
        productoSlug: p.slug,
        nombre: p.nombre,
        presentacion: etiquetaPresentacion(v),
        imagen: imagenDe.get(v.producto_id) ?? null,
        precio: {
          precioUnidad: v.precio_unidad,
          precioMayor: v.precio_mayor,
          cantidadMinMayor: v.cantidad_min_mayor,
          enOferta: v.en_oferta,
          precioOferta: v.precio_oferta,
        },
        disponible: v.disponible,
      },
    });
  }
  return resultado;
}
