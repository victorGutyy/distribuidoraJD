import { describe, expect, it } from "vitest";
import {
  ajustarDimensiones,
  errorDeArchivo,
  esUuid,
  LIMITES,
  rutaDesdeUrl,
  rutasDeBanner,
  rutasDeImagen,
  urlPublica,
} from "@/lib/catalogo/imagenes";

const SUPABASE = "https://abc123.supabase.co";
const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("ajustarDimensiones", () => {
  it("reduce una foto grande conservando la proporción", () => {
    expect(ajustarDimensiones(4000, 3000, 1200)).toEqual({
      ancho: 1200,
      alto: 900,
    });
    expect(ajustarDimensiones(3000, 4000, 1200)).toEqual({
      ancho: 900,
      alto: 1200,
    });
  });

  it("NUNCA agranda una imagen que ya es pequeña", () => {
    expect(ajustarDimensiones(800, 600, 1200)).toEqual({
      ancho: 800,
      alto: 600,
    });
    expect(ajustarDimensiones(1200, 1200, 1200)).toEqual({
      ancho: 1200,
      alto: 1200,
    });
  });

  it("sirve para la miniatura de 400 px", () => {
    expect(ajustarDimensiones(1200, 900, LIMITES.maxLadoMiniatura)).toEqual({
      ancho: 400,
      alto: 300,
    });
  });

  it("no devuelve dimensiones menores a 1 píxel", () => {
    expect(ajustarDimensiones(10000, 1, 1200)).toEqual({
      ancho: 1200,
      alto: 1,
    });
  });
});

describe("errorDeArchivo", () => {
  it("acepta JPG, PNG y WebP razonables", () => {
    expect(errorDeArchivo("image/jpeg", 3_000_000)).toBeNull();
    expect(errorDeArchivo("image/png", 100)).toBeNull();
    expect(errorDeArchivo("image/webp", 100)).toBeNull();
  });

  it("rechaza otros tipos, archivos vacíos y los de más de 15 MB", () => {
    expect(errorDeArchivo("application/pdf", 100)).toMatch(/JPG, PNG o WebP/);
    expect(errorDeArchivo("image/svg+xml", 100)).toMatch(/JPG, PNG o WebP/);
    expect(errorDeArchivo("image/jpeg", 0)).toMatch(/vacío/);
    expect(errorDeArchivo("image/jpeg", 16 * 1024 * 1024)).toMatch(/15 MB/);
  });
});

describe("rutas y URLs", () => {
  it("arma las rutas bajo el producto", () => {
    expect(rutasDeImagen(12, UUID)).toEqual({
      grande: `productos/12/${UUID}.webp`,
      miniatura: `productos/12/${UUID}-m.webp`,
    });
  });

  it("construye la URL pública y vuelve a la ruta", () => {
    const { grande } = rutasDeImagen(12, UUID);
    const url = urlPublica(SUPABASE, grande);
    expect(url).toBe(`${SUPABASE}/storage/v1/object/public/catalogo/${grande}`);
    expect(rutaDesdeUrl(SUPABASE, url)).toBe(grande);
    // tolera una barra final en la URL base
    expect(urlPublica(`${SUPABASE}/`, grande)).toBe(url);
  });

  it("rutaDesdeUrl solo reconoce archivos de NUESTRO bucket y de productos", () => {
    expect(rutaDesdeUrl(SUPABASE, "https://otro.com/x.webp")).toBeNull();
    expect(
      rutaDesdeUrl(
        SUPABASE,
        `${SUPABASE}/storage/v1/object/public/otro/productos/1/${UUID}.webp`,
      ),
    ).toBeNull();
    expect(
      rutaDesdeUrl(
        SUPABASE,
        `${SUPABASE}/storage/v1/object/public/catalogo/../secreto.webp`,
      ),
    ).toBeNull();
    expect(
      rutaDesdeUrl(
        SUPABASE,
        `${SUPABASE}/storage/v1/object/public/catalogo/productos/1/archivo.png`,
      ),
    ).toBeNull();
  });

  it("esUuid valida el formato", () => {
    expect(esUuid(UUID)).toBe(true);
    expect(esUuid("no-es-uuid")).toBe(false);
    expect(esUuid("../../etc")).toBe(false);
    expect(esUuid("")).toBe(false);
  });
});

describe("banners del inicio", () => {
  const SB = "https://abc.supabase.co";
  const uuid = "123e4567-e89b-12d3-a456-426614174000";

  it("rutasDeBanner y su ida y vuelta con rutaDesdeUrl", () => {
    const r = rutasDeBanner(uuid);
    expect(r).toEqual({ escritorio: `banners/${uuid}.webp`, movil: `banners/${uuid}-m.webp` });
    expect(rutaDesdeUrl(SB, urlPublica(SB, r.escritorio))).toBe(r.escritorio);
    expect(rutaDesdeUrl(SB, urlPublica(SB, r.movil))).toBe(r.movil);
  });

  it("no reconoce otras carpetas del bucket ni archivos raros", () => {
    expect(rutaDesdeUrl(SB, urlPublica(SB, `otra/${uuid}.webp`))).toBeNull();
    expect(rutaDesdeUrl(SB, urlPublica(SB, "banners/../productos/1/x.webp"))).toBeNull();
    expect(rutaDesdeUrl(SB, urlPublica(SB, "banners/archivo.webp"))).toBeNull();
  });
});
