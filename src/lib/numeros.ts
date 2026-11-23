/**
 * Lectura de números escritos por una persona en un formulario (formato
 * colombiano). Lógica PURA, con pruebas.
 *
 * Devuelven `null` cuando el texto NO es un número válido. Un texto vacío
 * también devuelve `null`: quien llama debe revisar primero si está vacío.
 */

/**
 * Pesos colombianos ENTEROS (RN-05). Acepta "3200", "3.200", "$ 12.500".
 * El punto solo vale como separador de miles (grupos de 3 dígitos), así que
 * "3.2" o "12,5" NO son válidos: los precios no llevan decimales.
 */
export function parsearPesos(texto: string): number | null {
  const limpio = texto.replace(/[$\s]/g, "");
  if (/^\d+$/.test(limpio) || /^\d{1,3}(\.\d{3})+$/.test(limpio)) {
    return Number(limpio.replace(/\./g, ""));
  }
  return null;
}

/** Entero sin separadores ("12", "0"). No acepta signos ni decimales. */
export function parsearEntero(texto: string): number | null {
  const limpio = texto.trim();
  return /^\d+$/.test(limpio) ? Number(limpio) : null;
}

/**
 * Entero que puede ser NEGATIVO y llevar punto de miles ("-2", "1672", "1.672").
 * Para existencias: el sistema contable del negocio permite saldos negativos.
 * El punto solo vale como separador de miles (grupos de 3 dígitos); no admite decimales.
 */
export function parsearEnteroConSigno(texto: string): number | null {
  const limpio = texto.replace(/\s/g, "");
  const m = /^(-?)(\d+|\d{1,3}(?:\.\d{3})+)$/.exec(limpio);
  if (!m) return null;
  const n = Number(m[2].replace(/\./g, ""));
  return m[1] ? -n : n;
}

/**
 * Decimal positivo con coma o punto ("0,5", "0.5", "250"). Para contenido y
 * medidas (no para precios).
 */
export function parsearDecimal(texto: string): number | null {
  const limpio = texto.trim();
  if (!/^\d+([.,]\d+)?$/.test(limpio)) return null;
  return Number(limpio.replace(",", "."));
}
