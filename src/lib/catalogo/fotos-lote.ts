/**
 * Subida de fotos en lote, asignadas a cada producto por el SKU que lleva el nombre del
 * archivo. Lógica PURA, con pruebas.
 *
 *   EVC-00001.jpg      → foto principal del producto EVC-00001
 *   EVC-00001_2.jpg    → su segunda foto (galería)
 *   EVC-00001-01.jpg   → también vale: es el SKU de una presentación; se usa su producto
 */

export const EXTENSIONES_FOTO = ["jpg", "jpeg", "png", "webp"] as const;

const SKU = /^[A-Za-z0-9][A-Za-z0-9.-]{0,39}$/;

export type NombreFoto = {
  /** SKU del PRODUCTO (sin el "-01" de la presentación). */
  sku: string;
  /** 1 = principal, 2 = segunda… */
  orden: number;
};

/** SKU de una presentación ("EVC-00001-01") → el de su producto ("EVC-00001"). */
export function skuDeProducto(sku: string): string {
  const m = /^(.+)-\d{2}$/.exec(sku);
  return m ? m[1] : sku;
}

/** Lee "EVC-00001_2.jpg"; null si el nombre no sirve (extensión, SKU u orden inválidos). */
export function parsearNombreFoto(nombreArchivo: string): NombreFoto | null {
  const m = /^(.+)\.([A-Za-z0-9]+)$/.exec(nombreArchivo.trim());
  if (!m || !(EXTENSIONES_FOTO as readonly string[]).includes(m[2].toLowerCase())) return null;
  const [base, resto, ...sobrante] = m[1].split("_");
  if (sobrante.length > 0 || !SKU.test(base)) return null;
  let orden = 1;
  if (resto !== undefined) {
    if (!/^\d{1,2}$/.test(resto)) return null;
    orden = Number(resto);
    if (orden < 1 || orden > 10) return null;
  }
  return { sku: skuDeProducto(base.toUpperCase()), orden };
}

export type ArchivoConNombre<T> = { archivo: T; nombre: string };

export type GrupoFotos<T> = { sku: string; archivos: { archivo: T; orden: number }[] };

/**
 * Agrupa los archivos por producto, ordenados por su número. Devuelve aparte los nombres
 * inválidos y los repetidos (dos archivos para el mismo SKU y orden: gana el primero).
 */
export function agruparFotos<T>(entradas: readonly ArchivoConNombre<T>[]): {
  grupos: GrupoFotos<T>[];
  invalidos: string[];
  repetidos: string[];
} {
  const por = new Map<string, Map<number, T>>();
  const invalidos: string[] = [];
  const repetidos: string[] = [];
  for (const { archivo, nombre } of entradas) {
    const n = parsearNombreFoto(nombre);
    if (!n) {
      invalidos.push(nombre);
      continue;
    }
    const ordenes = por.get(n.sku) ?? new Map<number, T>();
    if (ordenes.has(n.orden)) {
      repetidos.push(nombre);
      continue;
    }
    ordenes.set(n.orden, archivo);
    por.set(n.sku, ordenes);
  }
  const grupos = [...por]
    .map(([sku, ordenes]) => ({
      sku,
      archivos: [...ordenes].map(([orden, archivo]) => ({ archivo, orden })).sort((a, b) => a.orden - b.orden),
    }))
    .sort((a, b) => a.sku.localeCompare(b.sku));
  return { grupos, invalidos, repetidos };
}

export type ProductoPorSku = { productoId: number; nombre: string; imagenes: number };

export type PlanFotos<T> = {
  /** Productos que se van a subir. */
  porSubir: { sku: string; productoId: number; nombre: string; archivos: { archivo: T; orden: number }[] }[];
  /** SKU que no existen en el catálogo. */
  sinProducto: string[];
  /** Productos que ya tienen foto y se saltan (si se pidió omitirlos). */
  yaTienenFoto: string[];
  /** Fotos que sobran sobre el máximo por producto. */
  recortadas: number;
};

/** Cruza los grupos con los productos encontrados y decide qué se sube. */
export function planearSubida<T>(
  grupos: readonly GrupoFotos<T>[],
  productos: Readonly<Record<string, ProductoPorSku>>,
  opciones: { omitirConFoto: boolean; maxPorProducto: number },
): PlanFotos<T> {
  const plan: PlanFotos<T> = { porSubir: [], sinProducto: [], yaTienenFoto: [], recortadas: 0 };
  for (const g of grupos) {
    const p = productos[g.sku];
    if (!p) {
      plan.sinProducto.push(g.sku);
      continue;
    }
    if (opciones.omitirConFoto && p.imagenes > 0) {
      plan.yaTienenFoto.push(g.sku);
      continue;
    }
    const cupo = Math.max(0, opciones.maxPorProducto - p.imagenes);
    const archivos = g.archivos.slice(0, cupo);
    plan.recortadas += g.archivos.length - archivos.length;
    if (archivos.length > 0) plan.porSubir.push({ sku: g.sku, productoId: p.productoId, nombre: p.nombre, archivos });
  }
  return plan;
}
