/**
 * Ayudantes de categorías para los selectores del panel. Lógica PURA, con pruebas.
 */

export type CategoriaPlana = {
  id: number;
  nombre: string;
  parent_id: number | null;
  orden: number;
};

export type OpcionCategoria = { valor: string; etiqueta: string };

/**
 * Lista plana para un <select>: cada categoría principal seguida de sus
 * subcategorías con la etiqueta "Principal › Sub". Respeta el orden definido en
 * el panel (orden y luego nombre).
 */
export function opcionesCategoria(
  categorias: readonly CategoriaPlana[],
): OpcionCategoria[] {
  const porOrden = (a: CategoriaPlana, b: CategoriaPlana) =>
    a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es");

  const principales = categorias
    .filter((c) => c.parent_id === null)
    .sort(porOrden);
  const opciones: OpcionCategoria[] = [];

  for (const principal of principales) {
    opciones.push({ valor: String(principal.id), etiqueta: principal.nombre });
    const hijas = categorias
      .filter((c) => c.parent_id === principal.id)
      .sort(porOrden);
    for (const hija of hijas) {
      opciones.push({
        valor: String(hija.id),
        etiqueta: `${principal.nombre} › ${hija.nombre}`,
      });
    }
  }
  return opciones;
}

/**
 * Ids que cubre un filtro por categoría: la propia y, si es principal, también
 * todas sus subcategorías.
 */
export function idsConHijas(
  categorias: readonly CategoriaPlana[],
  id: number,
): number[] {
  return [id, ...categorias.filter((c) => c.parent_id === id).map((c) => c.id)];
}
