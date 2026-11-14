"use server";

import { z } from "zod";
import { requerirSeccion } from "@/lib/auth";
import { ESTADOS_PEDIDO } from "@/lib/pedidos";
import { createClient } from "@/lib/supabase/server";

/**
 * Cambios sobre un pedido (RF-27). Las reglas de verdad (el flujo de estados, quién
 * puede y el motivo al cancelar) las aplican las funciones SQL cambiar_estado_pedido y
 * editar_items_pedido, que revisan el rol y la zona del usuario. Aquí solo se valida la
 * forma de lo recibido y se traducen los errores a mensajes claros.
 */

export type ResultadoPedidoAdmin = { ok: true; mensaje: string } | { ok: false; error: string };

type ErrorRpc = { code?: string; message: string };

/** Los errores de la función SQL ya vienen en español; el resto se resume. */
function mensajeDeError(error: ErrorRpc): string {
  if (error.code === "42501") return error.message || "No tienes permiso para hacer esto.";
  if (error.code === "P0001" || error.code === "P0002") return error.message;
  return "No pudimos guardar el cambio. Inténtalo de nuevo.";
}

const cambioEstadoSchema = z.object({
  id: z.number().int().positive(),
  estado: z.enum(ESTADOS_PEDIDO),
  nota: z.string().trim().max(300, "Máximo 300 caracteres").optional(),
});
export type CambioEstadoEntrada = z.input<typeof cambioEstadoSchema>;

export async function cambiarEstadoPedido(entrada: CambioEstadoEntrada): Promise<ResultadoPedidoAdmin> {
  await requerirSeccion("pedidos");
  const parsed = cambioEstadoSchema.safeParse(entrada);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const { id, estado, nota } = parsed.data;
  if (estado === "cancelado" && !nota) return { ok: false, error: "Escribe el motivo para cancelar el pedido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_estado_pedido", {
    p_pedido_id: id,
    p_estado: estado,
    p_nota: nota ?? "",
  });
  if (error) return { ok: false, error: mensajeDeError(error) };
  return { ok: true, mensaje: "Estado actualizado." };
}

const edicionSchema = z.object({
  id: z.number().int().positive(),
  items: z
    .array(
      z.object({
        id: z.number().int().positive(),
        cantidad: z.number().int().min(0, "La cantidad no puede ser negativa").max(9999, "Máximo 9999 unidades"),
      }),
    )
    .min(1, "No hay cambios para guardar")
    .max(60),
  nota: z.string().trim().min(1, "Escribe el motivo del cambio").max(300, "Máximo 300 caracteres"),
});
export type EdicionItemsEntrada = z.input<typeof edicionSchema>;

export async function editarItemsPedido(entrada: EdicionItemsEntrada): Promise<ResultadoPedidoAdmin> {
  await requerirSeccion("pedidos");
  const parsed = edicionSchema.safeParse(entrada);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("editar_items_pedido", {
    p_pedido_id: parsed.data.id,
    p_items: parsed.data.items,
    p_nota: parsed.data.nota,
  });
  if (error) return { ok: false, error: mensajeDeError(error) };
  return { ok: true, mensaje: "Pedido actualizado." };
}
