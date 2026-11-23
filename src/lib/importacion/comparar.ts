import type { FilaCatalogo, FilaPrecios } from "@/lib/importacion/fila";
import { normalizarClave } from "@/lib/importacion/texto";

/**
 * Compara lo que dice el archivo con lo que ya hay guardado, por SKU, para la
 * vista previa ("anterior → nuevo"). Lógica PURA, con pruebas.
 *
 * Sigue la MISMA regla que las funciones SQL: una celda vacía no cambia nada.
 */

/** Una presentación guardada, con los datos de su producto. */
export type VarianteExistente = {
  sku: string;
  nombre_presentacion: string | null;
  contenido_valor: number | null;
  contenido_unidad: string | null;
  unidad_venta: string;
  unidades_por_empaque: number;
  precio_unidad: number | null;
  precio_mayor: number | null;
  cantidad_min_mayor: number | null;
  en_oferta: boolean;
  precio_oferta: number | null;
  disponible: boolean;
  activo: boolean;
  /** Privados (RN-14): solo se cargan para admin y editor, y solo en el modo "precios". */
  costo?: number | null;
  stock?: number | null;
  producto: {
    nombre: string;
    descripcion: string | null;
    etiquetas: string[];
    activo: boolean;
    marca: string | null;
    categoria: string;
    subcategoria: string | null;
  };
};

export type Cambio = {
  campo: string;
  antes: string | number | boolean | null;
  despues: string | number | boolean | null;
};

export type EstadoFila = "crear" | "actualizar" | "sin_cambios";

export type Comparacion = { estado: EstadoFila; cambios: Cambio[] };

/** Agrega un cambio solo si el archivo trae un valor y es distinto del guardado. */
function diferencia<T extends string | number | boolean | null>(
  cambios: Cambio[],
  campo: string,
  antes: T,
  despues: T | null,
  igual: (a: T, b: T) => boolean = (a, b) => a === b,
) {
  if (despues === null) return;
  if (antes !== null && igual(antes, despues)) return;
  cambios.push({ campo, antes, despues });
}

const mismoTexto = (a: string | null, b: string | null) =>
  normalizarClave(a) === normalizarClave(b);

/** Cambios de precio/oferta/disponibilidad (comunes a los dos modos). */
function cambiosDePrecios(
  fila: Pick<
    FilaPrecios,
    | "precio_unidad"
    | "precio_mayor"
    | "cantidad_min_mayor"
    | "en_oferta"
    | "precio_oferta"
    | "disponible"
  > &
    // El modo "catálogo" no trae costo ni existencias: ahí cuentan como vacíos.
    Partial<Pick<FilaPrecios, "costo" | "stock">>,
  actual: VarianteExistente,
): Cambio[] {
  const c: Cambio[] = [];
  diferencia(c, "precio_unidad", actual.precio_unidad, fila.precio_unidad);
  diferencia(c, "precio_mayor", actual.precio_mayor, fila.precio_mayor);
  diferencia(
    c,
    "cantidad_min_mayor",
    actual.cantidad_min_mayor,
    fila.cantidad_min_mayor,
  );
  diferencia(c, "en_oferta", actual.en_oferta, fila.en_oferta);
  diferencia(c, "precio_oferta", actual.precio_oferta, fila.precio_oferta);
  diferencia(c, "disponible", actual.disponible, fila.disponible);
  diferencia(c, "costo", actual.costo ?? null, fila.costo ?? null);
  diferencia(c, "stock", actual.stock ?? null, fila.stock ?? null);
  return c;
}

/** Importación de precios: la presentación debe existir (si no, es un error). */
export function compararPrecios(
  fila: FilaPrecios,
  actual: VarianteExistente | undefined,
): Comparacion | null {
  if (!actual) return null;
  const cambios = cambiosDePrecios(fila, actual);
  return { estado: cambios.length > 0 ? "actualizar" : "sin_cambios", cambios };
}

/** Importación del catálogo: crea lo que no existe y actualiza lo que cambió. */
export function compararCatalogo(
  fila: FilaCatalogo,
  actual: VarianteExistente | undefined,
): Comparacion {
  if (!actual) return { estado: "crear", cambios: [] };

  const c: Cambio[] = [];
  const p = actual.producto;

  diferencia(c, "producto", p.nombre, fila.producto);
  diferencia(c, "categoria", p.categoria, fila.categoria, mismoTexto);
  if (fila.subcategoria !== null) {
    diferencia(c, "subcategoria", p.subcategoria, fila.subcategoria, mismoTexto);
  } else if (p.subcategoria !== null) {
    // La categoría del archivo es la raíz y el producto está en una subcategoría.
    c.push({ campo: "subcategoria", antes: p.subcategoria, despues: null });
  }
  diferencia(c, "marca", p.marca, fila.marca, mismoTexto);
  diferencia(c, "descripcion", p.descripcion, fila.descripcion);
  if (
    fila.etiquetas.length > 0 &&
    fila.etiquetas.join("|") !== p.etiquetas.join("|")
  ) {
    c.push({
      campo: "etiquetas",
      antes: p.etiquetas.join(", "),
      despues: fila.etiquetas.join(", "),
    });
  }
  diferencia(c, "activo (producto)", p.activo, fila.activo);

  diferencia(c, "presentacion", actual.nombre_presentacion, fila.presentacion);
  diferencia(c, "contenido_valor", actual.contenido_valor, fila.contenido_valor);
  diferencia(c, "contenido_unidad", actual.contenido_unidad, fila.contenido_unidad);
  diferencia(c, "unidad_venta", actual.unidad_venta, fila.unidad_venta);
  diferencia(
    c,
    "unidades_por_empaque",
    actual.unidades_por_empaque,
    fila.unidades_por_empaque,
  );
  c.push(...cambiosDePrecios(fila, actual));
  diferencia(c, "activo", actual.activo, fila.activo);

  return { estado: c.length > 0 ? "actualizar" : "sin_cambios", cambios: c };
}
