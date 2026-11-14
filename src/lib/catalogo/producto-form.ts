import type { Tables } from "@/types/database.types";
import type {
  ProductoFormValues,
  ProductoValidado,
  VarianteFormValues,
} from "@/lib/validaciones/producto";

/**
 * Conversiones entre la base de datos, el formulario y la función SQL
 * `guardar_producto`. Lógica PURA, con pruebas.
 */

export const UNIDADES_VENTA = [
  { valor: "individual", etiqueta: "Individual" },
  { valor: "paquete", etiqueta: "Paquete" },
  { valor: "display", etiqueta: "Display" },
  { valor: "caja", etiqueta: "Caja" },
  { valor: "bolsa", etiqueta: "Bolsa" },
] as const;

export const UNIDADES_CONTENIDO = [
  "g",
  "kg",
  "ml",
  "L",
  "und",
  "tabletas",
  "cm",
  "m",
] as const;

/** Una presentación en blanco, con los valores por defecto del formulario. */
export function varianteVacia(): VarianteFormValues {
  return {
    id: "",
    sku: "",
    nombre_presentacion: "",
    contenido_valor: "",
    contenido_unidad: "",
    unidad_venta: "individual",
    unidades_por_empaque: "1",
    peso_g: "",
    alto_cm: "",
    ancho_cm: "",
    largo_cm: "",
    precio_unidad: "",
    precio_mayor: "",
    cantidad_min_mayor: "",
    en_oferta: false,
    precio_oferta: "",
    disponible: true,
    activo: true,
  };
}

/** Un producto nuevo: activo y con una presentación en blanco. */
export function productoVacio(): ProductoFormValues {
  return {
    id: "",
    nombre: "",
    descripcion: "",
    categoria_id: "",
    marca_id: "",
    etiquetas: "",
    destacado: false,
    es_nuevo: false,
    activo: true,
    variantes: [varianteVacia()],
  };
}

const texto = (v: string | number | null | undefined): string =>
  v === null || v === undefined ? "" : String(v);

/** Convierte lo guardado en la base a los valores (texto) del formulario. */
export function valoresDesdeBD(
  producto: Pick<
    Tables<"productos">,
    | "id"
    | "nombre"
    | "descripcion"
    | "categoria_id"
    | "marca_id"
    | "etiquetas"
    | "destacado"
    | "es_nuevo"
    | "activo"
  >,
  variantes: Tables<"variantes">[],
): ProductoFormValues {
  const ordenadas = [...variantes].sort(
    (a, b) => a.orden - b.orden || a.id - b.id,
  );
  return {
    id: String(producto.id),
    nombre: producto.nombre,
    descripcion: texto(producto.descripcion),
    categoria_id: String(producto.categoria_id),
    marca_id: texto(producto.marca_id),
    etiquetas: producto.etiquetas.join(", "),
    destacado: producto.destacado,
    es_nuevo: producto.es_nuevo,
    activo: producto.activo,
    variantes: ordenadas.map((v) => ({
      id: String(v.id),
      sku: v.sku,
      nombre_presentacion: texto(v.nombre_presentacion),
      contenido_valor: texto(v.contenido_valor),
      contenido_unidad: texto(v.contenido_unidad),
      unidad_venta: v.unidad_venta,
      unidades_por_empaque: String(v.unidades_por_empaque),
      peso_g: texto(v.peso_g),
      alto_cm: texto(v.alto_cm),
      ancho_cm: texto(v.ancho_cm),
      largo_cm: texto(v.largo_cm),
      precio_unidad: texto(v.precio_unidad),
      precio_mayor: texto(v.precio_mayor),
      cantidad_min_mayor: texto(v.cantidad_min_mayor),
      en_oferta: v.en_oferta,
      precio_oferta: texto(v.precio_oferta),
      disponible: v.disponible,
      activo: v.activo,
    })),
  };
}

/**
 * Arma los dos argumentos de la función SQL `guardar_producto` a partir de un
 * producto ya validado. `slug` solo se envía al crear (al editar no cambia).
 */
export function armarPayload(p: ProductoValidado, slug?: string) {
  const producto = {
    id: p.id === "" ? null : Number(p.id),
    nombre: p.nombre,
    slug: slug ?? null,
    descripcion: p.descripcion,
    categoria_id: p.categoria_id,
    marca_id: p.marca_id,
    etiquetas: p.etiquetas,
    destacado: p.destacado,
    es_nuevo: p.es_nuevo,
    activo: p.activo,
  };
  const variantes = p.variantes.map((v) => ({
    id: v.id === "" ? null : Number(v.id),
    sku: v.sku === "" ? null : v.sku,
    nombre_presentacion: v.nombre_presentacion,
    contenido_valor: v.contenido_valor,
    contenido_unidad: v.contenido_unidad,
    unidad_venta: v.unidad_venta,
    unidades_por_empaque: v.unidades_por_empaque,
    peso_g: v.peso_g,
    alto_cm: v.alto_cm,
    ancho_cm: v.ancho_cm,
    largo_cm: v.largo_cm,
    precio_unidad: v.precio_unidad,
    precio_mayor: v.precio_mayor,
    cantidad_min_mayor: v.cantidad_min_mayor,
    en_oferta: v.en_oferta,
    precio_oferta: v.precio_oferta,
    disponible: v.disponible,
    activo: v.activo,
  }));
  return { p_producto: producto, p_variantes: variantes };
}
