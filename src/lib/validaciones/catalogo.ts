import { z } from "zod";

/**
 * Esquemas de validación del catálogo (categorías, marcas y, en F2b, productos).
 * Reflejan las reglas de la base de datos para dar mensajes claros ANTES de que
 * Postgres rechace la operación.
 */

const nombre = z
  .string()
  .trim()
  .min(1, "Escribe el nombre")
  .max(80, "Máximo 80 caracteres");

/** Un id que puede venir vacío desde un <select> ("" = sin valor). */
const idOpcional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v)))
  .pipe(
    z.number().int("Valor no válido").positive("Valor no válido").nullable(),
  );

/** Un id obligatorio que llega como texto desde un campo oculto. */
export const idDeFormulario = z
  .string()
  .trim()
  .transform(Number)
  .pipe(z.number().int("Id no válido").positive("Id no válido"));

export const categoriaSchema = z.object({
  nombre,
  // Vacío = categoría principal; con valor = subcategoría de esa categoría.
  parent_id: idOpcional,
  activa: z.boolean(),
});
export type CategoriaInput = z.infer<typeof categoriaSchema>;

export const marcaSchema = z.object({
  nombre,
  activa: z.boolean(),
});
export type MarcaInput = z.infer<typeof marcaSchema>;
