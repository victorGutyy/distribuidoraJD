/**
 * Cálculo de precios del carrito y del pedido (RN-02 a RN-06). Lógica PURA, con
 * pruebas. La usan el carrito (para mostrar) y el servidor (para cobrar), así lo
 * que ve el cliente es lo mismo que se calcula al crear el pedido.
 *
 * Todo en pesos COLOMBIANOS ENTEROS (RN-05): nunca se usan decimales.
 *
 * Regla de descuento (RN-02/RN-03, vigente desde nov-2026): las compras cuyo subtotal
 * (productos, con las ofertas ya aplicadas, sin envío) llega al monto mínimo reciben un
 * porcentaje de descuento (hoy 5 % desde $500.000). El precio por mayor de cada producto
 * ya no se usa. Para que lo guardado en los pedidos y la ganancia sigan cuadrando, el
 * descuento se aplica a cada línea: cada precio unitario baja el porcentaje y se redondea
 * al peso más cercano.
 */

export type TipoPrecio = "unidad" | "oferta" | "mayor";

/** Lo que se necesita de una presentación para calcular su precio. */
export type VariantePrecio = {
  precioUnidad: number;
  enOferta: boolean;
  precioOferta: number | null;
};

export type ConfigPrecios = {
  /** Subtotal desde el cual rige el descuento (pesos). 0 = descuento apagado. */
  montoMinimo: number;
  /** Porcentaje de descuento (1 a 99). 0 = descuento apagado. */
  porcentaje: number;
};

export type LineaEntrada = { varianteId: number; cantidad: number };

export type LineaCalculada = {
  varianteId: number;
  cantidad: number;
  /** Precio por unidad que se cobra. */
  precioUnitario: number;
  /** "mayor" = lleva el descuento por monto (así se guarda en pedido_items). */
  tipo: TipoPrecio;
  /** Precio antes del descuento: el de oferta si hay, si no el normal. */
  precioBase: number;
  /** cantidad × precioUnitario (lo que vale la línea). */
  subtotal: number;
};

export type ResultadoCarrito = {
  lineas: LineaCalculada[];
  /** Suma a precio base (con las ofertas, sin el descuento). Es el "Subtotal" del pedido. */
  subtotal: number;
  /** Lo que se ahorra por el descuento del pedido. */
  descuentoMayor: number;
  /** subtotal − descuentoMayor (sin envío). */
  total: number;
  /** true si el descuento por monto quedó activo. */
  descuentoActivo: boolean;
  /** Cuánto falta de subtotal para el descuento (0 si ya rige o está apagado). */
  faltaParaDescuento: number;
  /** Ids que se pidieron pero no se encontraron (no entran en la cuenta). */
  desconocidas: number[];
};

const esPrecio = (n: number | null): n is number =>
  n !== null && Number.isInteger(n) && n > 0;

/** ¿El descuento está configurado (monto y porcentaje válidos)? */
export function descuentoConfigurado(config: ConfigPrecios): boolean {
  return (
    Number.isInteger(config.montoMinimo) &&
    config.montoMinimo > 0 &&
    Number.isFinite(config.porcentaje) &&
    config.porcentaje > 0 &&
    config.porcentaje < 100
  );
}

/** Precio sin descuento por monto: el de oferta si es válido y más barato que el normal. */
export function precioBase(v: VariantePrecio): { precio: number; tipo: "unidad" | "oferta" } {
  if (v.enOferta && esPrecio(v.precioOferta) && v.precioOferta < v.precioUnidad) {
    return { precio: v.precioOferta, tipo: "oferta" };
  }
  return { precio: v.precioUnidad, tipo: "unidad" };
}

/** Precio normal con el porcentaje de descuento, al peso más cercano. */
export function precioConDescuento(precioUnidad: number, porcentaje: number): number {
  return Math.round((precioUnidad * (100 - porcentaje)) / 100);
}

/**
 * Precio de UNA línea. RN-04: siempre se cobra el menor entre la oferta y el precio con
 * descuento, así que una oferta mejor que el descuento NO se rebaja otra vez.
 */
export function precioDeLinea(
  v: VariantePrecio,
  descuentoActivo: boolean,
  porcentaje: number,
): { precio: number; tipo: TipoPrecio; precioBase: number } {
  const base = precioBase(v);
  if (descuentoActivo) {
    const conDescuento = precioConDescuento(v.precioUnidad, porcentaje);
    if (conDescuento > 0 && conDescuento < base.precio) {
      return { precio: conDescuento, tipo: "mayor", precioBase: base.precio };
    }
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

  // El monto que cuenta es el subtotal que ve el cliente: a precio base (con las ofertas).
  const montoBase = conocidas.reduce(
    (suma, l) => suma + l.cantidad * precioBase(variantes.get(l.varianteId) as VariantePrecio).precio,
    0,
  );
  const configurado = descuentoConfigurado(config);
  const descuentoActivo = configurado && montoBase >= config.montoMinimo;

  const lineas: LineaCalculada[] = conocidas.map((l) => {
    const v = variantes.get(l.varianteId) as VariantePrecio;
    const p = precioDeLinea(v, descuentoActivo, config.porcentaje);
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
  return {
    lineas,
    subtotal,
    descuentoMayor: subtotal - total,
    total,
    descuentoActivo,
    faltaParaDescuento: configurado && !descuentoActivo ? config.montoMinimo - montoBase : 0,
    desconocidas,
  };
}

/** «Compras desde $500.000: 5 % de descuento»; null si el descuento no está configurado. */
export function textoDescuento(config: ConfigPrecios, formatear: (pesos: number) => string): string | null {
  return descuentoConfigurado(config)
    ? `Compras desde ${formatear(config.montoMinimo)}: ${config.porcentaje} % de descuento`
    : null;
}

/** Lo que falta para llegar al pedido mínimo (0 si ya lo alcanzó o no hay mínimo). */
export function faltaParaMinimo(totalProductos: number, pedidoMinimo: number): number {
  return pedidoMinimo > 0 ? Math.max(0, pedidoMinimo - totalProductos) : 0;
}
