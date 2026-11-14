import { ajustarDimensiones, LIMITES } from "@/lib/catalogo/imagenes";

/**
 * Compresión de fotos EN EL NAVEGADOR (usa canvas, por eso solo corre en el cliente).
 * La foto del celular (a veces 8 MB) se convierte a WebP de ≤ 1200 px y < 200 KB,
 * más una miniatura de 400 px. Así se sube poco y la tienda carga rápido con datos
 * móviles (RNF-02). La lógica de tamaños está en imagenes.ts, que sí tiene pruebas.
 */

/** Error con un mensaje listo para mostrar a la persona. */
export class ErrorImagen extends Error {}

const CALIDADES = [0.85, 0.75, 0.65, 0.55, 0.45];
/** Tope absoluto si no se logra llegar al peso objetivo: el bucket acepta hasta 2 MB. */
const TOPE_FINAL_BYTES = 1.8 * 1024 * 1024;

function aBlobWebp(canvas: HTMLCanvasElement, calidad: number) {
  return new Promise<Blob | null>((resolver) =>
    canvas.toBlob(resolver, "image/webp", calidad),
  );
}

/**
 * Dibuja la imagen en un canvas del tamaño pedido y busca la mejor calidad que
 * quepa en `maxBytes`. Si ninguna alcanza, reduce el tamaño un 15 % y reintenta.
 */
async function generar(
  bitmap: ImageBitmap,
  maxLado: number,
  maxBytes: number,
): Promise<Blob> {
  let lado = maxLado;
  let mejor: Blob | null = null;

  for (let ronda = 0; ronda < 6 && lado >= 160; ronda++) {
    const { ancho, alto } = ajustarDimensiones(
      bitmap.width,
      bitmap.height,
      lado,
    );
    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ErrorImagen("Tu navegador no puede procesar imágenes.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, ancho, alto);

    for (const calidad of CALIDADES) {
      const blob = await aBlobWebp(canvas, calidad);
      if (!blob)
        throw new ErrorImagen("Tu navegador no pudo convertir la imagen.");
      // Algunos navegadores antiguos ignoran "webp" y devuelven PNG: se avisa en vez de subir un archivo con la extensión equivocada.
      if (blob.type !== "image/webp") {
        throw new ErrorImagen(
          "Tu navegador no puede convertir a WebP. Actualízalo o usa Chrome.",
        );
      }
      if (!mejor || blob.size < mejor.size) mejor = blob;
      if (blob.size <= maxBytes) return blob;
    }
    lado = Math.round(lado * 0.85);
  }

  if (mejor && mejor.size <= TOPE_FINAL_BYTES) return mejor;
  throw new ErrorImagen(
    "No se pudo reducir esta imagen lo suficiente. Prueba con otra.",
  );
}

/** Devuelve la imagen principal y su miniatura, ambas en WebP, listas para subir. */
export async function prepararImagen(
  archivo: File,
): Promise<{ grande: Blob; miniatura: Blob }> {
  let bitmap: ImageBitmap;
  try {
    // "from-image" respeta la orientación de las fotos del celular (EXIF).
    bitmap = await createImageBitmap(archivo, {
      imageOrientation: "from-image",
    });
  } catch {
    throw new ErrorImagen("No se pudo leer la imagen. ¿Está dañada?");
  }
  try {
    const grande = await generar(bitmap, LIMITES.maxLado, LIMITES.maxBytes);
    const miniatura = await generar(
      bitmap,
      LIMITES.maxLadoMiniatura,
      LIMITES.maxBytesMiniatura,
    );
    return { grande, miniatura };
  } finally {
    bitmap.close();
  }
}

/**
 * Una sola imagen en WebP con el lado mayor y el peso que se pidan (para los banners,
 * que son más grandes que las fotos de producto).
 */
export async function comprimirImagen(archivo: File, maxLado: number, maxBytes: number): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  } catch {
    throw new ErrorImagen("No se pudo leer la imagen. ¿Está dañada?");
  }
  try {
    return await generar(bitmap, maxLado, maxBytes);
  } finally {
    bitmap.close();
  }
}
