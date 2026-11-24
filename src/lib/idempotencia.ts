/**
 * Clave de idempotencia del pedido. Lógica PURA, con pruebas.
 *
 * Problema: si se cae la conexión justo después de que el servidor creó el pedido, la persona no
 * ve la confirmación, vuelve a pulsar «Confirmar» y se crea un SEGUNDO pedido igual.
 * Solución: cada intento de compra lleva una clave única (UUID). Si el mismo carrito se reenvía con
 * la misma clave, la base de datos devuelve el pedido ya creado en vez de crear otro.
 * La clave se renueva cuando el carrito cambia (otro contenido = otro pedido).
 */

export type ClaveGuardada = { clave: string; firma: string };

type LineaFirma = { varianteId: number; cantidad: number };

/** Huella del contenido del carrito: mismas líneas y mismo total → misma firma, sin importar el orden. */
export function firmaDelCarrito(items: readonly LineaFirma[], total: number): string {
  const lineas = [...items]
    .sort((a, b) => a.varianteId - b.varianteId)
    .map((i) => `${i.varianteId}x${i.cantidad}`)
    .join(",");
  return `${lineas}|${total}`;
}

/** Reutiliza la clave guardada si el carrito es el mismo; si no, genera una nueva. */
export function claveParaPedido(
  guardada: ClaveGuardada | null,
  firma: string,
  generar: () => string,
): ClaveGuardada {
  if (guardada && guardada.firma === firma && guardada.clave) return guardada;
  return { clave: generar(), firma };
}

/** Lee lo guardado en el navegador sin confiar en su forma. */
export function leerClaveGuardada(crudo: string | null): ClaveGuardada | null {
  if (!crudo) return null;
  try {
    const v: unknown = JSON.parse(crudo);
    if (
      typeof v === "object" &&
      v !== null &&
      typeof (v as ClaveGuardada).clave === "string" &&
      typeof (v as ClaveGuardada).firma === "string"
    ) {
      return { clave: (v as ClaveGuardada).clave, firma: (v as ClaveGuardada).firma };
    }
  } catch {
    /* JSON dañado: se ignora */
  }
  return null;
}
