import type { VarianteExistente } from "@/lib/importacion/comparar";

/**
 * Lectura de presentaciones guardadas (con su producto, marca y categoría) en
 * la forma que usan la vista previa y la exportación. Lógica PURA, con pruebas.
 */

/** Columnas a pedir a Supabase (una presentación + los datos de su producto). */
export const SELECT_VARIANTE_EXISTENTE =
  "sku, nombre_presentacion, contenido_valor, contenido_unidad, unidad_venta, " +
  "unidades_por_empaque, precio_unidad, precio_mayor, cantidad_min_mayor, en_oferta, " +
  "precio_oferta, disponible, activo, " +
  "productos!inner(nombre, descripcion, etiquetas, activo, " +
  "marcas(nombre), categorias(nombre, padre:categorias!parent_id(nombre)))";

type Nombre = { nombre: string } | null;

/** Forma (laxa) de lo que devuelve Supabase con SELECT_VARIANTE_EXISTENTE. */
export type FilaBD = Omit<VarianteExistente, "producto"> & {
  productos: {
    nombre: string;
    descripcion: string | null;
    etiquetas: string[];
    activo: boolean;
    marcas: Nombre;
    categorias: { nombre: string; padre: Nombre } | null;
  };
};

export function aVarianteExistente(fila: FilaBD): VarianteExistente {
  const { productos: p, ...variante } = fila;
  const categoria = p.categorias;
  // Con padre: la categoría es el padre y la hija es la subcategoría.
  const padre = categoria?.padre ?? null;
  return {
    ...variante,
    producto: {
      nombre: p.nombre,
      descripcion: p.descripcion,
      etiquetas: p.etiquetas ?? [],
      activo: p.activo,
      marca: p.marcas?.nombre ?? null,
      categoria: padre ? padre.nombre : (categoria?.nombre ?? ""),
      subcategoria: padre ? (categoria?.nombre ?? null) : null,
    },
  };
}
