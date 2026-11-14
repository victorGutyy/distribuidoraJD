import { z } from "zod";
import { parsearDecimal, parsearEntero, parsearPesos } from "@/lib/numeros";

/**
 * Validación del formulario de producto con sus presentaciones (RF-24).
 *
 * En el formulario TODO viaja como texto (así escribe la gente: "3.200"); este
 * esquema lo valida y lo convierte a números/null. Las reglas reflejan las de
 * la base de datos (CHECKs de `variantes`) para avisar en el campo exacto.
 */

const vacioANull = (v: string) => (v === "" ? null : v);

export const textoOpc = (max: number) =>
  z.string().trim().max(max, `Máximo ${max} caracteres`).transform(vacioANull);

/** Pesos enteros > 0 (RN-05). Vacío = sin precio todavía. */
export const pesosOpc = z
  .string()
  .trim()
  .refine((v) => {
    if (v === "") return true;
    const n = parsearPesos(v);
    return n !== null && n > 0 && n <= 99_999_999;
  }, "Escribe un valor entero mayor que 0, sin decimales (ej. 3200 o 3.200)")
  .transform((v) => (v === "" ? null : (parsearPesos(v) as number)));

export const enteroOpc = (min: number, max: number, mensaje: string) =>
  z
    .string()
    .trim()
    .refine((v) => {
      if (v === "") return true;
      const n = parsearEntero(v);
      return n !== null && n >= min && n <= max;
    }, mensaje)
    .transform((v) => (v === "" ? null : (parsearEntero(v) as number)));

export const decimalOpc = z
  .string()
  .trim()
  .refine((v) => {
    if (v === "") return true;
    const n = parsearDecimal(v);
    return n !== null && n > 0 && n <= 1_000_000;
  }, "Escribe un número mayor que 0 (ej. 0,5 o 250)")
  .transform((v) => (v === "" ? null : (parsearDecimal(v) as number)));

/**
 * Reglas entre los precios de UNA presentación (RN-05). Las usan el formulario de
 * producto y el editor rápido de precios, para que digan exactamente lo mismo.
 */
export function reglasDePreciosVariante(
  v: {
    precio_unidad: number | null;
    precio_mayor: number | null;
    en_oferta: boolean;
    precio_oferta: number | null;
  },
  ctx: z.RefinementCtx,
) {
  const problema = (path: string, message: string) =>
    ctx.addIssue({ code: "custom", path: [path], message });

  if (v.precio_mayor !== null && v.precio_unidad === null) {
    problema("precio_mayor", "Primero escribe el precio por unidad");
  }
  if (
    v.precio_mayor !== null &&
    v.precio_unidad !== null &&
    v.precio_mayor > v.precio_unidad
  ) {
    problema(
      "precio_mayor",
      "El precio por mayor no puede ser mayor que el de unidad",
    );
  }
  if (v.en_oferta && v.precio_oferta === null) {
    problema("precio_oferta", "Escribe el precio de oferta");
  }
  if (
    v.en_oferta &&
    v.precio_oferta !== null &&
    v.precio_unidad !== null &&
    v.precio_oferta >= v.precio_unidad
  ) {
    problema(
      "precio_oferta",
      "La oferta debe ser menor que el precio por unidad",
    );
  }
}

export const varianteSchema = z
  .object({
    /** "" = presentación nueva. */
    id: z.string().trim(),
    /** "" = se autogenera (EV-00001-01). */
    sku: z
      .string()
      .trim()
      .max(40, "Máximo 40 caracteres")
      .regex(/^[A-Za-z0-9._-]*$/, "Solo letras, números, punto y guiones"),
    nombre_presentacion: textoOpc(60),
    contenido_valor: decimalOpc,
    contenido_unidad: textoOpc(20),
    unidad_venta: z
      .string()
      .trim()
      .min(1, "Elige la unidad de venta")
      .max(40, "Máximo 40 caracteres"),
    unidades_por_empaque: z
      .string()
      .trim()
      .refine((v) => {
        const n = parsearEntero(v);
        return n !== null && n >= 1 && n <= 10_000;
      }, "Escribe un número entero de 1 en adelante")
      .transform((v) => parsearEntero(v) as number),
    peso_g: enteroOpc(1, 1_000_000, "Escribe los gramos como número entero"),
    alto_cm: decimalOpc,
    ancho_cm: decimalOpc,
    largo_cm: decimalOpc,
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
    activo: z.boolean(),
  })
  .superRefine(reglasDePreciosVariante);

/** "a, b ,A" → ["a","b"] (sin vacíos ni repetidos, sin importar mayúsculas). */
export function partirEtiquetas(texto: string): string[] {
  const vistas = new Set<string>();
  const resultado: string[] = [];
  for (const parte of texto.split(",")) {
    const etiqueta = parte.trim();
    const clave = etiqueta.toLowerCase();
    if (etiqueta && !vistas.has(clave)) {
      vistas.add(clave);
      resultado.push(etiqueta);
    }
  }
  return resultado;
}

export const productoSchema = z
  .object({
    /** "" = producto nuevo. */
    id: z.string().trim(),
    nombre: z
      .string()
      .trim()
      .min(1, "Escribe el nombre del producto")
      .max(120, "Máximo 120 caracteres"),
    descripcion: textoOpc(2000),
    categoria_id: z
      .string()
      .trim()
      .min(1, "Elige una categoría")
      .transform(Number)
      .pipe(
        z.number().int("Elige una categoría").positive("Elige una categoría"),
      ),
    marca_id: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : Number(v)))
      .pipe(z.number().int().positive().nullable()),
    /** Separadas por comas en el formulario. */
    etiquetas: z
      .string()
      .trim()
      .max(300, "Máximo 300 caracteres")
      .refine((v) => partirEtiquetas(v).length <= 10, "Máximo 10 etiquetas")
      .refine(
        (v) => partirEtiquetas(v).every((e) => e.length <= 30),
        "Cada etiqueta puede tener hasta 30 caracteres",
      )
      .transform(partirEtiquetas),
    destacado: z.boolean(),
    es_nuevo: z.boolean(),
    activo: z.boolean(),
    variantes: z
      .array(varianteSchema)
      .min(1, "Agrega al menos una presentación")
      .max(30, "Máximo 30 presentaciones por producto"),
  })
  .superRefine((p, ctx) => {
    // El mismo SKU no puede repetirse dentro del formulario.
    const vistos = new Set<string>();
    p.variantes.forEach((v, i) => {
      if (!v.sku) return;
      const clave = v.sku.toLowerCase();
      if (vistos.has(clave)) {
        ctx.addIssue({
          code: "custom",
          path: ["variantes", i, "sku"],
          message: "Este SKU está repetido en otra presentación",
        });
      }
      vistos.add(clave);
    });
  });

export type VarianteFormValues = z.input<typeof varianteSchema>;
export type ProductoFormValues = z.input<typeof productoSchema>;
export type ProductoValidado = z.output<typeof productoSchema>;
