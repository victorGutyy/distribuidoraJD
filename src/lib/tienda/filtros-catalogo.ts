/**
 * Filtros, orden y página del catálogo de la tienda. La URL es la fuente de
 * verdad (/catalogo?cat=granos&marca=la-soberana&page=2), así que se puede
 * compartir el enlace (RF-02). Lógica PURA, con pruebas.
 */

export const POR_PAGINA_CATALOGO = 24;

export const ORDENES_CATALOGO = [
  "relevancia",
  "nombre",
  "precio_asc",
  "precio_desc",
  "recientes",
] as const;
export type OrdenCatalogo = (typeof ORDENES_CATALOGO)[number];

export const ETIQUETA_ORDEN: Record<OrdenCatalogo, string> = {
  relevancia: "Relevancia",
  nombre: "Nombre (A-Z)",
  precio_asc: "Precio: menor a mayor",
  precio_desc: "Precio: mayor a menor",
  recientes: "Más recientes",
};

export type FiltrosCatalogo = {
  q: string;
  /** Slug de una categoría o subcategoría. */
  cat: string | null;
  /** Slugs de marcas. */
  marcas: string[];
  min: number | null;
  max: number | null;
  ofertas: boolean;
  disponibles: boolean;
  orden: OrdenCatalogo;
  pagina: number;
};

type Params = Record<string, string | string[] | undefined>;

const lista = (v: string | string[] | undefined): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];
const primero = (v: string | string[] | undefined): string | undefined => lista(v)[0];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slugValido = (v: string | undefined): string | null =>
  v && v.length <= 80 && SLUG.test(v) ? v : null;

const pesos = (v: string | undefined): number | null => {
  if (!v || !/^\d{1,8}$/.test(v)) return null;
  return Number(v);
};

const entero = (v: string | undefined): number | null => {
  if (!v || !/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n > 0 && n <= 10_000 ? n : null;
};

/** Lee y SANEA los parámetros de la URL: lo desconocido cae al valor por defecto. */
export function leerFiltrosCatalogo(params: Params): FiltrosCatalogo {
  const orden = primero(params.orden);
  const min = pesos(primero(params.min));
  let max = pesos(primero(params.max));
  if (min !== null && max !== null && max < min) max = null;

  // Las marcas pueden venir repetidas (?marca=a&marca=b) o con comas (?marca=a,b).
  const marcas = [
    ...new Set(
      lista(params.marca)
        .flatMap((m) => m.split(","))
        .map((m) => slugValido(m.trim()))
        .filter((m): m is string => m !== null),
    ),
  ].slice(0, 20);

  return {
    q: (primero(params.q) ?? "").trim().replace(/\s+/g, " ").slice(0, 60),
    cat: slugValido(primero(params.cat)),
    marcas,
    min,
    max,
    ofertas: primero(params.ofertas) === "1",
    disponibles: primero(params.disponibles) === "1",
    orden: (ORDENES_CATALOGO as readonly string[]).includes(orden ?? "")
      ? (orden as OrdenCatalogo)
      : "relevancia",
    pagina: entero(primero(params.page)) ?? 1,
  };
}

export type CambiosUrl = Partial<{
  q: string | null;
  cat: string | null;
  marcas: string[];
  min: number | null;
  max: number | null;
  ofertas: boolean;
  disponibles: boolean;
  orden: OrdenCatalogo;
  pagina: number | null;
}>;

/**
 * Arma la URL del catálogo conservando los filtros y cambiando solo `cambios`.
 * Lo que está en su valor por defecto no se escribe (URL corta y limpia). Al
 * cambiar cualquier filtro se vuelve a la página 1, salvo que se indique `pagina`.
 */
export function urlCatalogo(
  filtros: FiltrosCatalogo,
  cambios: CambiosUrl = {},
  base = "/catalogo",
): string {
  const f = { ...filtros, ...cambios };
  const pagina = "pagina" in cambios ? cambios.pagina : null;
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.cat) params.set("cat", f.cat);
  for (const m of f.marcas) params.append("marca", m);
  if (f.min !== null && f.min !== undefined) params.set("min", String(f.min));
  if (f.max !== null && f.max !== undefined) params.set("max", String(f.max));
  if (f.ofertas) params.set("ofertas", "1");
  if (f.disponibles) params.set("disponibles", "1");
  if (f.orden !== "relevancia") params.set("orden", f.orden);
  if (pagina && pagina > 1) params.set("page", String(pagina));
  const texto = params.toString();
  return texto ? `${base}?${texto}` : base;
}

/** ¿Hay algún filtro puesto (sin contar la búsqueda, el orden ni la página)? */
export function hayFiltros(f: FiltrosCatalogo): boolean {
  return (
    f.cat !== null ||
    f.marcas.length > 0 ||
    f.min !== null ||
    f.max !== null ||
    f.ofertas ||
    f.disponibles
  );
}

export type Chip = { clave: string; etiqueta: string; href: string };

/** Chips de los filtros activos; cada uno lleva el enlace que lo quita. */
export function chipsActivos(
  f: FiltrosCatalogo,
  nombres: { categoria?: string | null; marcas: ReadonlyMap<string, string> },
  formatoPesos: (n: number) => string,
): Chip[] {
  const chips: Chip[] = [];
  if (f.cat) {
    chips.push({
      clave: "cat",
      etiqueta: nombres.categoria ?? f.cat,
      href: urlCatalogo(f, { cat: null }),
    });
  }
  for (const m of f.marcas) {
    chips.push({
      clave: `marca-${m}`,
      etiqueta: nombres.marcas.get(m) ?? m,
      href: urlCatalogo(f, { marcas: f.marcas.filter((x) => x !== m) }),
    });
  }
  if (f.min !== null || f.max !== null) {
    const etiqueta =
      f.min !== null && f.max !== null
        ? `${formatoPesos(f.min)} a ${formatoPesos(f.max)}`
        : f.min !== null
          ? `Desde ${formatoPesos(f.min)}`
          : `Hasta ${formatoPesos(f.max as number)}`;
    chips.push({ clave: "precio", etiqueta, href: urlCatalogo(f, { min: null, max: null }) });
  }
  if (f.ofertas) chips.push({ clave: "ofertas", etiqueta: "Solo ofertas", href: urlCatalogo(f, { ofertas: false }) });
  if (f.disponibles)
    chips.push({ clave: "disponibles", etiqueta: "Solo disponibles", href: urlCatalogo(f, { disponibles: false }) });
  return chips;
}

/** Rango de filas (para `.range()`) y total de páginas; la página se acota al total. */
export function rangoCatalogo(pagina: number, total: number, porPagina = POR_PAGINA_CATALOGO) {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const actual = Math.min(Math.max(1, pagina), totalPaginas);
  const desde = (actual - 1) * porPagina;
  return { actual, totalPaginas, desde, hasta: desde + porPagina - 1 };
}
