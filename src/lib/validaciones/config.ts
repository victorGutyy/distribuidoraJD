import { z } from "zod";
import { fechaValida } from "@/lib/filtros-pedidos";
import { enlaceSeguro } from "@/lib/tienda/imagenes";
import { parsearPesos } from "@/lib/numeros";
import { normalizarCelularWhatsApp } from "@/lib/whatsapp";

/**
 * Validación de la pantalla de configuración (RF-30). Todo llega como texto desde el
 * formulario; aquí se valida y se convierte a lo que se guarda en la tabla
 * `configuracion`. Con pruebas.
 */

/** Pesos enteros ≥ 0; vacío = 0. */
const pesosCero = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || (parsearPesos(v) !== null && (parsearPesos(v) as number) <= 99_999_999),
    "Escribe pesos enteros, sin decimales (ej. 50000 o 50.000)",
  )
  .transform((v) => (v === "" ? 0 : (parsearPesos(v) as number)));

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((v) => (v === "" ? null : v));

/** Número de WhatsApp: vacío = sin número; si no, un celular colombiano. Se guarda con 57. */
export const whatsappSchema = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || normalizarCelularWhatsApp(v) !== null,
    "Escribe un celular colombiano de 10 dígitos que empiece por 3",
  )
  .transform((v) => (v === "" ? null : (normalizarCelularWhatsApp(v) as string)));

export const contactoSchema = z.object({
  whatsapp: whatsappSchema,
  mensaje_whatsapp: z
    .string()
    .trim()
    .min(1, "Escribe el mensaje del botón de WhatsApp")
    .max(200, "Máximo 200 caracteres"),
  mensaje_barra: textoOpcional(120),
});

export const REGLAS_MAYOREO = [
  { valor: "por_cantidad", etiqueta: "Por cantidad de cada producto", ayuda: "Cada producto tiene su cantidad mínima para el precio por mayor." },
  { valor: "por_monto", etiqueta: "Por el monto de todo el pedido", ayuda: "Si el pedido supera el monto, todo lo que tenga precio por mayor lo usa." },
  { valor: "ambas", etiqueta: "Ambas (basta con que se cumpla una)", ayuda: "Rige por cantidad o por monto, lo que se cumpla primero." },
] as const;

export const comprasSchema = z
  .object({
    pedido_minimo: pesosCero,
    regla_mayoreo: z.enum(["por_cantidad", "por_monto", "ambas"], { error: "Elige una regla" }),
    umbral_mayor_monto: pesosCero,
  })
  .superRefine((v, ctx) => {
    if (v.regla_mayoreo !== "por_cantidad" && v.umbral_mayor_monto <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["umbral_mayor_monto"],
        message: "Escribe desde qué monto rige el precio por mayor",
      });
    }
  });

/** Texto con una fecha por línea (o separadas por coma) → lista ordenada sin repetidas. */
export function parsearDiasNoHabiles(texto: string): { fechas: string[]; invalidas: string[] } {
  const partes = texto
    .split(/[\n,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const fechas = new Set<string>();
  const invalidas: string[] = [];
  for (const p of partes) {
    const f = fechaValida(p);
    if (f) fechas.add(f);
    else invalidas.push(p);
  }
  return { fechas: [...fechas].sort(), invalidas };
}

export const entregaSchema = z.object({
  hora_corte: z
    .string()
    .trim()
    .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "Escribe la hora así: 17:00"),
  dias_no_habiles: z
    .string()
    .max(4000, "Demasiado texto")
    .transform((v, ctx) => {
      const { fechas, invalidas } = parsearDiasNoHabiles(v);
      if (invalidas.length > 0) {
        ctx.addIssue({
          code: "custom",
          message: `Estas fechas no son válidas (usa AAAA-MM-DD): ${invalidas.slice(0, 3).join(", ")}`,
        });
        return z.NEVER;
      }
      if (fechas.length > 200) {
        ctx.addIssue({ code: "custom", message: "Máximo 200 fechas" });
        return z.NEVER;
      }
      return fechas;
    }),
});

/** Una red social: vacía, o un enlace https. */
const redSocial = z
  .string()
  .trim()
  .max(200, "Máximo 200 caracteres")
  .refine((v) => v === "" || enlaceSeguro(v)?.startsWith("https://"), "Escribe un enlace que empiece por https://")
  .transform((v) => (v === "" ? null : (enlaceSeguro(v) as string)));

export const empresaSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe el nombre de la empresa").max(80, "Máximo 80 caracteres"),
  nit: textoOpcional(20),
  direccion: textoOpcional(150),
  horarios: textoOpcional(150),
  facebook: redSocial,
  instagram: redSocial,
  tiktok: redSocial,
});

/** Lo que se guarda en la clave "empresa" (las redes vacías no se guardan). */
export function empresaParaGuardar(v: z.output<typeof empresaSchema>) {
  const redes: Record<string, string> = {};
  if (v.facebook) redes.facebook = v.facebook;
  if (v.instagram) redes.instagram = v.instagram;
  if (v.tiktok) redes.tiktok = v.tiktok;
  return { nombre: v.nombre, nit: v.nit, direccion: v.direccion, horarios: v.horarios, redes };
}
