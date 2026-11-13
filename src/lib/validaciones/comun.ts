import { z } from "zod";

/**
 * Estado que devuelven las Server Actions de formularios y que lee
 * `useActionState` en el cliente.
 */
export type EstadoFormulario = {
  /** Error general del formulario (p. ej. "Correo o contraseña incorrectos"). */
  error?: string;
  /** Mensaje de éxito. */
  mensaje?: string;
  /** Errores por campo, en español. */
  errores?: Record<string, string[] | undefined>;
  /** Valores a devolver al formulario (nunca contraseñas). */
  valores?: Record<string, string>;
};

/** Convierte un error de Zod en { campo: ["mensaje", …] }. */
export function erroresPorCampo(
  error: z.ZodError,
): Record<string, string[] | undefined> {
  return z.flattenError(error).fieldErrors;
}

/** Lee un campo de FormData como texto (nunca null). */
export function textoDe(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor : "";
}
