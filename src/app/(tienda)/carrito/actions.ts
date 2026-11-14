"use server";

import { z } from "zod";
import type { DatosVigentes } from "@/lib/carrito";
import { leerVigentes } from "@/lib/tienda/vigentes";

const entrada = z.array(z.number().int().positive()).min(1).max(50);

/**
 * Datos VIGENTES de las presentaciones del carrito (RF-08): precios, oferta y
 * disponibilidad de hoy. Lo que aparece como null ya no está a la venta (RN-01).
 * Si no se pudo leer la base, devuelve {} y el carrito no cambia.
 */
export async function consultarVigentes(
  ids: number[],
): Promise<Record<number, DatosVigentes | null>> {
  const parsed = entrada.safeParse(ids);
  if (!parsed.success) return {};
  const vigentes = await leerVigentes(parsed.data);
  if (!vigentes) return {};
  return Object.fromEntries([...vigentes].map(([id, v]) => [id, v ? v.datos : null]));
}
