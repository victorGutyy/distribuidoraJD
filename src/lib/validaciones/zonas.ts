import { z } from "zod";
import { parsearPesos } from "@/lib/numeros";
import { idDeFormulario } from "@/lib/validaciones/catalogo";

/**
 * Validación del formulario de sectores de reparto (RF-07). Refleja las reglas de
 * la tabla `sectores` para avisar en el campo exacto antes de que Postgres rechace.
 */

export const DIAS_SEMANA = [
  { valor: 1, nombre: "Lunes" },
  { valor: 2, nombre: "Martes" },
  { valor: 3, nombre: "Miércoles" },
  { valor: 4, nombre: "Jueves" },
  { valor: 5, nombre: "Viernes" },
  { valor: 6, nombre: "Sábado" },
  { valor: 7, nombre: "Domingo" },
] as const;

export const sectorSchema = z.object({
  municipio_id: idDeFormulario,
  nombre: z.string().trim().min(1, "Escribe el nombre del sector").max(80, "Máximo 80 caracteres"),
  /** Llegan como texto desde las casillas ("1" … "7"). */
  dias: z
    .array(z.string())
    .transform((v) => [...new Set(v.map(Number))].filter((n) => Number.isInteger(n) && n >= 1 && n <= 7).sort())
    .refine((v) => v.length > 0, "Elige al menos un día de reparto"),
  /** Vacío = sin costo de envío. */
  costo_envio: z
    .string()
    .trim()
    .refine((v) => v === "" || (parsearPesos(v) !== null && (parsearPesos(v) as number) <= 99_999_999), "Escribe pesos enteros, sin decimales (ej. 3000 o 3.000)")
    .transform((v) => (v === "" ? 0 : (parsearPesos(v) as number))),
  activo: z.boolean(),
});
