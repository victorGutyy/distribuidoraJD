/**
 * Inventario informativo (RF-32): filtros de la pantalla /admin/inventario y lectura
 * del resumen que devuelve la función SQL `resumen_costos`.
 *
 * Lógica PURA (sin Next ni Supabase) para poder probarla con Vitest.
 */

export const POR_PAGINA_INVENTARIO = 50;

export const FILTROS_ESTADO = [
  "todos",
  "sin_stock",
  "poco",
  "negativo",
  "sin_costo",
  "sin_dato",
] as const;
export type FiltroEstado = (typeof FILTROS_ESTADO)[number];

export const ETIQUETA_FILTRO: Record<FiltroEstado, string> = {
  todos: "Todos",
  sin_stock: "Sin stock",
  poco: "Poco stock",
  negativo: "Stock negativo",
  sin_costo: "Sin costo",
  sin_dato: "Sin dato de stock",
};

export type FiltrosInventario = {
  q: string;
  estado: FiltroEstado;
  pagina: number;
};

type Params = Record<string, string | string[] | undefined>;

const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Lee los filtros de la URL; lo que no se entienda cae en un valor seguro. */
export function leerFiltrosInventario(params: Params): FiltrosInventario {
  const estado = primero(params.estado) ?? "";
  const pagina = Number(primero(params.pagina));
  return {
    q: (primero(params.q) ?? "").trim().slice(0, 60),
    estado: (FILTROS_ESTADO as readonly string[]).includes(estado)
      ? (estado as FiltroEstado)
      : "todos",
    pagina: Number.isInteger(pagina) && pagina >= 1 ? pagina : 1,
  };
}

/** URL de la pantalla conservando los filtros; un valor vacío o por defecto quita el parámetro. */
export function urlInventario(
  filtros: FiltrosInventario,
  cambios: Partial<FiltrosInventario> = {},
): string {
  const f = { ...filtros, ...cambios };
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.estado !== "todos") params.set("estado", f.estado);
  if (f.pagina > 1) params.set("pagina", String(f.pagina));
  const texto = params.toString();
  return texto ? `/admin/inventario?${texto}` : "/admin/inventario";
}

/** Primer día del mes (hora de Colombia) de una fecha "2026-11-23" → "2026-11-01T00:00:00-05:00". */
export function inicioDelMes(hoy: string): string {
  return `${hoy.slice(0, 7)}-01T00:00:00-05:00`;
}

export type ResumenCostos = {
  pedidos: {
    cantidad: number;
    venta: number;
    ganancia: number;
    ventaConCosto: number;
    lineasSinCosto: number;
  };
  inventario: {
    valor: number;
    conStock: number;
    sinStock: number;
    negativos: number;
    sinCosto: number;
  };
};

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const obj = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Convierte lo que devuelve `resumen_costos` (JSON) en un objeto bien tipado. */
export function leerResumenCostos(data: unknown): ResumenCostos {
  const raiz = obj(data);
  const p = obj(raiz.pedidos);
  const i = obj(raiz.inventario);
  return {
    pedidos: {
      cantidad: num(p.pedidos),
      venta: num(p.venta),
      ganancia: num(p.ganancia),
      ventaConCosto: num(p.venta_con_costo),
      lineasSinCosto: num(p.lineas_sin_costo),
    },
    inventario: {
      valor: num(i.valor_inventario),
      conStock: num(i.con_stock),
      sinStock: num(i.sin_stock),
      negativos: num(i.negativos),
      sinCosto: num(i.sin_costo),
    },
  };
}
