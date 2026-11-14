/**
 * Comparación de textos sin tildes ni mayúsculas. Lógica PURA, con pruebas.
 * Es la misma regla que usa la base de datos (lower + f_unaccent) para decidir
 * si dos nombres son "el mismo" producto, categoría o marca.
 */
export function normalizarClave(texto: string | null | undefined): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
