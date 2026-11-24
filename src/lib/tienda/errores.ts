/**
 * Errores de lectura de la tienda. Lógica PURA, con pruebas.
 *
 * Las lecturas públicas van dentro de funciones con "use cache". Si una consulta falla
 * (un tiempo de espera, la base pausada) y la función DEVUELVE un resultado vacío, ese vacío
 * se guarda en la caché y la tienda muestra «0 productos» hasta que vence. Por eso un fallo de
 * la base se LANZA: lo que lanza una función con caché no se guarda, y la persona ve la pantalla
 * de error con el botón «Reintentar».
 */

type ErrorSupabase = { code?: string; message?: string } | null | undefined;

/** Lanza si la consulta falló. `contexto` dice qué se estaba leyendo (queda en los registros del servidor). */
export function exigir(error: ErrorSupabase, contexto: string): void {
  if (!error) return;
  throw new Error(`Falló la lectura de ${contexto}${error.code ? ` (${error.code})` : ""}: ${error.message ?? "sin detalle"}`);
}

/** PostgREST responde PGRST103 cuando el rango pedido empieza después del último resultado. */
export function esRangoVacio(error: ErrorSupabase): boolean {
  return error?.code === "PGRST103";
}
