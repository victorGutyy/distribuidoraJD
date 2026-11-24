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

const reprogramarSchema = z.object({
  id: z.number().int().positive(),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha válida")
    .nullable(),
  direccion: z.string().trim().max(150, "La dirección admite máximo 150 caracteres").nullable(),
  notas: z.string().trim().max(300, "Las notas admiten máximo 300 caracteres").nullable(),
  motivo: z.string().trim().min(3, "Escribe el motivo del cambio").max(300, "Máximo 300 caracteres"),
});
export type ReprogramarEntrada = z.input<typeof reprogramarSchema>;

/** Mueve la fecha de entrega o corrige dirección y notas de un pedido que aún no salió (P-01). */
export async function reprogramarPedido(entrada: ReprogramarEntrada): Promise<ResultadoPedidoAdmin> {
  await requerirSeccion("pedidos");
  const parsed = reprogramarSchema.safeParse(entrada);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const { id, fecha, direccion, notas, motivo } = parsed.data;

  const supabase = await createClient();
  // La función SQL acepta NULL («no tocar»), pero los tipos generados marcan estos parámetros como
  // texto obligatorio: se pasa null con un cast puntual.
  const sinCambio = null as unknown as string;
  const { error } = await supabase.rpc("reprogramar_pedido", {
    p_pedido_id: id,
    p_fecha: fecha ?? sinCambio,
    p_direccion: direccion ?? sinCambio,
    p_notas: notas ?? sinCambio,
    p_motivo: motivo,
  });
  if (error) return { ok: false, error: mensajeDeError(error) };
  return { ok: true, mensaje: "Pedido actualizado." };
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

/**
 * Cantidad de pedidos en estado «nuevo» (sin atender) que ve esta persona. El menú la consulta
 * cada cierto tiempo para mostrar la insignia y avisar cuando llega uno. RLS limita lo que cuenta
 * (un vendedor solo cuenta los de sus zonas). Devuelve null si no se pudo leer.
 */
export async function contarPedidosNuevos(): Promise<number | null> {
  await requerirSeccion("pedidos");
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("estado", "nuevo");
  if (error) return null;
  return count ?? 0;
}
