import { updateTag } from "next/cache";

/**
 * Vacía la caché de la tienda pública para que los cambios hechos en el panel se
 * vean al instante. Solo se puede llamar desde una Server Action (regla de Next).
 *   "catalogo" → listados, búsqueda, filtros y detalle de producto
 *   "tienda"   → categorías, configuración y datos del encabezado/pie
 */
export function invalidarTienda() {
  updateTag("catalogo");
  updateTag("tienda");
}
