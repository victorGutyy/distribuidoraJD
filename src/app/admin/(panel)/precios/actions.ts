"use server";

import { requerirRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  edicionPrecioSchema,
  type EdicionPrecioEntrada,
} from "@/lib/validaciones/precios";
import type { Json } from "@/types/database.types";
import { invalidarTienda } from "@/lib/tienda/invalidar";

/** Solo admin y editor cambian precios (la función SQL lo vuelve a comprobar). */
const ROLES_ESCRITURA = ["admin", "editor"] as const;

/** Tope por guardado: la cuadrícula muestra 50 filas por página. */
const MAX_FILAS = 100;

export type ResultadoPrecios = {
  /** Error general (no atribuible a una fila). */
  error?: string;
  /** Filas que quedaron guardadas (incluye las que ya estaban iguales). */
  guardadas: number[];
  errores: { id: number; mensaje: string }[];
};

/** Traduce los errores técnicos de la base a algo que una persona entienda. */
function mensajeDeFila(mensaje: string): string {
  if (mensaje.includes("check constraint")) {
    return "Revisa los precios: el de mayor no puede superar al de unidad y una oferta necesita su precio.";
  }
  if (mensaje.includes("No existe")) {
    return "Esta presentación ya no existe. Recarga la página.";
  }
  return "No se pudo guardar esta fila.";
}

/**
 * Guarda los precios de las filas editadas. Se valida DE NUEVO en el servidor y se
 * guarda con la función SQL guardar_precios: si una fila falla, las demás sí se
 * guardan y se informa cuál falló y por qué.
 */
export async function guardarPreciosRapido(
  entrada: EdicionPrecioEntrada[],
): Promise<ResultadoPrecios> {
  await requerirRol(ROLES_ESCRITURA);
  if (!Array.isArray(entrada) || entrada.length === 0 || entrada.length > MAX_FILAS) {
    return { error: "No hay cambios para guardar.", guardadas: [], errores: [] };
  }

  const errores: ResultadoPrecios["errores"] = [];
  const payload: Record<string, unknown>[] = [];
  for (const fila of entrada) {
    const r = edicionPrecioSchema.safeParse(fila);
    if (r.success) {
      payload.push(r.data); // todas las claves viajan: un null BORRA el dato
    } else {
      const id = Number((fila as { id?: unknown })?.id);
      errores.push({
        id: Number.isInteger(id) ? id : 0,
        mensaje: r.error.issues[0]?.message ?? "Datos no válidos.",
      });
    }
  }
  if (payload.length === 0) return { guardadas: [], errores };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("guardar_precios", {
    p_filas: payload as Json,
  });
  if (error) {
    return {
      error:
        error.code === "42501"
          ? "No tienes permiso para cambiar precios."
          : "No pudimos guardar. Inténtalo de nuevo.",
      guardadas: [],
      errores,
    };
  }

  invalidarTienda();
  const resultado = (data ?? {}) as { errores?: { ref: string; mensaje: string }[] };
  const fallidas = (resultado.errores ?? []).map((e) => ({
    id: Number(e.ref),
    mensaje: mensajeDeFila(e.mensaje),
  }));
  const idsFallidos = new Set([...errores, ...fallidas].map((e) => e.id));
  return {
    guardadas: payload
      .map((p) => p.id as number)
      .filter((id) => !idsFallidos.has(id)),
    errores: [...errores, ...fallidas],
  };
}
