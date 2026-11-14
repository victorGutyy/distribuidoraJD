"use server";

import { redirect } from "next/navigation";
import type { ZodType } from "zod";
import { requerirSeccion } from "@/lib/auth";
import { paraGuardar } from "@/lib/config-admin";
import { createClient } from "@/lib/supabase/server";
import { invalidarTienda } from "@/lib/tienda/invalidar";
import { erroresPorCampo, textoDe, type EstadoFormulario } from "@/lib/validaciones/comun";
import {
  comprasSchema,
  contactoSchema,
  empresaParaGuardar,
  empresaSchema,
  entregaSchema,
} from "@/lib/validaciones/config";
import type { Json } from "@/types/database.types";

/**
 * Guardado de la configuración (RF-30, solo admin). Cada tarjeta de la pantalla guarda
 * su propio grupo de claves en la tabla `configuracion`. RLS exige rol admin; aquí se
 * valida con Zod y se comprueba el rol antes de tocar nada.
 */

const RUTA = "/admin/config";

async function guardarGrupo<T>(
  formData: FormData,
  campos: string[],
  schema: ZodType<T>,
  aFilas: (datos: T) => Record<string, Json>,
): Promise<EstadoFormulario> {
  const perfil = await requerirSeccion("config");
  const valores = Object.fromEntries(campos.map((c) => [c, textoDe(formData, c)]));
  const parsed = schema.safeParse(valores);
  if (!parsed.success) return { errores: erroresPorCampo(parsed.error), valores };

  const filas = Object.entries(aFilas(parsed.data)).map(([clave, valor]) => ({
    clave,
    valor,
    updated_by: perfil.id,
  }));
  const supabase = await createClient();
  const { error } = await supabase.from("configuracion").upsert(filas, { onConflict: "clave" });
  if (error) {
    return {
      error:
        error.code === "42501"
          ? "No tienes permiso para cambiar la configuración."
          : "No pudimos guardar los cambios. Inténtalo de nuevo.",
      valores,
    };
  }
  invalidarTienda(); // la tienda muestra el cambio al instante
  redirect(`${RUTA}?ok=config-guardada`);
}

export async function guardarContacto(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return guardarGrupo(formData, ["whatsapp", "mensaje_whatsapp", "mensaje_barra"], contactoSchema, (d) => ({
    whatsapp_pedidos: paraGuardar(d.whatsapp),
    mensaje_whatsapp_flotante: d.mensaje_whatsapp,
    mensaje_barra_superior: paraGuardar(d.mensaje_barra),
  }));
}

export async function guardarCompras(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return guardarGrupo(formData, ["pedido_minimo", "regla_mayoreo", "umbral_mayor_monto"], comprasSchema, (d) => ({
    pedido_minimo: d.pedido_minimo,
    regla_mayoreo: d.regla_mayoreo,
    umbral_mayor_monto: d.umbral_mayor_monto,
  }));
}

export async function guardarEntrega(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return guardarGrupo(formData, ["hora_corte", "dias_no_habiles"], entregaSchema, (d) => ({
    hora_corte: d.hora_corte,
    dias_no_habiles: d.dias_no_habiles,
  }));
}

export async function guardarEmpresa(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return guardarGrupo(
    formData,
    ["nombre", "nit", "direccion", "horarios", "facebook", "instagram", "tiktok"],
    empresaSchema,
    (d) => ({ empresa: empresaParaGuardar(d) }),
  );
}
