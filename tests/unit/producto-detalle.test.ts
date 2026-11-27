import { describe, expect, it } from "vitest";
import {
  aPresentacion,
  descripcionMeta,
  etiquetaPresentacion,
  etiquetaVenta,
  formatoMedidas,
  formatoPeso,
  jsonLdProducto,
  numeroEs,
  precioMostrado,
  type VarianteDetalle,
} from "@/lib/tienda/producto";

const variante: VarianteDetalle = {
  id: 1, sku: "EVC-00001-01", nombre_presentacion: "400 g", contenido_valor: 400, contenido_unidad: "g",
  unidad_venta: "individual", unidades_por_empaque: 1, peso_g: null, alto_cm: null, ancho_cm: null, largo_cm: null,
  precio_unidad: 3200, en_oferta: false, precio_oferta: null, disponible: true,
};

describe("formatos", () => {
  it("numeroEs usa punto de miles y coma decimal", () => {
    expect(numeroEs(1234.5)).toBe("1.234,5");
    expect(numeroEs(10)).toBe("10");
    expect(numeroEs(0.25)).toBe("0,25");
  });

  it("etiquetaVenta", () => {
    expect(etiquetaVenta("individual", 1)).toBe("Individual");
    expect(etiquetaVenta("paquete", 12)).toBe("Paquete x 12");
    expect(etiquetaVenta("raro", 1)).toBe("Raro");
  });

  it("etiquetaPresentacion usa el nombre o arma el contenido", () => {
    expect(etiquetaPresentacion(variante)).toBe("400 g");
    expect(etiquetaPresentacion({ ...variante, nombre_presentacion: null })).toBe("400 g");
    expect(etiquetaPresentacion({ ...variante, nombre_presentacion: " ", contenido_valor: 0.5, contenido_unidad: "L" })).toBe("0,5 L");
    expect(etiquetaPresentacion({ ...variante, nombre_presentacion: null, contenido_valor: null, unidad_venta: "caja", unidades_por_empaque: 24 })).toBe("Caja x 24");
  });

  it("peso y medidas", () => {
    expect(formatoPeso(500)).toBe("500 g");
    expect(formatoPeso(1200)).toBe("1,2 kg");
    expect(formatoPeso(null)).toBeNull();
    expect(formatoMedidas(3, 5, 10)).toBe("10 × 5 × 3 cm");
    expect(formatoMedidas(3, null, 10)).toBeNull();
  });
});

describe("aPresentacion", () => {
  it("sin precio no se muestra", () => {
    expect(aPresentacion({ ...variante, precio_unidad: null })).toBeNull();
  });

  it("ignora ofertas que no son más baratas", () => {
    const p = aPresentacion({ ...variante, en_oferta: true, precio_oferta: 3200 });
    expect(p?.precioOferta).toBeNull();
  });

  it("oferta apagada no cuenta aunque tenga precio de oferta", () => {
    expect(aPresentacion({ ...variante, en_oferta: false, precio_oferta: 2000 })?.precioOferta).toBeNull();
  });
});

describe("precioMostrado", () => {
  it("sin oferta muestra el precio normal", () => {
    expect(precioMostrado(aPresentacion(variante)!)).toEqual({ precio: 3200, tipo: "unidad" });
  });

  it("con oferta activa muestra la oferta", () => {
    const p = aPresentacion({ ...variante, en_oferta: true, precio_oferta: 2500 })!;
    expect(precioMostrado(p)).toEqual({ precio: 2500, tipo: "oferta" });
  });

  it("el descuento por monto NO se muestra en la ficha: se aplica en el carrito", () => {
    const p = aPresentacion(variante)!;
    expect("mayor" in p).toBe(false);
  });
});

describe("SEO", () => {
  it("descripcionMeta recorta o arma un texto por defecto", () => {
    expect(descripcionMeta("Lentejas", "Doña Lupe", "  Lentejas   de la mejor calidad ")).toBe("Lentejas de la mejor calidad");
    expect(descripcionMeta("Lentejas", null, "x".repeat(300)).length).toBeLessThanOrEqual(156);
    expect(descripcionMeta("Lentejas", "Doña Lupe", null)).toContain("Lentejas de Doña Lupe");
  });

  it("jsonLdProducto", () => {
    const j = jsonLdProducto({ nombre: "A", descripcion: "d", marca: "M", sku: "S", imagenes: ["u"], precio: 100, disponible: false, url: "https://x/p" });
    expect(j.offers.priceCurrency).toBe("COP");
    expect(j.offers.availability).toBe("https://schema.org/OutOfStock");
    expect(j.brand).toEqual({ "@type": "Brand", name: "M" });
    const sin = jsonLdProducto({ nombre: "A", descripcion: "d", marca: null, sku: null, imagenes: [], precio: 1, disponible: true, url: "u" });
    expect("image" in sin).toBe(false);
    expect("brand" in sin).toBe(false);
  });
});
