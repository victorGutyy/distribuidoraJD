/**
 * Datos del último pedido y del cliente, guardados en el NAVEGADOR de quien lo hizo.
 * La pantalla de confirmación sale de aquí y no de la base de datos: así el número
 * de pedido (consecutivo, adivinable) no sirve para ver los datos de otras personas.
 * Lógica PURA, con pruebas.
 */

export type PedidoConfirmado = {
  numero: string;
  /** Texto listo para enviar por WhatsApp (formato de RF-10). */
  mensaje: string;
  /** "jueves 12 de noviembre", o null si no se pudo calcular. */
  fechaTexto: string | null;
  lugar: string;
  clienteNombre: string;
  subtotal: number;
  descuentoMayor: number;
  costoEnvio: number;
  total: number;
  lineas: { nombre: string; presentacion: string | null; cantidad: number; subtotal: number }[];
};

export const CLAVE_ULTIMO_PEDIDO = "ev-ultimo-pedido";
export const CLAVE_CLIENTE = "ev-cliente";

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const texto = (v: unknown, max: number): string | null =>
  typeof v === "string" ? v.slice(0, max) : null;
const entero = (v: unknown): number | null =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null;

/** Lee el último pedido guardado; null si no hay o está dañado. */
export function leerUltimoPedido(crudo: string | null): PedidoConfirmado | null {
  if (!crudo) return null;
  let v: unknown;
  try {
    v = JSON.parse(crudo);
  } catch {
    return null;
  }
  if (!esObjeto(v) || !Array.isArray(v.lineas)) return null;
  const numero = texto(v.numero, 20);
  const mensaje = texto(v.mensaje, 4000);
  const lugar = texto(v.lugar, 200);
  const clienteNombre = texto(v.clienteNombre, 100);
  const subtotal = entero(v.subtotal);
  const descuentoMayor = entero(v.descuentoMayor);
  const costoEnvio = entero(v.costoEnvio);
  const total = entero(v.total);
  if (
    !numero || !/^[A-Z]{2}-\d{6}$/.test(numero) || !mensaje || !lugar || !clienteNombre ||
    subtotal === null || descuentoMayor === null || costoEnvio === null || total === null
  ) {
    return null;
  }
  const lineas = v.lineas.flatMap((l) => {
    if (!esObjeto(l)) return [];
    const nombre = texto(l.nombre, 120);
    const cantidad = entero(l.cantidad);
    const sub = entero(l.subtotal);
    return nombre && cantidad !== null && sub !== null
      ? [{ nombre, presentacion: texto(l.presentacion, 80), cantidad, subtotal: sub }]
      : [];
  });
  return {
    numero, mensaje, lugar, clienteNombre, subtotal, descuentoMayor, costoEnvio, total, lineas,
    fechaTexto: texto(v.fechaTexto, 80),
  };
}

/** Datos del cliente para no volver a escribirlos en el próximo pedido (solo en este navegador). */
export type ClienteGuardado = {
  nombre: string;
  celular: string;
  nombre_negocio: string;
  documento: string;
  direccion: string;
  referencia: string;
};

export function leerClienteGuardado(crudo: string | null): ClienteGuardado | null {
  if (!crudo) return null;
  let v: unknown;
  try {
    v = JSON.parse(crudo);
  } catch {
    return null;
  }
  if (!esObjeto(v)) return null;
  const nombre = texto(v.nombre, 80);
  const celular = texto(v.celular, 15);
  if (!nombre || !celular) return null;
  return {
    nombre,
    celular,
    nombre_negocio: texto(v.nombre_negocio, 80) ?? "",
    documento: texto(v.documento, 20) ?? "",
    direccion: texto(v.direccion, 150) ?? "",
    referencia: texto(v.referencia, 120) ?? "",
  };
}
