import { describe, expect, it } from "vitest";
import { enlaceSeguro, esEnlaceExterno, imagenPermitida } from "@/lib/tienda/imagenes";

describe("enlaceSeguro", () => {
  it("acepta rutas internas y https", () => {
    expect(enlaceSeguro("/catalogo?ofertas=1")).toBe("/catalogo?ofertas=1");
    expect(enlaceSeguro(" https://instagram.com/ev ")).toBe("https://instagram.com/ev");
  });

  it("descarta lo peligroso o inválido", () => {
    expect(enlaceSeguro("javascript:alert(1)")).toBeNull();
    expect(enlaceSeguro("//otro-sitio.com")).toBeNull();
    expect(enlaceSeguro("/\\evil.com")).toBeNull();
    expect(enlaceSeguro("http://inseguro.com")).toBeNull();
    expect(enlaceSeguro("data:text/html,<script>")).toBeNull();
    expect(enlaceSeguro("hola")).toBeNull();
    expect(enlaceSeguro("")).toBeNull();
    expect(enlaceSeguro(null)).toBeNull();
  });

  it("distingue enlaces externos", () => {
    expect(esEnlaceExterno("/catalogo")).toBe(false);
    expect(esEnlaceExterno("https://x.com")).toBe(true);
  });
});

describe("imagenPermitida", () => {
  const sb = "https://abc.supabase.co";
  const ok = "https://abc.supabase.co/storage/v1/object/public/catalogo/banners/1.webp";

  it("solo el bucket público de nuestro Supabase", () => {
    expect(imagenPermitida(ok, sb)).toBe(ok);
    expect(imagenPermitida("https://otro.com/storage/v1/object/public/catalogo/x.webp", sb)).toBeNull();
    expect(imagenPermitida("https://abc.supabase.co/storage/v1/object/public/privado/x.webp", sb)).toBeNull();
    expect(imagenPermitida("http://abc.supabase.co/storage/v1/object/public/catalogo/x.webp", sb)).toBeNull();
  });

  it("tolera valores vacíos o mal formados", () => {
    expect(imagenPermitida(null, sb)).toBeNull();
    expect(imagenPermitida(ok, undefined)).toBeNull();
    expect(imagenPermitida("no es una url", sb)).toBeNull();
  });
});
