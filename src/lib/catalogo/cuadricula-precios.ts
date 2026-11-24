import { parsearEntero, parsearPesos } from "@/lib/numeros";
import type { Tables } from "@/types/database.types";

/**
 * Lógica de la cuadrícula del editor rápido de precios. PURA, con pruebas.
 * Todo lo que se escribe viaja como texto; aquí se decide si una fila cambió.
 */

/** Presentaciones por página de la cuadrícula. */
export const POR_PAGINA_PRECIOS = 50;

/** Una fila de la vista v_precios_admin (sus columnas son anulables en los tipos). */
export type FilaPrecio = {
  id: number;
  sku: string;
  producto_nombre: string;
  nombre_presentacion: string | null;
  marca_nombre: string | null;
  precio_unidad: number | null;
  precio_mayor: number | null;
  cantidad_min_mayor: number | null;
  en_oferta: boolean;
  precio_oferta: number | null;
  disponible: boolean;
  /** Privado (RN-14): viene de variante_costos, no de la vista. null = sin dato. */
  costo: number | null;
};

export type ValoresPrecio = {
  precio_unidad: string;
  precio_mayor: string;
  cantidad_min_mayor: string;
  en_oferta: boolean;
  precio_oferta: string;
  disponible: boolean;
  costo: string;
};

export type CampoTexto =
  | "precio_unidad"
  | "precio_mayor"
  | "cantidad_min_mayor"
  | "precio_oferta"
  | "costo";

const texto = (v: number | null) => (v === null ? "" : String(v));

/**
 * Convierte una fila de la vista (valores anulables) en una fila bien tipada.
 * El costo no está en la vista (es privado): se consulta aparte y se pasa aquí.
 */
export function aFilaPrecio(
  v: Tables<"v_precios_admin">,
  costo: number | null = null,
): FilaPrecio | null {
  if (v.id === null || v.sku === null || v.producto_nombre === null) return null;
  return {
    id: v.id,
    sku: v.sku,
    producto_nombre: v.producto_nombre,
    nombre_presentacion: v.nombre_presentacion,
    marca_nombre: v.marca_nombre,
    precio_unidad: v.precio_unidad,
    precio_mayor: v.precio_mayor,
    cantidad_min_mayor: v.cantidad_min_mayor,
    en_oferta: v.en_oferta ?? false,
    precio_oferta: v.precio_oferta,
    disponible: v.disponible ?? true,
    costo,
  };
}

export function valoresDesdeFila(f: FilaPrecio): ValoresPrecio {
  return {
    precio_unidad: texto(f.precio_unidad),
    precio_mayor: texto(f.precio_mayor),
    cantidad_min_mayor: texto(f.cantidad_min_mayor),
    en_oferta: f.en_oferta,
    precio_oferta: texto(f.precio_oferta),
    disponible: f.disponible,
    costo: texto(f.costo),
  };
}

/** "3.200" y "3200" son el mismo precio; un texto que no es número se compara tal cual. */
function canonico(campo: CampoTexto, valor: string): string {
  const limpio = valor.trim();
  if (limpio === "") return "";
  const n = campo === "cantidad_min_mayor" ? parsearEntero(limpio) : parsearPesos(limpio);
  return n === null ? limpio : String(n);
}

const CAMPOS_TEXTO: readonly CampoTexto[] = [
  "precio_unidad",
  "precio_mayor",
  "cantidad_min_mayor",
  "precio_oferta",
  "costo",
];

/**
 * ¿Cambió el costo de esta fila? Solo las filas con el costo cambiado se mandan a
 * guardar_costos: así no se crean filas vacías en la tabla privada ni se pisa nada.
 */
export function costoCambiado(base: ValoresPrecio, actual: ValoresPrecio): boolean {
  return canonico("costo", base.costo) !== canonico("costo", actual.costo);
}

/** ¿La fila editada es distinta de la guardada? */
export function filaCambiada(base: ValoresPrecio, actual: ValoresPrecio): boolean {
  if (base.en_oferta !== actual.en_oferta) return true;
  if (base.disponible !== actual.disponible) return true;
  return CAMPOS_TEXTO.some(
    (c) => canonico(c, base[c]) !== canonico(c, actual[c]),
  );
}

/** Ids de las filas con cambios sin guardar. */
export function idsModificados(
  base: Readonly<Record<number, ValoresPrecio>>,
  actual: Readonly<Record<number, ValoresPrecio>>,
): number[] {
  return Object.keys(actual)
    .map(Number)
    .filter((id) => base[id] !== undefined && filaCambiada(base[id], actual[id]));
}

/**
 * Advertencia de «sentido común» para una fila editada (no bloquea el guardado):
 * - vaciar el precio de la unidad deja la presentación sin precio y la oculta de la tienda;
 * - cambiar el precio más de un 50 % suele ser un error de digitación (3200 → 320).
 */
export function advertenciaDeFila(base: ValoresPrecio, actual: ValoresPrecio): string | null {
  const antes = canonico("precio_unidad", base.precio_unidad);
  const ahora = canonico("precio_unidad", actual.precio_unidad);
  if (antes === ahora) return null;
  if (antes !== "" && ahora === "") return "Quedará sin precio y se ocultará de la tienda.";
  const a = Number(antes);
  const b = Number(ahora);
  if (antes !== "" && a > 0 && Number.isFinite(b) && Math.abs(b - a) / a > 0.5) {
    return `El precio cambia más de un 50 % (de ${a} a ${b}). Revisa que no sea un error de digitación.`;
  }
  return null;
}
