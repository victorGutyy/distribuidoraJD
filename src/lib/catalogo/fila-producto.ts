import type { Tables } from "@/types/database.types";

/** Una fila de la tabla de productos del panel (viene de la vista v_productos_admin). */
export type FilaProducto = {
  id: number;
  nombre: string;
  slug: string;
  estado: "borrador" | "activo" | "inactivo";
  visibleEnTienda: boolean;
  categoria: string;
  marca: string | null;
  nVariantes: number;
  nConPrecio: number;
  precioMin: number | null;
  precioMax: number | null;
  hayOferta: boolean;
  skus: string;
  imagen: string | null;
  actualizado: string;
};

/** Las columnas de una vista de Postgres llegan como `| null`; aquí se normalizan. */
export function aFilaProducto(r: Tables<"v_productos_admin">): FilaProducto {
  const estado =
    r.estado === "borrador" || r.estado === "inactivo" ? r.estado : "activo";
  const padre = r.categoria_padre_nombre;
  return {
    id: r.id ?? 0,
    nombre: r.nombre ?? "",
    slug: r.slug ?? "",
    estado,
    visibleEnTienda: r.visible_en_tienda ?? false,
    categoria: padre
      ? `${padre} › ${r.categoria_nombre ?? ""}`
      : (r.categoria_nombre ?? ""),
    marca: r.marca_nombre,
    nVariantes: r.n_variantes ?? 0,
    nConPrecio: r.n_con_precio ?? 0,
    precioMin: r.precio_min,
    precioMax: r.precio_max,
    hayOferta: r.hay_oferta ?? false,
    skus: r.skus ?? "",
    imagen: r.imagen_miniatura_url,
    actualizado: r.updated_at ?? "",
  };
}
