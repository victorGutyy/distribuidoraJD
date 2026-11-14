/**
 * Slugs: la versión del nombre que va en la URL ("Lentejas Doña Lupe" →
 * "lentejas-dona-lupe"). Lógica PURA, con pruebas.
 */

/** Convierte un texto en un slug: sin tildes ni ñ, en minúsculas y con guiones. */
export function slugify(texto: string, maxLargo = 80): string {
  const base = texto
    .normalize("NFD")
    // Quita las marcas de acento que separó NFD (á → a, ñ → n).
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    // Todo lo que no sea letra o número pasa a ser un guion.
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Se corta y se vuelve a limpiar un posible guion que haya quedado al final.
  return base.slice(0, maxLargo).replace(/-+$/g, "");
}

/**
 * Devuelve `base` si está libre; si no, `base-2`, `base-3`… hasta encontrar uno
 * que no esté en `existentes`. Si el nombre no produce ningún carácter válido
 * (p. ej. "¡¡¡"), usa "sin-nombre" como base.
 */
export function slugUnico(
  base: string,
  existentes: ReadonlySet<string> | readonly string[],
): string {
  const ocupados =
    existentes instanceof Set ? existentes : new Set<string>(existentes);
  const raiz = base || "sin-nombre";
  if (!ocupados.has(raiz)) return raiz;
  let n = 2;
  while (ocupados.has(`${raiz}-${n}`)) n++;
  return `${raiz}-${n}`;
}
