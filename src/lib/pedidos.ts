import type { Rol } from "@/lib/permisos";

/**
 * Estados de un pedido y quién puede hacer qué (RF-27). Lógica PURA, con pruebas.
 * Refleja las reglas de la función SQL cambiar_estado_pedido: aquí se decide qué
 * botones MOSTRAR; la base de datos es la que de verdad lo impide.
 */

export const ESTADOS_PEDIDO = [
  "nuevo",
  "confirmado",
  "en_preparacion",
  "despachado",
  "entregado",
  "cancelado",
] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export const ETIQUETA_ESTADO: Record<EstadoPedido, string> = {
  nuevo: "Nuevo",
  confirmado: "Confirmado",
  en_preparacion: "En preparación",
  despachado: "Despachado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export function esEstadoPedido(v: unknown): v is EstadoPedido {
  return typeof v === "string" && (ESTADOS_PEDIDO as readonly string[]).includes(v);
}

const SIGUIENTE: Partial<Record<EstadoPedido, EstadoPedido>> = {
  nuevo: "confirmado",
  confirmado: "en_preparacion",
  en_preparacion: "despachado",
  despachado: "entregado",
};

/** Verbo del botón que avanza el pedido ("Confirmar", "Empezar a preparar"…). */
export const ACCION_AVANZAR: Partial<Record<EstadoPedido, string>> = {
  nuevo: "Confirmar pedido",
  confirmado: "Pasar a preparación",
  en_preparacion: "Marcar como despachado",
  despachado: "Marcar como entregado",
};

export function siguienteEstado(estado: EstadoPedido): EstadoPedido | null {
  return SIGUIENTE[estado] ?? null;
}

/** Se puede cancelar hasta antes de entregarse (entregado y cancelado son finales). Con motivo. */
export function puedeCancelarse(estado: EstadoPedido): boolean {
  return estado === "nuevo" || estado === "confirmado" || estado === "en_preparacion" || estado === "despachado";
}

/** Un pedido despachado que no se entregó (cliente ausente, rechazó…) vuelve a «confirmado» para reprogramarse. */
export function puedeMarcarNoEntregado(estado: EstadoPedido): boolean {
  return estado === "despachado";
}

/** Se puede mover la fecha o corregir la dirección mientras el pedido no haya salido a reparto. */
export function puedeReprogramar(estado: EstadoPedido): boolean {
  return estado === "nuevo" || estado === "confirmado" || estado === "en_preparacion";
}

/**
 * Avanzar a «despachado» o «entregado» no tiene vuelta atrás: se pide confirmar antes
 * (un toque equivocado en el celular marcaba como entregado un pedido que aún iba en camino).
 */
export function requiereConfirmacion(destino: EstadoPedido): boolean {
  return destino === "despachado" || destino === "entregado";
}

/** Los productos solo se editan mientras el pedido está nuevo o confirmado. */
export function esEditable(estado: EstadoPedido): boolean {
  return estado === "nuevo" || estado === "confirmado";
}

export function esFinal(estado: EstadoPedido): boolean {
  return estado === "entregado" || estado === "cancelado";
}

/**
 * ¿Este usuario puede cambiar el estado de este pedido? El admin, en cualquiera; el
 * vendedor, solo en pedidos de SUS sectores; el editor solo mira (matriz de permisos §6).
 */
export function puedeCambiarEstado(
  rol: Rol,
  sectorDelPedido: number | null,
  sectoresAsignados: readonly number[],
): boolean {
  if (rol === "admin") return true;
  if (rol === "vendedor") return sectorDelPedido !== null && sectoresAsignados.includes(sectorDelPedido);
  return false;
}

/** Editar cantidades o quitar ítems: solo el admin y solo en pedidos editables. */
export function puedeEditarItems(rol: Rol, estado: EstadoPedido): boolean {
  return rol === "admin" && esEditable(estado);
}

/** Estados que cuentan como "pendientes" en el dashboard (incluye el que va en reparto). */
export const ESTADOS_PENDIENTES: readonly EstadoPedido[] = ["nuevo", "confirmado", "en_preparacion", "despachado"];

/** Estados de un pedido que aún no se resolvió: si su fecha ya pasó, está atrasado. */
export const ESTADOS_ABIERTOS: readonly EstadoPedido[] = ESTADOS_PENDIENTES;

/**
 * Enlace para escribirle al cliente por WhatsApp. El celular guardado tiene 10
 * dígitos (empieza por 3): se le antepone 57.
 */
export function celularParaWhatsApp(celular: string): string | null {
  const digitos = celular.replace(/\D/g, "");
  return /^3\d{9}$/.test(digitos) ? `57${digitos}` : null;
}
