/**
 * Cálculo de precios del carrito y del pedido (RN-02 a RN-06). Lógica PURA, con
 * pruebas. La usan el carrito (para mostrar) y el servidor (para cobrar), así lo
 * que ve el cliente es lo mismo que se calcula al crear el pedido.
 *
 * Todo en pesos COLOMBIANOS ENTEROS (RN-05): nunca se usan decimales.
 */

export type ReglaMayoreo = "por_cantidad" | "por_monto";
export type TipoPrecio = "unidad" | "oferta" | "mayor";

/** Lo que se necesita de una presentación para calcular su precio. */
export type VariantePrecio = {
  precioUnidad: number;
  precioMayor: number | null;
  cantidadMinMayor: number | null;
  enOferta: boolean;
  precioOferta: number | null;
};

export type ConfigPrecios = {
  regla: ReglaMayoreo;
  /** Para "por_monto": desde cuánto (a precio unidad) todo lo que tenga precio por mayor lo usa. 0 = apagado. */
  umbralMonto: number;
};

export type LineaEntrada = { varianteId: number; cantidad: number };

export type LineaCalculada = {
  varianteId: number;
  cantidad: number;
  /** Precio por unidad que se cobra. */
  precioUnitario: number;
  tipo: TipoPrecio;
  /** Precio antes del mayoreo: el de oferta si hay, si no el normal. */
  precioBase: number;
  /** cantidad × precioUnitario (lo que vale la línea). */
  subtotal: number;
};

export type ResultadoCarrito = {
  lineas: LineaCalculada[];
  /** Suma a precio base (con las ofertas, sin el mayoreo). Es el "Subtotal" del pedido. */
  subtotal: number;
  /** Lo que se ahorra por precio por mayor. */
  descuentoMayor: number;
  /** subtotal − descuentoMayor (sin envío). */
  total: number;
  /** true si el mayoreo por monto (RN-03) quedó activo. */
  mayoreoPorMonto: boolean;
  /** Ids que se pidieron pero no se encontraron (no entran en la cuenta). */
  desconocidas: number[];
};

const esPrecio = (n: number | null): n is number =>
  n !== null && Number.isInteger(n) && n > 0;

/** Precio sin mayoreo: el de oferta si es válido y más barato que el normal. */
export function precioBase(v: VariantePrecio): { precio: number; tipo: "unidad" | "oferta" } {
  if (v.enOferta && esPrecio(v.precioOferta) && v.precioOferta < v.precioUnidad) {
    return { precio: v.precioOferta, tipo: "oferta" };
  }
  return { precio: v.precioUnidad, tipo: "unidad" };
}

/**
 * RN-02: ¿esta cantidad alcanza el mayoreo por cantidad? Si la presentación tiene
 * precio por mayor pero no cantidad mínima, el precio por mayor rige desde la
 * primera unidad (así lo muestra también la tienda).
 */
export function alcanzaMayorPorCantidad(v: VariantePrecio, cantidad: number): boolean {
  return esPrecio(v.precioMayor) && cantidad >= (v.cantidadMinMayor ?? 1);
}

/**
 * Precio de UNA línea. `aplicaMayor` dice si el mayoreo está activo para ella
 * (por cantidad o por monto). RN-04: siempre se cobra el menor entre normal,
 * oferta y mayor; el mayor solo gana si es estrictamente más barato.
 */
export function precioDeLinea(
  v: VariantePrecio,
  aplicaMayor: boolean,
): { precio: number; tipo: TipoPrecio; precioBase: number } {
  const base = precioBase(v);
  if (aplicaMayor && esPrecio(v.precioMayor) && v.precioMayor < base.precio) {
    return { precio: v.precioMayor, tipo: "mayor", precioBase: base.precio };
  }
  return { precio: base.precio, tipo: base.tipo, precioBase: base.precio };
}

/** Une varias líneas de la misma presentación y descarta cantidades inválidas. */
export function agruparLineas(lineas: readonly LineaEntrada[]): LineaEntrada[] {
  const por = new Map<number, number>();
  for (const l of lineas) {
    if (!Number.isInteger(l.cantidad) || l.cantidad <= 0) continue;
    por.set(l.varianteId, (por.get(l.varianteId) ?? 0) + l.cantidad);
  }
  return [...por].map(([varianteId, cantidad]) => ({ varianteId, cantidad }));
}

/**
 * Calcula todo el carrito (RN-02 a RN-06). `variantes` trae los precios VIGENTES
 * (leídos de la base de datos, nunca los del navegador).
 */
export function calcularCarrito(
  entradas: readonly LineaEntrada[],
  variantes: ReadonlyMap<number, VariantePrecio>,
  config: ConfigPrecios,
): ResultadoCarrito {
  const lineasEntrada = agruparLineas(entradas);
  const conocidas = lineasEntrada.filter((l) => variantes.has(l.varianteId));
  const desconocidas = lineasEntrada.filter((l) => !variantes.has(l.varianteId)).map((l) => l.varianteId);

  // RN-03: monto a PRECIO UNIDAD de todo el carrito.
  const montoAPrecioUnidad = conocidas.reduce(
    (suma, l) => suma + l.cantidad * (variantes.get(l.varianteId) as VariantePrecio).precioUnidad,
    0,
  );
  const mayoreoPorMonto =
    config.regla === "por_monto" && config.umbralMonto > 0 && montoAPrecioUnidad >= config.umbralMonto;

  const lineas: LineaCalculada[] = conocidas.map((l) => {
    const v = variantes.get(l.varianteId) as VariantePrecio;
    const aplicaMayor =
      config.regla === "por_monto" ? mayoreoPorMonto : alcanzaMayorPorCantidad(v, l.cantidad);
    const p = precioDeLinea(v, aplicaMayor);
    return {
      varianteId: l.varianteId,
      cantidad: l.cantidad,
      precioUnitario: p.precio,
      tipo: p.tipo,
      precioBase: p.precioBase,
      subtotal: l.cantidad * p.precio,
    };
  });

  const subtotal = lineas.reduce((s, l) => s + l.cantidad * l.precioBase, 0);
  const total = lineas.reduce((s, l) => s + l.subtotal, 0);
  return { lineas, subtotal, descuentoMayor: subtotal - total, total, mayoreoPorMonto, desconocidas };
}

/** Lo que falta para llegar al pedido mínimo (0 si ya lo alcanzó o no hay mínimo). */
export function faltaParaMinimo(totalProductos: number, pedidoMinimo: number): number {
  return pedidoMinimo > 0 ? Math.max(0, pedidoMinimo - totalProductos) : 0;
}
