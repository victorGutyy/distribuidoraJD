/**
 * Filtros, orden y paginación de la lista de productos del panel. La URL es la
 * fuente de verdad (/admin/productos?q=lenteja&estado=borrador&pagina=2), así
 * que se puede compartir el enlace. Lógica PURA, con pruebas.
 */

export const POR_PAGINA = 25;

export const ESTADOS = ["todos", "borrador", "activo", "inactivo"] as const;
export type EstadoFiltro = (typeof ESTADOS)[number];

export const ORDENES = [
  "recientes",
  "nombre",
  "precio_asc",
  "precio_desc",
] as const;
export type OrdenProductos = (typeof ORDENES)[number];

export type FiltrosProductos = {
  q: string;
  categoria: number | null;
  marca: number | null;
  estado: EstadoFiltro;
  sinPrecio: boolean;
  sinImagen: boolean;
  orden: OrdenProductos;
  pagina: number;
};

type Params = Record<string, string | string[] | undefined>;

const primero = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const enteroPositivo = (v: string | undefined): number | null => {
  if (!v || !/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n > 0 ? n : null;
};

/** Lee y SANEA los parámetros de la URL: lo desconocido cae al valor por defecto. */
export function leerFiltros(params: Params): FiltrosProductos {
  const estado = primero(params.estado);
  const orden = primero(params.orden);
  return {
    q: (primero(params.q) ?? "").trim().slice(0, 60),
    categoria: enteroPositivo(primero(params.categoria)),
    marca: enteroPositivo(primero(params.marca)),
    estado: (ESTADOS as readonly string[]).includes(estado ?? "")
      ? (estado as EstadoFiltro)
      : "todos",
    sinPrecio: primero(params.sin_precio) === "1",
    sinImagen: primero(params.sin_imagen) === "1",
    orden: (ORDENES as readonly string[]).includes(orden ?? "")
      ? (orden as OrdenProductos)
      : "recientes",
    pagina: enteroPositivo(primero(params.pagina)) ?? 1,
  };
}

/**
 * Prepara el texto de búsqueda para un ILIKE sobre `texto_busqueda` (que ya está
 * en minúsculas y sin tildes): quita tildes y mayúsculas y escapa los comodines
 * de LIKE (% _ \) para que se busquen como texto literal.
 */
export function normalizarBusqueda(q: string): string {
  return q
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .slice(0, 60)
    .replace(/[\\%_]/g, "\\$&");
}

/** Rango de filas (para `.range()`) y total de páginas. La página se acota al total. */
export function rangoPagina(
  pagina: number,
  total: number,
  porPagina = POR_PAGINA,
) {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const actual = Math.min(Math.max(1, pagina), totalPaginas);
  const desde = (actual - 1) * porPagina;
  return { actual, totalPaginas, desde, hasta: desde + porPagina - 1 };
}

/**
 * Arma una URL de la lista conservando los filtros y cambiando solo `cambios`
 * (p. ej. la página). Un valor vacío o null quita ese parámetro.
 */
export function urlLista(
  base: string,
  filtros: FiltrosProductos,
  cambios: Partial<Record<string, string | number | null>> = {},
): string {
  const params = new URLSearchParams();
  const actual: Record<string, string | number | null> = {
    q: filtros.q || null,
    categoria: filtros.categoria,
    marca: filtros.marca,
    estado: filtros.estado === "todos" ? null : filtros.estado,
    sin_precio: filtros.sinPrecio ? "1" : null,
    sin_imagen: filtros.sinImagen ? "1" : null,
    orden: filtros.orden === "recientes" ? null : filtros.orden,
    pagina: filtros.pagina > 1 ? filtros.pagina : null,
    ...cambios,
  };
  for (const [clave, valor] of Object.entries(actual)) {
    if (valor !== null && valor !== "") params.set(clave, String(valor));
  }
  const texto = params.toString();
  return texto ? `${base}?${texto}` : base;
}
