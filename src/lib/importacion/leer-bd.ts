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

/**
 * Lo mismo, más el costo y las existencias (RF-32). SOLO para el modo "precios" y para
 * admin/editor: la tabla `variante_costos` tiene RLS, así que otro rol recibiría vacío.
 */
export const SELECT_VARIANTE_CON_COSTOS =
  SELECT_VARIANTE_EXISTENTE + ", variante_costos(costo, stock)";

type Nombre = { nombre: string } | null;
type CostosBD = { costo: number | null; stock: number | null };

/** Forma (laxa) de lo que devuelve Supabase con SELECT_VARIANTE_EXISTENTE. */
export type FilaBD = Omit<VarianteExistente, "producto"> & {
  /** Objeto (relación 1 a 1), lista de un elemento o null, según como lo entregue PostgREST. */
  variante_costos?: CostosBD | CostosBD[] | null;
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
  const { productos: p, variante_costos, ...variante } = fila;
  const costos = Array.isArray(variante_costos) ? variante_costos[0] : variante_costos;
  const categoria = p.categorias;
  // Con padre: la categoría es el padre y la hija es la subcategoría.
  const padre = categoria?.padre ?? null;
  return {
    ...variante,
    // Sin embed (otro modo) o sin fila de costos: no hay dato.
    ...(variante_costos === undefined
      ? {}
      : { costo: costos?.costo ?? null, stock: costos?.stock ?? null }),
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
