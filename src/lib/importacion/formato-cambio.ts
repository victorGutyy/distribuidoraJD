import type { Cambio } from "@/lib/importacion/comparar";
import { formatCOP } from "@/lib/formato";

/**
 * Textos de la vista previa: "Precio unidad: $ 2.500 → $ 2.800". Lógica PURA,
 * con pruebas.
 */

const ETIQUETA_CAMPO: Record<string, string> = {
  producto: "Nombre",
  categoria: "Categoría",
  subcategoria: "Subcategoría",
  marca: "Marca",
  descripcion: "Descripción",
  etiquetas: "Etiquetas",
  "activo (producto)": "Producto activo",
  presentacion: "Presentación",
  contenido_valor: "Contenido",
  contenido_unidad: "Unidad de contenido",
  unidad_venta: "Unidad de venta",
  unidades_por_empaque: "Unidades por empaque",
  precio_unidad: "Precio unidad",
  precio_mayor: "Precio por mayor",
  cantidad_min_mayor: "Mínimo por mayor",
  en_oferta: "En oferta",
  precio_oferta: "Precio de oferta",
  disponible: "Disponible",
  activo: "Activo",
};

export function etiquetaCampo(campo: string): string {
  return ETIQUETA_CAMPO[campo] ?? campo;
}

/** El valor de un campo como lo leería una persona ("sin dato" si está vacío). */
export function textoValor(campo: string, valor: Cambio["antes"]): string {
  if (valor === null || valor === "") return "sin dato";
  if (typeof valor === "boolean") return valor ? "sí" : "no";
  if (typeof valor === "number" && campo.startsWith("precio")) {
    return formatCOP(valor);
  }
  return String(valor);
}

export function textoCambio(c: Cambio): string {
  return `${etiquetaCampo(c.campo)}: ${textoValor(c.campo, c.antes)} → ${textoValor(c.campo, c.despues)}`;
}
