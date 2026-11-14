/**
 * Enlaces de WhatsApp (wa.me). Lógica PURA, con pruebas.
 * El armado del mensaje del pedido (RF-10) se agrega aquí en la fase F5.
 */

/**
 * Deja el número en formato internacional para wa.me: "57" + 10 dígitos.
 * Acepta "310 123 4567", "+57 310 123 4567" o "573101234567". Devuelve null si
 * no parece un celular colombiano (10 dígitos que empiezan por 3).
 */
export function normalizarCelularWhatsApp(valor: unknown): string | null {
  if (typeof valor !== "string" && typeof valor !== "number") return null;
  const digitos = String(valor).replace(/\D/g, "");
  if (/^3\d{9}$/.test(digitos)) return `57${digitos}`;
  if (/^573\d{9}$/.test(digitos)) return digitos;
  return null;
}

/** https://wa.me/573101234567?text=Hola%20… (el texto va codificado). */
export function enlaceWhatsApp(numero: string, texto?: string): string {
  const base = `https://wa.me/${numero}`;
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}
