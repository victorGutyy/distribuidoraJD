/**
 * Costos, ganancia e inventario informativo (RF-32, RN-14 a RN-16).
 *
 * Lógica PURA (sin Next ni Supabase) para poder probarla con Vitest.
 *
 * Todo está en pesos enteros COP y CON IVA (precio y costo en la misma base), así que la
 * ganancia es simplemente `precio − costo`, sin ajustes de impuesto.
 */

/** Por debajo de este margen (%) se avisa "margen bajo". Ajustable en un solo lugar. */
export const MARGEN_BAJO_PCT = 5;

/** Con este stock o menos (y más de 0) se avisa "poco stock". */
export const STOCK_BAJO = 5;

export type Ganancia = {
  /** precio − costo (puede ser negativo: vender por debajo del costo). */
  ganancia: number;
  /** (precio − costo) / precio × 100, con un decimal. */
  margenPct: number;
};

/**
 * Ganancia unitaria. Devuelve null si falta el precio o el costo (no se puede calcular),
 * para no mostrar un 0 que parezca un dato real.
 */
export function calcularGanancia(
  precio: number | null | undefined,
  costo: number | null | undefined,
): Ganancia | null {
  if (!precio || precio <= 0) return null;
  if (costo === null || costo === undefined || costo < 0) return null;
  const ganancia = precio - costo;
  return { ganancia, margenPct: Math.round((ganancia * 1000) / precio) / 10 };
}

export type EstadoMargen = "sin_dato" | "perdida" | "bajo" | "ok";

/** "perdida" = el precio queda por debajo del costo; "bajo" = gana menos de MARGEN_BAJO_PCT. */
export function estadoMargen(
  precio: number | null | undefined,
  costo: number | null | undefined,
): EstadoMargen {
  const g = calcularGanancia(precio, costo);
  if (!g) return "sin_dato";
  if (g.ganancia < 0) return "perdida";
  if (g.margenPct < MARGEN_BAJO_PCT) return "bajo";
  return "ok";
}

export type EstadoStock = "sin_dato" | "negativo" | "agotado" | "bajo" | "ok";

/** Estado informativo de las existencias. El stock negativo viene del sistema contable. */
export function estadoStock(stock: number | null | undefined): EstadoStock {
  if (stock === null || stock === undefined) return "sin_dato";
  if (stock < 0) return "negativo";
  if (stock === 0) return "agotado";
  if (stock <= STOCK_BAJO) return "bajo";
  return "ok";
}

/** Valor del inventario de una variante: stock × costo. Solo cuenta stock positivo. */
export function valorInventario(
  stock: number | null | undefined,
  costo: number | null | undefined,
): number {
  if (!stock || stock <= 0) return 0;
  if (costo === null || costo === undefined || costo < 0) return 0;
  return stock * costo;
}

/** Ganancia de una línea de pedido: cantidad × (precio cobrado − costo copiado al crearlo). */
export function gananciaLinea(
  cantidad: number,
  precioAplicado: number,
  costo: number | null | undefined,
): number | null {
  if (costo === null || costo === undefined) return null;
  return cantidad * (precioAplicado - costo);
}

/** "14,9 %" (coma decimal, como se escribe en Colombia). */
export function formatPorcentaje(valor: number): string {
  return `${valor.toFixed(1).replace(".", ",")} %`;
}

/** Cantidad de existencias para mostrar: 1.234 (con punto de miles). */
export function formatStock(valor: number): string {
  const signo = valor < 0 ? "-" : "";
  return signo + Math.abs(Math.trunc(valor)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export const ETIQUETA_ESTADO_STOCK: Record<EstadoStock, string> = {
  sin_dato: "Sin dato",
  negativo: "Negativo",
  agotado: "Sin stock",
  bajo: "Poco stock",
  ok: "Disponible",
};
