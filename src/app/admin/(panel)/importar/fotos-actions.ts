"use server";

import { z } from "zod";
import { requerirRol } from "@/lib/auth";
import { skuDeProducto, type ProductoPorSku } from "@/lib/catalogo/fotos-lote";
import { createClient } from "@/lib/supabase/server";

/**
 * Apoyo de la subida de fotos en lote (solo admin y editor): dado un conjunto de SKU
 * de productos, dice a qué producto corresponde cada uno y cuántas fotos tiene ya. La
 * subida en sí la hace el navegador con la sesión de quien sube, y cada producto se
 * registra con registrarImagenes (productos/imagenes-actions.ts), que revisa los archivos.
 */

const ROLES_ESCRITURA = ["admin", "editor"] as const;
const POR_PAGINA = 1000; // PostgREST devuelve como máximo 1000 filas por consulta

const entrada = z.array(z.string().regex(/^[A-Za-z0-9][A-Za-z0-9.-]{0,39}$/)).min(1).max(5000);

export type ResultadoConsultaSku = { error?: string; productos?: Record<string, ProductoPorSku> };

export async function consultarProductosPorSku(skus: string[]): Promise<ResultadoConsultaSku> {
  await requerirRol(ROLES_ESCRITURA);
  const parsed = entrada.safeParse(skus);
  if (!parsed.success) return { error: "No se pudo leer la lista de SKU." };
  const pedidos = new Set(parsed.data.map((s) => s.toUpperCase()));
  const supabase = await createClient();

  // Presentaciones (sku → producto), por páginas.
  const productoDeSku = new Map<string, { id: number; nombre: string }>();
  for (let desde = 0; ; desde += POR_PAGINA) {
    const { data, error } = await supabase
      .from("variantes")
      .select("sku, producto_id, productos(nombre)")
      .order("id")
      .range(desde, desde + POR_PAGINA - 1);
    if (error) return { error: "No pudimos consultar el catálogo. Inténtalo de nuevo." };
    for (const v of data ?? []) {
      const sku = skuDeProducto(v.sku).toUpperCase();
      if (pedidos.has(sku) && !productoDeSku.has(sku)) {
        const nombre = (v.productos as unknown as { nombre: string } | null)?.nombre ?? "";
        productoDeSku.set(sku, { id: v.producto_id, nombre });
      }
    }
    if ((data?.length ?? 0) < POR_PAGINA) break;
  }

  // Fotos que cada producto ya tiene.
  const fotos = new Map<number, number>();
  for (let desde = 0; ; desde += POR_PAGINA) {
    const { data, error } = await supabase
      .from("producto_imagenes")
      .select("producto_id")
      .order("id")
      .range(desde, desde + POR_PAGINA - 1);
    if (error) return { error: "No pudimos consultar las fotos actuales." };
    for (const f of data ?? []) fotos.set(f.producto_id, (fotos.get(f.producto_id) ?? 0) + 1);
    if ((data?.length ?? 0) < POR_PAGINA) break;
  }

  const productos: Record<string, ProductoPorSku> = {};
  for (const [sku, p] of productoDeSku) {
    productos[sku] = { productoId: p.id, nombre: p.nombre, imagenes: fotos.get(p.id) ?? 0 };
  }
  return { productos };
}
