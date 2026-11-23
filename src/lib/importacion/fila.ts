import { z } from "zod";
import {
  COLUMNAS_IMPORTABLES,
  type FilaCruda,
  type ModoImportacion,
} from "@/lib/importacion/columnas";
import { parsearEnteroConSigno } from "@/lib/numeros";
import { normalizarClave } from "@/lib/importacion/texto";
import { UNIDADES_CONTENIDO, UNIDADES_VENTA } from "@/lib/catalogo/producto-form";
import {
  decimalOpc,
  enteroOpc,
  partirEtiquetas,
  pesosOpc,
  textoOpc,
} from "@/lib/validaciones/producto";

/**
 * Validación de UNA fila del archivo de importación. Lógica PURA, con pruebas.
 *
 * Convención: una celda vacía significa "no tocar" (null). Así importar un
 * archivo sin precios jamás borra los precios que ya estén puestos.
 * Las reglas de precios son las mismas del formulario de producto.
 */

const VERDADERO = new Set(["si", "s", "1", "true", "verdadero", "yes", "x"]);
const FALSO = new Set(["no", "n", "0", "false", "falso"]);

/** "Sí", "no", "1", "x"… → true/false. Vacío → null (no tocar). Otro → error. */
const booleanoOpc = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const clave = normalizarClave(v);
    if (VERDADERO.has(clave)) return true;
    if (FALSO.has(clave)) return false;
    ctx.addIssue({ code: "custom", message: "Escribe sí o no" });
    return z.NEVER;
  });

/** Texto que debe ser uno de una lista (sin importar mayúsculas ni tildes). */
const deLista = (opciones: readonly string[], mensaje: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const clave = normalizarClave(v);
      const encontrada = opciones.find((o) => normalizarClave(o) === clave);
      if (encontrada) return encontrada;
      ctx.addIssue({ code: "custom", message: mensaje });
      return z.NEVER;
    });

const skuOpc = z
  .string()
  .trim()
  .max(40, "Máximo 40 caracteres")
  .regex(/^[A-Za-z0-9._-]*$/, "Solo letras, números, punto y guiones")
  .transform((v) => (v === "" ? null : v));

/** Reglas entre columnas de la misma fila (iguales a las del formulario). */
function reglasDePrecios(
  v: {
    precio_unidad: number | null;
    precio_mayor: number | null;
    en_oferta: boolean | null;
    precio_oferta: number | null;
  },
  ctx: z.RefinementCtx,
) {
  const problema = (path: string, message: string) =>
    ctx.addIssue({ code: "custom", path: [path], message });
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
  if (
    v.en_oferta === true &&
    v.precio_oferta !== null &&
    v.precio_unidad !== null &&
    v.precio_oferta >= v.precio_unidad
  ) {
    problema("precio_oferta", "La oferta debe ser menor que el precio por unidad");
  }
}

const CANTIDAD_MIN = "Escribe un número entero de 1 en adelante";

/**
 * Existencias: entero que puede ser NEGATIVO (el sistema contable del negocio lo permite)
 * y llevar punto de miles. Vacío = no tocar.
 */
const STOCK_MIN = -1_000_000;
const STOCK_MAX = 100_000_000;
const stockOpc = z
  .string()
  .trim()
  .refine((v) => {
    if (v === "") return true;
    const n = parsearEnteroConSigno(v);
    return n !== null && n >= STOCK_MIN && n <= STOCK_MAX;
  }, "Escribe un número entero (puede ser negativo), sin decimales")
  .transform((v) => (v === "" ? null : (parsearEnteroConSigno(v) as number)));

const filaCatalogoSchema = z
  .object({
    sku: skuOpc,
    producto: z
      .string()
      .trim()
      .min(1, "Escribe el nombre del producto")
      .max(120, "Máximo 120 caracteres"),
    categoria: z
      .string()
      .trim()
      .min(1, "Escribe la categoría")
      .max(80, "Máximo 80 caracteres"),
    subcategoria: textoOpc(80),
    marca: textoOpc(80),
    descripcion: textoOpc(2000),
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
    presentacion: textoOpc(60),
    contenido_valor: decimalOpc,
    contenido_unidad: deLista(
      UNIDADES_CONTENIDO,
      `Unidad no válida. Usa: ${UNIDADES_CONTENIDO.join(", ")}`,
    ),
    unidad_venta: deLista(
      UNIDADES_VENTA.map((u) => u.valor),
      `Unidad de venta no válida. Usa: ${UNIDADES_VENTA.map((u) => u.valor).join(", ")}`,
    ),
    unidades_por_empaque: enteroOpc(1, 10_000, CANTIDAD_MIN),
    precio_unidad: pesosOpc,
    precio_mayor: pesosOpc,
    cantidad_min_mayor: enteroOpc(1, 100_000, CANTIDAD_MIN),
    en_oferta: booleanoOpc,
    precio_oferta: pesosOpc,
    disponible: booleanoOpc,
    activo: booleanoOpc,
    // Se acepta por compatibilidad con la plantilla; no se guarda.
    pagina_pdf: z.string().trim(),
  })
  .superRefine(reglasDePrecios);

const filaPreciosSchema = z
  .object({
    sku: skuOpc.refine((v) => v !== null, "Falta el SKU"),
    precio_unidad: pesosOpc,
    precio_mayor: pesosOpc,
    cantidad_min_mayor: enteroOpc(1, 100_000, CANTIDAD_MIN),
    en_oferta: booleanoOpc,
    precio_oferta: pesosOpc,
    disponible: booleanoOpc,
    // Privados (RN-14): solo en el modo "precios", que ya exige rol admin o editor.
    costo: pesosOpc,
    stock: stockOpc,
  })
  .superRefine(reglasDePrecios);

export type FilaCatalogo = z.output<typeof filaCatalogoSchema>;
export type FilaPrecios = z.output<typeof filaPreciosSchema> & { sku: string };

export type Validacion<T> =
  | { ok: true; fila: T }
  | { ok: false; errores: string[] };

function resultado<T>(r: z.ZodSafeParseResult<T>): Validacion<T> {
  if (r.success) return { ok: true, fila: r.data };
  const errores = r.error.issues.map((i) => {
    const columna = i.path[0] ? String(i.path[0]) : "";
    return columna ? `${columna}: ${i.message}` : i.message;
  });
  return { ok: false, errores };
}

/** Las celdas que no vinieron en el archivo cuentan como vacías. */
function completa(cruda: FilaCruda): Record<string, string> {
  return Object.fromEntries(
    COLUMNAS_IMPORTABLES.map((c) => [c, cruda[c] ?? ""]),
  );
}

export function validarFilaCatalogo(cruda: FilaCruda): Validacion<FilaCatalogo> {
  return resultado(filaCatalogoSchema.safeParse(completa(cruda)));
}

export function validarFilaPrecios(cruda: FilaCruda): Validacion<FilaPrecios> {
  return resultado(
    filaPreciosSchema.safeParse(completa(cruda)),
  ) as Validacion<FilaPrecios>;
}

export function validarFila(
  modo: ModoImportacion,
  cruda: FilaCruda,
): Validacion<FilaCatalogo> | Validacion<FilaPrecios> {
  return modo === "precios"
    ? validarFilaPrecios(cruda)
    : validarFilaCatalogo(cruda);
}

/** Quita las claves vacías: lo que se manda a la función SQL. */
function sinVacios<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(
      ([, v]) => v !== null && !(Array.isArray(v) && v.length === 0),
    ),
  );
}

/** Cuerpo de una fila para `importar_catalogo`. */
export function payloadCatalogo(fila: FilaCatalogo): Record<string, unknown> {
  // pagina_pdf es solo informativa: no viaja a la base de datos.
  return sinVacios({ ...fila, pagina_pdf: null });
}

/** Cuerpo de una fila para `guardar_precios` (sin el costo ni las existencias). */
export function payloadPrecios(fila: FilaPrecios): Record<string, unknown> {
  return sinVacios({ ...fila, costo: null, stock: null });
}

/** ¿La fila trae algún precio, oferta o disponibilidad? Si no, no hace falta llamar a guardar_precios. */
export function traePrecios(fila: FilaPrecios): boolean {
  return (
    fila.precio_unidad !== null ||
    fila.precio_mayor !== null ||
    fila.cantidad_min_mayor !== null ||
    fila.en_oferta !== null ||
    fila.precio_oferta !== null ||
    fila.disponible !== null
  );
}

/** Cuerpo de una fila para `guardar_costos`; null si la fila no trae costo ni existencias. */
export function payloadCostos(fila: FilaPrecios): Record<string, unknown> | null {
  if (fila.costo === null && fila.stock === null) return null;
  return sinVacios({ sku: fila.sku, costo: fila.costo, stock: fila.stock });
}
