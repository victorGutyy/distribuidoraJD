import { z } from "zod";
import { MAX_CANTIDAD_ITEM, MAX_ITEMS_CARRITO } from "@/lib/carrito";

/**
 * Validación del checkout (RF-09). Se usa en el navegador (react-hook-form) y se
 * repite en el servidor: nunca se confía en lo que manda el cliente.
 */

/** "310 123 4567", "+57 3101234567" → "3101234567". null si no es un celular colombiano. */
export function normalizarCelular(valor: string): string | null {
  const digitos = valor.replace(/\D/g, "");
  const sin57 = digitos.length === 12 && digitos.startsWith("57") ? digitos.slice(2) : digitos;
  return /^3\d{9}$/.test(sin57) ? sin57 : null;
}

const texto = (min: number, max: number, mensajeMin: string) =>
  z.string().trim().min(min, mensajeMin).max(max, `Máximo ${max} caracteres`);

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((v) => (v === "" ? null : v));

export const celularSchema = z
  .string()
  .trim()
  .min(1, "Escribe tu celular")
  .refine((v) => normalizarCelular(v) !== null, "Escribe un celular colombiano de 10 dígitos que empiece por 3")
  .transform((v) => normalizarCelular(v) as string);

/** Cédula o NIT: solo números, puntos y guion. */
const documentoSchema = z
  .string()
  .trim()
  .max(20, "Máximo 20 caracteres")
  .refine((v) => v === "" || /^[0-9][0-9.\-]{4,19}$/.test(v), "Solo números, puntos y guion")
  .transform((v) => (v === "" ? null : v));

export const lineaPedidoSchema = z.object({
  varianteId: z.number().int().positive(),
  cantidad: z.number().int().min(1).max(MAX_CANTIDAD_ITEM),
});

export const checkoutSchema = z
  .object({
    nombre: texto(2, 80, "Escribe tu nombre"),
    celular: celularSchema,
    nombre_negocio: textoOpcional(80),
    documento: documentoSchema,
    /** true = el cliente recoge en la bodega (no hay sector ni dirección). */
    recoge_en_bodega: z.boolean(),
    sector_id: z.number().int().positive().nullable(),
    direccion: z.string().trim().max(150, "Máximo 150 caracteres"),
    referencia: textoOpcional(120),
    notas: textoOpcional(300),
    acepta_datos: z.literal(true, { error: "Debes aceptar la política de tratamiento de datos" }),
    /** Campo trampa (honeypot): una persona nunca lo ve; un bot lo llena. */
    web: z.string().max(0).optional().default(""),
    items: z.array(lineaPedidoSchema).min(1, "Tu carrito está vacío").max(MAX_ITEMS_CARRITO),
    /**
     * Total que la persona está viendo. Si al recalcular en el servidor es otro
     * (cambiaron los precios), no se crea el pedido sin avisarle antes (RN-06).
     */
    total_visto: z.number().int().min(0).max(1_000_000_000),
  })
  .superRefine((p, ctx) => {
    if (p.recoge_en_bodega) return;
    if (p.sector_id === null) {
      ctx.addIssue({ code: "custom", path: ["sector_id"], message: "Elige tu municipio y sector" });
    }
    if (p.direccion.length < 5) {
      ctx.addIssue({ code: "custom", path: ["direccion"], message: "Escribe tu dirección (mínimo 5 caracteres)" });
    }
  });

export type CheckoutEntrada = z.input<typeof checkoutSchema>;
export type CheckoutValidado = z.output<typeof checkoutSchema>;
