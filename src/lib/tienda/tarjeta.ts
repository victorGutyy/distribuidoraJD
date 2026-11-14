import type { DatosItem } from "@/lib/carrito";
import type { Tables } from "@/types/database.types";

/**
 * Datos listos para pintar una tarjeta de producto (RF-03). Lógica PURA, con
 * pruebas. Aquí solo se MUESTRAN los precios guardados; el cálculo de lo que se
 * cobra de verdad (mayoreo, ofertas, RN-02 a RN-06) es de la fase F5.
 */

export type FilaTienda = Tables<"v_tienda_productos">;

export type ProductoTarjeta = {
  id: number;
  nombre: string;
  slug: string;
  marca: string | null;
  categoria: string | null;
  imagen: string | null;
  presentacion: string | null;
  /** Precio que se muestra en grande (el de oferta, si la hay). */
  precio: number;
  /** Precio normal tachado cuando hay oferta. */
  precioAntes: number | null;
  /** "Por mayor: $X desde N und." (desde = null si no hay cantidad mínima). */
  mayor: { precio: number; desde: number | null } | null;
  /** El producto tiene más presentaciones además de la que se muestra. */
  masPresentaciones: boolean;
  esOferta: boolean;
  esNuevo: boolean;
  agotado: boolean;
  /** Lo que se guarda en el carrito al agregar la presentación principal. */
  item: DatosItem | null;
};

/** Convierte una fila de v_tienda_productos; null si le faltan datos básicos. */
export function aTarjeta(f: FilaTienda): ProductoTarjeta | null {
  if (f.id === null || f.nombre === null || f.slug === null) return null;
  if (f.precio_principal === null || f.precio_principal <= 0) return null;

  const ofertaValida =
    f.en_oferta_principal === true &&
    f.precio_oferta_principal !== null &&
    f.precio_oferta_principal > 0 &&
    f.precio_oferta_principal < f.precio_principal;

  const mayorValido =
    f.precio_mayor_principal !== null &&
    f.precio_mayor_principal > 0 &&
    f.precio_mayor_principal < f.precio_principal &&
    // Si la oferta ya es igual o más barata, el "por mayor" confundiría (RN-04: gana el menor).
    !(ofertaValida && (f.precio_oferta_principal as number) <= f.precio_mayor_principal);

  return {
    id: f.id,
    nombre: f.nombre,
    slug: f.slug,
    marca: f.marca_nombre,
    categoria: f.categoria_nombre,
    imagen: f.imagen_miniatura_url ?? f.imagen_url,
    presentacion: f.presentacion_principal,
    precio: ofertaValida ? (f.precio_oferta_principal as number) : f.precio_principal,
    precioAntes: ofertaValida ? f.precio_principal : null,
    mayor: mayorValido
      ? {
          precio: f.precio_mayor_principal as number,
          desde: f.cantidad_min_mayor_principal,
        }
      : null,
    masPresentaciones: (f.variantes_visibles ?? 1) > 1,
    esOferta: ofertaValida || f.hay_oferta === true,
    esNuevo: f.es_nuevo === true,
    // Agotado = ninguna presentación visible está disponible.
    agotado: f.disponible === false,
    item:
      f.variante_principal_id !== null
        ? {
            varianteId: f.variante_principal_id,
            productoSlug: f.slug,
            nombre: f.nombre,
            presentacion: f.presentacion_principal,
            imagen: f.imagen_miniatura_url ?? f.imagen_url,
            precio: {
              precioUnidad: f.precio_principal,
              precioMayor: f.precio_mayor_principal,
              cantidadMinMayor: f.cantidad_min_mayor_principal,
              enOferta: f.en_oferta_principal === true,
              precioOferta: f.precio_oferta_principal,
            },
            disponible: f.disponible_principal !== false,
          }
        : null,
  };
}
