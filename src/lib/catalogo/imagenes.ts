/**
 * Imágenes de productos (RF-24): tamaños, rutas en Storage y URLs públicas.
 * Lógica PURA, con pruebas. La compresión con canvas está en comprimir-imagen.ts.
 */

export const BUCKET = "catalogo";

export const LIMITES = {
  /** Lado mayor de la imagen principal, en píxeles. */
  maxLado: 1200,
  /** Lado mayor de la miniatura. */
  maxLadoMiniatura: 400,
  /** Peso objetivo de la imagen principal (RF-24: < 200 KB). */
  maxBytes: 200 * 1024,
  /** Peso objetivo de la miniatura. */
  maxBytesMiniatura: 50 * 1024,
  /** Peso máximo del archivo ORIGINAL que se acepta (antes de comprimir). */
  maxBytesOriginal: 15 * 1024 * 1024,
  /** Imágenes por producto. */
  maxPorProducto: 10,
} as const;

/** Tipos que el navegador sabe leer y convertir. */
export const TIPOS_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/**
 * Reduce (sin agrandar nunca) un tamaño para que su lado mayor sea `maxLado`,
 * conservando la proporción. Devuelve enteros ≥ 1.
 */
export function ajustarDimensiones(
  ancho: number,
  alto: number,
  maxLado: number,
): { ancho: number; alto: number } {
  const mayor = Math.max(ancho, alto);
  if (mayor <= maxLado) {
    return {
      ancho: Math.max(1, Math.round(ancho)),
      alto: Math.max(1, Math.round(alto)),
    };
  }
  const escala = maxLado / mayor;
  return {
    ancho: Math.max(1, Math.round(ancho * escala)),
    alto: Math.max(1, Math.round(alto * escala)),
  };
}

/** ¿Se acepta este archivo? Devuelve un mensaje de error en español, o null si está bien. */
export function errorDeArchivo(tipo: string, bytes: number): string | null {
  if (!(TIPOS_PERMITIDOS as readonly string[]).includes(tipo)) {
    return "Solo se aceptan imágenes JPG, PNG o WebP.";
  }
  if (bytes > LIMITES.maxBytesOriginal) {
    return "La imagen pesa más de 15 MB. Prueba con una más liviana.";
  }
  if (bytes === 0) return "El archivo está vacío.";
  return null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const esUuid = (valor: string) => UUID.test(valor);

/**
 * Rutas dentro del bucket para una imagen: la principal y su miniatura.
 * Siempre bajo `productos/<id>/`, para saber a qué producto pertenece cada archivo.
 */
export function rutasDeImagen(productoId: number, uuid: string) {
  return {
    grande: `productos/${productoId}/${uuid}.webp`,
    miniatura: `productos/${productoId}/${uuid}-m.webp`,
  };
}

/** URL pública de un archivo del bucket. `urlSupabase` = NEXT_PUBLIC_SUPABASE_URL. */
export function urlPublica(urlSupabase: string, ruta: string): string {
  return `${urlSupabase.replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET}/${ruta}`;
}

/**
 * Operación inversa: la ruta dentro del bucket a partir de una URL pública, o
 * null si la URL no es de NUESTRO bucket (así nunca se borra algo ajeno).
 */
export function rutaDesdeUrl(urlSupabase: string, url: string): string | null {
  const prefijo = urlPublica(urlSupabase, "");
  if (!url.startsWith(prefijo)) return null;
  const ruta = url.slice(prefijo.length);
  return /^productos\/\d+\/[0-9a-f-]{36}(-m)?\.webp$/i.test(ruta) ? ruta : null;
}
