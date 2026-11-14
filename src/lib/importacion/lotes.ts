import { normalizarClave } from "@/lib/importacion/texto";

/**
 * Reparto de las filas en lotes y detección de SKU repetidos. Lógica PURA,
 * con pruebas.
 */

/** Los cuatro datos que identifican a un producto dentro del archivo. */
type ConProducto = {
  producto?: string | null;
  categoria?: string | null;
  subcategoria?: string | null;
  marca?: string | null;
};

/** Mismo criterio con que la función SQL decide que varias filas son UN producto. */
export function clavePorProducto(f: ConProducto): string {
  return [f.producto, f.categoria, f.subcategoria, f.marca]
    .map((t) => normalizarClave(t))
    .join("\u0001");
}

/**
 * Reparte las filas en lotes SIN partir un producto entre dos lotes (sus
 * presentaciones deben viajar juntas). Cada lote tiene como máximo
 * `maxProductos` productos y `maxFilas` filas. `datosDe` devuelve los datos del
 * producto de cada elemento.
 */
export function repartirEnLotes<T>(
  filas: readonly T[],
  datosDe: (fila: T) => ConProducto,
  maxProductos = 100,
  maxFilas = 400,
): T[][] {
  const grupos = new Map<string, T[]>();
  for (const fila of filas) {
    const clave = clavePorProducto(datosDe(fila));
    const grupo = grupos.get(clave);
    if (grupo) grupo.push(fila);
    else grupos.set(clave, [fila]);
  }

  const lotes: T[][] = [];
  let actual: T[] = [];
  let productos = 0;
  for (const grupo of grupos.values()) {
    if (
      actual.length > 0 &&
      (productos >= maxProductos || actual.length + grupo.length > maxFilas)
    ) {
      lotes.push(actual);
      actual = [];
      productos = 0;
    }
    actual.push(...grupo);
    productos++;
  }
  if (actual.length > 0) lotes.push(actual);
  return lotes;
}

/** Reparte filas sin agrupar (para precios): trozos de `tamano`. */
export function trocear<T>(filas: readonly T[], tamano: number): T[][] {
  const trozos: T[][] = [];
  for (let i = 0; i < filas.length; i += tamano) {
    trozos.push(filas.slice(i, i + tamano));
  }
  return trozos;
}

/**
 * SKU que aparecen en más de una fila: devuelve, por número de fila, un aviso
 * que apunta a la primera aparición. La primera fila queda sin aviso.
 */
export function skusRepetidos(
  filas: readonly { fila: number; sku: string | null }[],
): Map<number, string> {
  const primera = new Map<string, number>();
  const avisos = new Map<number, string>();
  for (const { fila, sku } of filas) {
    if (!sku) continue;
    const clave = sku.toLowerCase();
    const antes = primera.get(clave);
    if (antes === undefined) primera.set(clave, fila);
    else avisos.set(fila, `sku: está repetido (ya aparece en la fila ${antes})`);
  }
  return avisos;
}
