/**
 * Árbol de categorías de la tienda (2 niveles). Lógica PURA, con pruebas.
 */

export type CategoriaTienda = {
  id: number;
  nombre: string;
  slug: string;
  parent_id: number | null;
  orden: number;
  icono_url: string | null;
};

export type NodoCategoria = { raiz: CategoriaTienda; hijas: CategoriaTienda[] };

/** Raíces con sus hijas, en el orden de la lista recibida. */
export function armarArbol(categorias: readonly CategoriaTienda[]): NodoCategoria[] {
  return categorias
    .filter((c) => c.parent_id === null)
    .map((raiz) => ({
      raiz,
      hijas: categorias.filter((c) => c.parent_id === raiz.id),
    }));
}

export type CategoriaResuelta = {
  /** La categoría pedida, o null si el slug no existe (o no es pública). */
  actual: CategoriaTienda | null;
  /** Su categoría principal (ella misma si ya es principal). */
  raiz: CategoriaTienda | null;
  /** Ids a filtrar: la categoría y, si es principal, todas sus hijas. */
  ids: number[];
};

export function resolverCategoria(
  categorias: readonly CategoriaTienda[],
  slug: string | null,
): CategoriaResuelta {
  const actual = slug ? (categorias.find((c) => c.slug === slug) ?? null) : null;
  if (!actual) return { actual: null, raiz: null, ids: [] };
  const raiz =
    actual.parent_id === null
      ? actual
      : (categorias.find((c) => c.id === actual.parent_id) ?? actual);
  const ids =
    actual.parent_id === null
      ? [actual.id, ...categorias.filter((c) => c.parent_id === actual.id).map((c) => c.id)]
      : [actual.id];
  return { actual, raiz, ids };
}

/**
 * Conteo por categoría con las hijas sumadas a su principal: un producto de
 * "Granos" cuenta en "Granos" y en "Víveres y despensa".
 */
export function conteosAcumulados(
  categorias: readonly CategoriaTienda[],
  directos: ReadonlyMap<number, number>,
): Map<number, number> {
  const total = new Map<number, number>();
  for (const c of categorias) total.set(c.id, directos.get(c.id) ?? 0);
  for (const c of categorias) {
    if (c.parent_id !== null && total.has(c.parent_id)) {
      total.set(c.parent_id, (total.get(c.parent_id) ?? 0) + (directos.get(c.id) ?? 0));
    }
  }
  return total;
}
