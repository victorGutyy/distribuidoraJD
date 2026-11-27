import type { LineaEntrada, VariantePrecio } from "@/lib/precios";

/**
 * Operaciones del carrito (RF-08) como funciones PURAS: reciben la lista actual y
 * devuelven la nueva. El almacén del navegador (Zustand) solo las llama. Con
 * pruebas.
 *
 * El carrito guarda una "foto" de lo último que se vio de cada presentación (para
 * poder mostrarlo sin consultar), pero los precios NO son definitivos: se
 * revalidan al abrir el carrito y el servidor los recalcula al crear el pedido.
 */

export const MAX_CANTIDAD_ITEM = 9999;
export const MAX_ITEMS_CARRITO = 50;

export type ItemCarrito = {
  varianteId: number;
  cantidad: number;
  productoSlug: string;
  nombre: string;
  presentacion: string | null;
  imagen: string | null;
  precio: VariantePrecio;
  disponible: boolean;
};

/** Lo que describe a un ítem, sin la cantidad (también es lo que responde el servidor al revalidar). */
export type DatosItem = Omit<ItemCarrito, "cantidad">;
export type DatosVigentes = DatosItem;

export const limitarCantidad = (n: number): number =>
  Math.min(MAX_CANTIDAD_ITEM, Math.max(1, Math.floor(Number.isFinite(n) ? n : 1)));

export type ResultadoAgregar = {
  items: ItemCarrito[];
  /** false si no se pudo agregar (agotado o carrito lleno). */
  agregado: boolean;
  motivo?: "agotado" | "lleno";
};

/** RN-12: una presentación agotada no se puede agregar. Si ya estaba, se suma la cantidad. */
export function agregarItem(
  items: readonly ItemCarrito[],
  nuevo: Omit<ItemCarrito, "cantidad">,
  cantidad: number,
): ResultadoAgregar {
  if (!nuevo.disponible) return { items: [...items], agregado: false, motivo: "agotado" };
  const existente = items.find((i) => i.varianteId === nuevo.varianteId);
  if (existente) {
    return {
      items: items.map((i) =>
        i.varianteId === nuevo.varianteId
          ? { ...i, ...nuevo, cantidad: limitarCantidad(i.cantidad + cantidad) }
          : i,
      ),
      agregado: true,
    };
  }
  if (items.length >= MAX_ITEMS_CARRITO) return { items: [...items], agregado: false, motivo: "lleno" };
  return { items: [...items, { ...nuevo, cantidad: limitarCantidad(cantidad) }], agregado: true };
}

/** Cambia la cantidad; 0 o menos quita el ítem. */
export function cambiarCantidad(
  items: readonly ItemCarrito[],
  varianteId: number,
  cantidad: number,
): ItemCarrito[] {
  if (!Number.isFinite(cantidad) || cantidad < 1) return quitarItem(items, varianteId);
  return items.map((i) => (i.varianteId === varianteId ? { ...i, cantidad: limitarCantidad(cantidad) } : i));
}

export function quitarItem(items: readonly ItemCarrito[], varianteId: number): ItemCarrito[] {
  return items.filter((i) => i.varianteId !== varianteId);
}

export function totalUnidades(items: readonly ItemCarrito[]): number {
  return items.reduce((s, i) => s + i.cantidad, 0);
}

/** Lo que se manda al servidor: solo ids y cantidades, nunca precios. */
export function aEntradas(items: readonly ItemCarrito[]): LineaEntrada[] {
  return items.map((i) => ({ varianteId: i.varianteId, cantidad: i.cantidad }));
}

/** Mapa de precios para calcular el carrito con lib/precios.ts. */
export function mapaDePrecios(items: readonly ItemCarrito[]): Map<number, VariantePrecio> {
  return new Map(items.map((i) => [i.varianteId, i.precio]));
}

export type ResultadoRevalidar = {
  items: ItemCarrito[];
  /** Avisos para la persona ("«X» cambió de precio", "«X» se quitó…"). */
  avisos: string[];
  /** Hay presentaciones agotadas: no se puede pedir hasta quitarlas. */
  hayAgotados: boolean;
};

const mismoPrecio = (a: VariantePrecio, b: VariantePrecio) =>
  a.precioUnidad === b.precioUnidad &&
  a.enOferta === b.enOferta &&
  a.precioOferta === b.precioOferta;

/**
 * Aplica lo que respondió el servidor (RF-08, RN-06): actualiza precios y
 * disponibilidad, quita lo que ya no se vende y devuelve los avisos. `vigentes`
 * tiene un dato por cada id consultado, o null si ya no existe a la venta.
 */
export function aplicarVigentes(
  items: readonly ItemCarrito[],
  vigentes: ReadonlyMap<number, DatosVigentes | null>,
): ResultadoRevalidar {
  const avisos: string[] = [];
  const resultado: ItemCarrito[] = [];
  for (const item of items) {
    if (!vigentes.has(item.varianteId)) {
      resultado.push(item); // no se consultó: se deja igual
      continue;
    }
    const v = vigentes.get(item.varianteId);
    if (!v) {
      avisos.push(`«${item.nombre}» ya no está a la venta y se quitó del carrito.`);
      continue;
    }
    if (!mismoPrecio(item.precio, v.precio)) {
      avisos.push(`El precio de «${item.nombre}» cambió. Revisa el total.`);
    }
    if (item.disponible && !v.disponible) {
      avisos.push(`«${item.nombre}» se agotó. Quítalo para poder continuar.`);
    }
    resultado.push({ ...item, ...v, cantidad: item.cantidad });
  }
  return { items: resultado, avisos, hayAgotados: resultado.some((i) => !i.disponible) };
}

// ---------------------------------------------------------------------------
// Lo que se guarda en el navegador (localStorage) puede estar vacío, viejo o
// alterado a mano: antes de usarlo se limpia. Nada de esto es de confianza; el
// servidor recalcula todo al crear el pedido (RN-06).
// ---------------------------------------------------------------------------

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const esEnteroPositivo = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;
const esPrecioONulo = (v: unknown): v is number | null =>
  v === null || (typeof v === "number" && Number.isInteger(v) && v >= 0);

/** Convierte lo leído de localStorage en ítems válidos; descarta lo que no lo sea. */
export function sanitizarItems(crudo: unknown): ItemCarrito[] {
  if (!Array.isArray(crudo)) return [];
  const vistos = new Set<number>();
  const resultado: ItemCarrito[] = [];
  for (const i of crudo) {
    if (!esObjeto(i) || !esObjeto(i.precio)) continue;
    const p = i.precio;
    if (
      !esEnteroPositivo(i.varianteId) ||
      vistos.has(i.varianteId) ||
      typeof i.nombre !== "string" ||
      typeof i.productoSlug !== "string" ||
      !esEnteroPositivo(i.cantidad) ||
      !esEnteroPositivo(p.precioUnidad) ||
      !esPrecioONulo(p.precioOferta)
    ) {
      continue;
    }
    vistos.add(i.varianteId);
    resultado.push({
      varianteId: i.varianteId,
      cantidad: limitarCantidad(i.cantidad),
      productoSlug: i.productoSlug.slice(0, 120),
      nombre: i.nombre.slice(0, 120),
      presentacion: typeof i.presentacion === "string" ? i.presentacion.slice(0, 80) : null,
      imagen: typeof i.imagen === "string" && i.imagen.startsWith("https://") ? i.imagen : null,
      precio: {
        precioUnidad: p.precioUnidad,
        enOferta: p.enOferta === true,
        precioOferta: p.precioOferta as number | null,
      },
      disponible: i.disponible !== false,
    });
    if (resultado.length >= MAX_ITEMS_CARRITO) break;
  }
  return resultado;
}

/** Dónde se entrega: en la bodega o en un sector (con su municipio). */
export type UbicacionPedido =
  | { tipo: "bodega" }
  | { tipo: "sector"; municipioId: number; sectorId: number };

export function sanitizarUbicacion(crudo: unknown): UbicacionPedido | null {
  if (!esObjeto(crudo)) return null;
  if (crudo.tipo === "bodega") return { tipo: "bodega" };
  if (crudo.tipo === "sector" && esEnteroPositivo(crudo.municipioId) && esEnteroPositivo(crudo.sectorId)) {
    return { tipo: "sector", municipioId: crudo.municipioId, sectorId: crudo.sectorId };
  }
  return null;
}
