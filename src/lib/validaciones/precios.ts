import { z } from "zod";
import {
  enteroOpc,
  pesosOpc,
  reglasDePreciosVariante,
} from "@/lib/validaciones/producto";

/**
 * Validación de una fila del editor rápido de precios. Igual que en el formulario
 * de producto, todo viaja como texto ("3.200") y aquí se convierte a números.
 * En esta pantalla una celda vacía SÍ borra el dato (p. ej. quitar el precio por mayor).
 */
export const edicionPrecioSchema = z
  .object({
    id: z.number().int().positive(),
    precio_unidad: pesosOpc,
    precio_mayor: pesosOpc,
    cantidad_min_mayor: enteroOpc(
      1,
      100_000,
      "Escribe un número entero de 1 en adelante",
    ),
    en_oferta: z.boolean(),
    precio_oferta: pesosOpc,
    disponible: z.boolean(),
    // Costo (RF-32): vacío = quitarlo, pero SOLO si `costo_modificado` es true; si no, no se toca.
    costo: pesosOpc,
    costo_modificado: z.boolean(),
  })
  .superRefine(reglasDePreciosVariante);

export type EdicionPrecioEntrada = z.input<typeof edicionPrecioSchema>;
export type EdicionPrecio = z.output<typeof edicionPrecioSchema>;
