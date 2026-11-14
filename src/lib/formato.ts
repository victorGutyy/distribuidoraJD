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

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

/** Instante (texto ISO de la base) → "14 nov 2026, 3:05 p. m." en hora de Bogotá. */
export function formatFechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : FORMATO_FECHA_HORA.format(d);
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** "2026-11-19" → "jue 19 nov 2026" (una fecha sin hora, sin cambios de zona horaria). */
export function formatFechaDia(fecha: string | null | undefined): string {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return "—";
  const [a, m, d] = fecha.split("-").map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return `${DIAS_CORTOS[dia]} ${d} ${MESES_CORTOS[m - 1]} ${a}`;
}
