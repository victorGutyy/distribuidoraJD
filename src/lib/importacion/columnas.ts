/**
 * Columnas de los archivos de importación y lectura de encabezados.
 * Lógica PURA (sin Next, sin Supabase, sin SheetJS), con pruebas.
 *
 * Un archivo tiene UNA FILA POR PRESENTACIÓN. Las filas con el mismo producto,
 * categoría, subcategoría y marca forman un solo producto.
 */

/** Columnas de la plantilla completa del catálogo, en su orden. */
export const COLUMNAS_CATALOGO = [
  "sku",
  "producto",
  "categoria",
  "subcategoria",
  "marca",
  "descripcion",
  "etiquetas",
  "presentacion",
  "contenido_valor",
  "contenido_unidad",
  "unidad_venta",
  "unidades_por_empaque",
  "precio_unidad",
  "precio_mayor",
  "cantidad_min_mayor",
  "en_oferta",
  "precio_oferta",
  "disponible",
  "activo",
  "pagina_pdf",
] as const;

/**
 * Costo y existencias (RF-32). Solo existen en el modo "precios": son datos privados
 * (RN-14) que no van en la plantilla ni en la copia del catálogo.
 */
export const COLUMNAS_COSTOS = ["costo", "stock"] as const;

/**
 * Columnas del archivo de precios. `producto` y `presentacion` solo ayudan a
 * reconocer la fila en Excel: al importar se ignoran, manda el SKU.
 */
export const COLUMNAS_PRECIOS = [
  "sku",
  "producto",
  "presentacion",
  "precio_unidad",
  "precio_mayor",
  "cantidad_min_mayor",
  "en_oferta",
  "precio_oferta",
  "disponible",
  ...COLUMNAS_COSTOS,
] as const;

export type ColumnaCatalogo = (typeof COLUMNAS_CATALOGO)[number];
export type ColumnaCostos = (typeof COLUMNAS_COSTOS)[number];
/** Cualquier columna que un archivo de importación puede traer. */
export type ColumnaImportacion = ColumnaCatalogo | ColumnaCostos;
/** Lista de todas las columnas posibles (para validar lo que llega al servidor). */
export const COLUMNAS_IMPORTABLES = [
  ...COLUMNAS_CATALOGO,
  ...COLUMNAS_COSTOS,
] as const;
export type ModoImportacion = "catalogo" | "precios";

/** Una fila tal como viene del archivo: todo texto, sin interpretar. */
export type FilaCruda = Partial<Record<ColumnaImportacion, string>>;

/** Una fila cruda más el número de fila que tenía en el archivo (para los avisos). */
export type FilaConNumero = { fila: number; datos: FilaCruda };

export function columnasDelModo(modo: ModoImportacion): readonly ColumnaImportacion[] {
  return modo === "precios" ? COLUMNAS_PRECIOS : COLUMNAS_CATALOGO;
}

/** "Categoría " → "categoria"; "Precio por mayor" → "precio_por_mayor". */
export function normalizarEncabezado(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Nombres alternativos que la gente suele escribir en Excel. */
const ALIAS: Record<string, ColumnaImportacion> = {
  precio_costo: "costo",
  costo_unitario: "costo",
  inventario: "stock",
  existencias: "stock",
  existencia: "stock",
  codigo: "sku",
  referencia: "sku",
  nombre: "producto",
  nombre_producto: "producto",
  articulo: "producto",
  sub_categoria: "subcategoria",
  detalle: "descripcion",
  tags: "etiquetas",
  contenido: "contenido_valor",
  cantidad_contenido: "contenido_valor",
  unidad_contenido: "contenido_unidad",
  unidad: "unidad_venta",
  unidades_empaque: "unidades_por_empaque",
  precio: "precio_unidad",
  precio_unitario: "precio_unidad",
  precio_por_unidad: "precio_unidad",
  precio_por_mayor: "precio_mayor",
  precio_mayorista: "precio_mayor",
  cantidad_minima_mayor: "cantidad_min_mayor",
  min_mayor: "cantidad_min_mayor",
  oferta: "en_oferta",
  pagina: "pagina_pdf",
};

/** ¿A qué columna conocida corresponde este encabezado? null si a ninguna. */
export function columnaDeEncabezado(
  encabezado: string,
  permitidas: readonly ColumnaImportacion[],
): ColumnaImportacion | null {
  const limpio = normalizarEncabezado(encabezado);
  if (!limpio) return null;
  const candidata =
    (COLUMNAS_IMPORTABLES as readonly string[]).includes(limpio)
      ? (limpio as ColumnaImportacion)
      : ALIAS[limpio];
  return candidata && permitidas.includes(candidata) ? candidata : null;
}

export type LecturaTabla = {
  filas: FilaConNumero[];
  /** Encabezados del archivo que no se reconocieron (se ignoran). */
  ignoradas: string[];
  /** Columnas obligatorias que faltan en el archivo. */
  faltantes: ColumnaImportacion[];
};

const OBLIGATORIAS: Record<ModoImportacion, readonly ColumnaImportacion[]> = {
  catalogo: ["producto", "categoria"],
  precios: ["sku"],
};

/**
 * Convierte una tabla (lista de filas de celdas, la primera es el encabezado)
 * en filas con nombre de columna. Salta las filas totalmente vacías.
 * `fila` es el número que la persona ve en Excel (el encabezado es la fila 1).
 */
export function leerTabla(
  tabla: readonly (readonly string[])[],
  modo: ModoImportacion,
): LecturaTabla {
  const permitidas = columnasDelModo(modo);
  const [encabezados = [], ...cuerpo] = tabla;

  const columnas = encabezados.map((e) => columnaDeEncabezado(e, permitidas));
  const ignoradas = encabezados.filter(
    (e, i) => columnas[i] === null && e.trim() !== "",
  );
  const presentes = new Set(columnas.filter((c) => c !== null));
  const faltantes = OBLIGATORIAS[modo].filter((c) => !presentes.has(c));

  const filas: FilaConNumero[] = [];
  cuerpo.forEach((celdas, i) => {
    const datos: FilaCruda = {};
    let hayAlgo = false;
    columnas.forEach((columna, j) => {
      if (!columna) return;
      const valor = (celdas[j] ?? "").trim();
      if (valor !== "") hayAlgo = true;
      // Si una columna aparece repetida, gana la primera con contenido.
      if (datos[columna] === undefined || datos[columna] === "") {
        datos[columna] = valor;
      }
    });
    if (hayAlgo) filas.push({ fila: i + 2, datos });
  });

  return { filas, ignoradas, faltantes };
}
