import { z } from "zod";
import { ROLES } from "@/lib/permisos";

/**
 * Validación del formulario de usuarios del panel (RF-31, solo admin). Con pruebas.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const idUsuarioSchema = z.string().trim().regex(UUID, "Usuario no válido");

const nombre = z.string().trim().min(2, "Escribe el nombre").max(80, "Máximo 80 caracteres");
const rol = z.enum(ROLES as unknown as [string, ...string[]], { error: "Elige un rol" });

/** Los sectores llegan como texto desde las casillas; se dejan enteros únicos y positivos. */
const sectores = z
  .array(z.string())
  .transform((v) => [...new Set(v.map(Number))].filter((n) => Number.isInteger(n) && n > 0).sort((a, b) => a - b));

export const invitarSchema = z.object({
  correo: z.string().trim().toLowerCase().pipe(z.email("Escribe un correo válido").max(120, "Máximo 120 caracteres")),
  nombre,
  rol,
  sectores,
});

export const editarUsuarioSchema = z.object({
  id: idUsuarioSchema,
  nombre,
  rol,
  activo: z.boolean(),
  sectores,
});
