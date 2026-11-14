import {
  COLUMNAS_CATALOGO,
  COLUMNAS_PRECIOS,
  type ColumnaCatalogo,
  type ModoImportacion,
} from "@/lib/importacion/columnas";
import type { VarianteExistente } from "@/lib/importacion/comparar";

/**
 * Armado de los archivos que se descargan (catálogo, precios y plantilla).
 * Lógica PURA, con pruebas: aquí solo se decide QUÉ va en cada celda; SheetJS
 * lo convierte a Excel/CSV en el servidor.
 */

export type Celda = string | number | null;

const sino = (v: boolean) => (v ? "si" : "no");

/** Valor de una columna para una presentación guardada. */
function celda(v: VarianteExistente, columna: ColumnaCatalogo): Celda {
  const p = v.producto;
  switch (columna) {
    case "sku":
      return v.sku;
    case "producto":
      return p.nombre;
    case "categoria":
      // Con subcategoría, la raíz es la categoría y la hija la subcategoría.
      return p.categoria;
    case "subcategoria":
      return p.subcategoria;
    case "marca":
      return p.marca;
    case "descripcion":
      return p.descripcion;
    case "etiquetas":
      return p.etiquetas.length > 0 ? p.etiquetas.join(", ") : null;
    case "presentacion":
      return v.nombre_presentacion;
    case "contenido_valor":
      return v.contenido_valor;
    case "contenido_unidad":
      return v.contenido_unidad;
    case "unidad_venta":
      return v.unidad_venta;
    case "unidades_por_empaque":
      return v.unidades_por_empaque;
    case "precio_unidad":
      return v.precio_unidad;
    case "precio_mayor":
      return v.precio_mayor;
    case "cantidad_min_mayor":
      return v.cantidad_min_mayor;
    case "en_oferta":
      return sino(v.en_oferta);
    case "precio_oferta":
      return v.precio_oferta;
    case "disponible":
      return sino(v.disponible);
    case "activo":
      return sino(v.activo);
    case "pagina_pdf":
      return null;
  }
}

/** Tabla (encabezado + una fila por presentación) lista para escribir. */
export function tablaDeExportacion(
  variantes: readonly VarianteExistente[],
  modo: ModoImportacion,
): Celda[][] {
  const columnas = modo === "precios" ? COLUMNAS_PRECIOS : COLUMNAS_CATALOGO;
  return [
    [...columnas],
    ...variantes.map((v) => columnas.map((c) => celda(v, c))),
  ];
}

/** Filas de ejemplo de la plantilla (dos presentaciones de un mismo producto y un producto simple). */
export const FILAS_EJEMPLO: Celda[][] = [
  [
    "",
    "Arroz Premium",
    "Víveres y despensa",
    "Granos y harinas",
    "Diana",
    "Arroz blanco de grano largo",
    "arroz, grano largo",
    "500 g",
    500,
    "g",
    "individual",
    1,
    2800,
    2500,
    12,
    "no",
    "",
    "si",
    "si",
    "",
  ],
  [
    "",
    "Arroz Premium",
    "Víveres y despensa",
    "Granos y harinas",
    "Diana",
    "Arroz blanco de grano largo",
    "arroz, grano largo",
    "1 kg",
    1,
    "kg",
    "individual",
    1,
    5200,
    4800,
    6,
    "no",
    "",
    "si",
    "si",
    "",
  ],
  [
    "",
    "Jabón de loza",
    "Aseo",
    "Cocina",
    "",
    "",
    "",
    "",
    "",
    "",
    "individual",
    1,
    "",
    "",
    "",
    "no",
    "",
    "si",
    "si",
    "",
  ],
];

/** Texto de la hoja "Instrucciones" de la plantilla. */
export const INSTRUCCIONES: string[] = [
  "Cada fila es UNA PRESENTACIÓN. Las filas con el mismo producto, categoría, subcategoría y marca forman un solo producto.",
  "sku: déjalo vacío para que el sistema lo genere. Si lo escribes y ya existe, se ACTUALIZA esa presentación.",
  "producto y categoria son obligatorios. La subcategoria y la marca son opcionales; si no existen, se crean.",
  "Una celda vacía NO borra lo que ya está guardado. Así puedes subir un archivo sin precios sin perder los que ya pusiste.",
  "Precios: pesos enteros, con o sin punto de miles (3200 o 3.200). Sin decimales ni símbolos.",
  "precio_mayor no puede ser mayor que precio_unidad. Si en_oferta es sí, precio_oferta debe ser menor que precio_unidad.",
  "unidad_venta: individual, paquete, display, caja o bolsa. unidades_por_empaque: cuántas unidades trae cada paquete o caja.",
  "en_oferta, disponible y activo: sí o no. Los productos sin precio quedan en borrador y no se ven en la tienda.",
  "etiquetas: separadas por coma, máximo 10.",
  "pagina_pdf es solo informativa; no se guarda.",
];
