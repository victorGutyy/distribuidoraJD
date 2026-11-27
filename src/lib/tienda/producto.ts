import type { DatosItem } from "@/lib/carrito";
import type { Tables } from "@/types/database.types";

/**
 * Datos de una presentación listos para pintar en el detalle de producto
 * (RF-06). Lógica PURA, con pruebas. Aquí solo se MUESTRAN los precios
 * guardados; lo que realmente se cobra (ofertas y descuento por monto) lo calcula
 * lib/precios.ts, en el carrito y en el servidor (RN-02 a RN-06).
 */

export type VarianteDetalle = Pick<
  Tables<"variantes">,
  | "id"
  | "sku"
  | "nombre_presentacion"
  | "contenido_valor"
  | "contenido_unidad"
  | "unidad_venta"
  | "unidades_por_empaque"
  | "peso_g"
  | "alto_cm"
  | "ancho_cm"
  | "largo_cm"
  | "precio_unidad"
  | "en_oferta"
  | "precio_oferta"
  | "disponible"
>;

export type PresentacionVista = {
  id: number;
  sku: string;
  /** "500 g", "Caja x 24"… lo que identifica a la presentación. */
  etiqueta: string;
  /** Cómo se despacha: "Individual", "Paquete x 12". */
  venta: string;
  /** Precio normal por unidad (sin oferta). */
  precioUnidad: number;
  /** Precio de oferta, si la oferta está activa y es menor al normal. */
  precioOferta: number | null;
  disponible: boolean;
  peso: string | null;
  medidas: string | null;
};

/** 1234.5 → "1.234,5" (formato colombiano, sin ceros sobrantes). */
export function numeroEs(n: number): string {
  const [entera, decimal] = String(Math.round(n * 100) / 100).split(".");
  const miles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimal ? `${miles},${decimal}` : miles;
}

const ETIQUETA_VENTA: Record<string, string> = {
  individual: "Individual",
  paquete: "Paquete",
  display: "Display",
  caja: "Caja",
  bolsa: "Bolsa",
};

/** ("paquete", 12) → "Paquete x 12"; ("individual", 1) → "Individual". */
export function etiquetaVenta(unidad: string, unidadesPorEmpaque: number): string {
  const base =
    ETIQUETA_VENTA[unidad] ?? (unidad ? unidad.charAt(0).toUpperCase() + unidad.slice(1) : "Individual");
  return unidadesPorEmpaque > 1 ? `${base} x ${unidadesPorEmpaque}` : base;
}

/** Nombre de la presentación; si no tiene, se arma con el contenido ("500 g"). */
export function etiquetaPresentacion(v: VarianteDetalle): string {
  const nombre = v.nombre_presentacion?.trim();
  if (nombre) return nombre;
  if (v.contenido_valor !== null) {
    return `${numeroEs(v.contenido_valor)}${v.contenido_unidad ? ` ${v.contenido_unidad}` : ""}`;
  }
  return etiquetaVenta(v.unidad_venta, v.unidades_por_empaque);
}

/** 500 → "500 g"; 1200 → "1,2 kg". */
export function formatoPeso(gramos: number | null): string | null {
  if (gramos === null || gramos <= 0) return null;
  return gramos >= 1000 ? `${numeroEs(gramos / 1000)} kg` : `${numeroEs(gramos)} g`;
}

/** (10, 5, 3) → "10 × 5 × 3 cm". Si falta algún dato no se muestra. */
export function formatoMedidas(
  alto: number | null,
  ancho: number | null,
  largo: number | null,
): string | null {
  const partes = [largo, ancho, alto];
  if (partes.some((p) => p === null || p <= 0)) return null;
  return `${partes.map((p) => numeroEs(p as number)).join(" × ")} cm`;
}

/** Null si la presentación no tiene precio (no se muestra al público). */
export function aPresentacion(v: VarianteDetalle): PresentacionVista | null {
  if (v.precio_unidad === null || v.precio_unidad <= 0) return null;
  const oferta =
    v.en_oferta &&
    v.precio_oferta !== null &&
    v.precio_oferta > 0 &&
    v.precio_oferta < v.precio_unidad
      ? v.precio_oferta
      : null;
  return {
    id: v.id,
    sku: v.sku,
    etiqueta: etiquetaPresentacion(v),
    venta: etiquetaVenta(v.unidad_venta, v.unidades_por_empaque),
    precioUnidad: v.precio_unidad,
    precioOferta: oferta,
    disponible: v.disponible,
    peso: formatoPeso(v.peso_g),
    medidas: formatoMedidas(v.alto_cm, v.ancho_cm, v.largo_cm),
  };
}

export type PrecioMostrado = {
  precio: number;
  tipo: "unidad" | "oferta";
};

/**
 * Precio que se muestra para una presentación: el de oferta si la hay, si no el normal.
 * El descuento por monto de la compra (lib/precios.ts) se aplica en el carrito, no aquí.
 */
export function precioMostrado(p: PresentacionVista): PrecioMostrado {
  return p.precioOferta !== null && p.precioOferta < p.precioUnidad
    ? { precio: p.precioOferta, tipo: "oferta" }
    : { precio: p.precioUnidad, tipo: "unidad" };
}

/** Descripción corta para los buscadores y al compartir el enlace (máx. ~155 caracteres). */
export function descripcionMeta(
  nombre: string,
  marca: string | null,
  descripcion: string | null,
): string {
  const texto = descripcion?.replace(/\s+/g, " ").trim();
  if (texto) return texto.length > 155 ? `${texto.slice(0, 152).trimEnd()}…` : texto;
  return `${nombre}${marca ? ` de ${marca}` : ""}: compra en EV Distribuidora y paga contraentrega.`;
}

/** Datos estructurados (schema.org/Product) para los buscadores. */
export function jsonLdProducto(datos: {
  nombre: string;
  descripcion: string;
  marca: string | null;
  sku: string | null;
  imagenes: string[];
  precio: number;
  disponible: boolean;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: datos.nombre,
    description: datos.descripcion,
    ...(datos.imagenes.length > 0 ? { image: datos.imagenes } : {}),
    ...(datos.sku ? { sku: datos.sku } : {}),
    ...(datos.marca ? { brand: { "@type": "Brand", name: datos.marca } } : {}),
    offers: {
      "@type": "Offer",
      url: datos.url,
      priceCurrency: "COP",
      price: datos.precio,
      availability: datos.disponible
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };
}

/** Lo que se guarda en el carrito al agregar una presentación desde el detalle del producto. */
export function aDatosItem(
  p: PresentacionVista,
  producto: { nombre: string; slug: string; imagen: string | null },
): DatosItem {
  return {
    varianteId: p.id,
    productoSlug: producto.slug,
    nombre: producto.nombre,
    presentacion: p.etiqueta,
    imagen: producto.imagen,
    precio: {
      precioUnidad: p.precioUnidad,
      enOferta: p.precioOferta !== null,
      precioOferta: p.precioOferta,
    },
    disponible: p.disponible,
  };
}
