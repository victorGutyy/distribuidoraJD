/**
 * Utilidades de formato para la interfaz (textos en español colombiano).
 */

/**
 * Formatea un valor en pesos colombianos: 12500 → "$ 12.500".
 *
 * Los precios son enteros COP (RN-05). Si llega un decimal por error se
 * redondea. Agrupamos los miles "a mano" porque Intl agrupa distinto según
 * el idioma/motor (en es-ES, 1234 se escribe "1234" sin punto).
 */
export function formatCOP(valor: number): string {
  const entero = Math.round(valor);
  const signo = entero < 0 ? "-" : "";
  const miles = Math.abs(entero)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${signo}$ ${miles}`;
}
