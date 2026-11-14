/**
 * Reordenar elementos con los botones ↑ ↓ (RF-22). Lógica PURA, con pruebas.
 */

export type ItemOrdenable = { id: number; orden: number };

/**
 * Mueve el elemento `id` una posición hacia arriba o hacia abajo dentro de su
 * grupo (los hermanos de un mismo nivel) y devuelve SOLO los cambios de `orden`
 * que hay que guardar, ya renumerados 1..n.
 *
 * Renumerar todo el grupo evita problemas cuando varios elementos tienen el
 * mismo `orden` (por ejemplo los que se importan en bloque).
 * Si el elemento no existe o ya está en el extremo, devuelve [].
 */
export function reordenar(
  hermanos: readonly ItemOrdenable[],
  id: number,
  direccion: "arriba" | "abajo",
): ItemOrdenable[] {
  // Orden estable: primero por `orden` y, a igualdad, por id.
  const lista = [...hermanos].sort((a, b) => a.orden - b.orden || a.id - b.id);
  const indice = lista.findIndex((h) => h.id === id);
  if (indice === -1) return [];

  const destino = direccion === "arriba" ? indice - 1 : indice + 1;
  if (destino < 0 || destino >= lista.length) return [];

  [lista[indice], lista[destino]] = [lista[destino], lista[indice]];

  const cambios: ItemOrdenable[] = [];
  lista.forEach((item, i) => {
    const nuevoOrden = i + 1;
    const original = hermanos.find((h) => h.id === item.id);
    if (original?.orden !== nuevoOrden) {
      cambios.push({ id: item.id, orden: nuevoOrden });
    }
  });
  return cambios;
}
