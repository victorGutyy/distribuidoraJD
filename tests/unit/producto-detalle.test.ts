import { describe, expect, it } from "vitest";
import { formatCOP } from "@/lib/formato";
import {
  aPresentacion,
  descripcionMeta,
  etiquetaPresentacion,
  etiquetaVenta,
  formatoMedidas,
  formatoPeso,
  jsonLdProducto,
  mensajeMayoreo,
  numeroEs,
  precioMostrado,
  type VarianteDetalle,
} from "@/lib/tienda/producto";

const variante: VarianteDetalle = {
  id: 1, sku: "EVC-00001-01", nombre_presentacion: "400 g", contenido_valor: 400, contenido_unidad: "g",
  unidad_venta: "individual", unidades_por_empaque: 1, peso_g: null, alto_cm: null, ancho_cm: null, largo_cm: null,
  precio_unidad: 3200, precio_mayor: null, cantidad_min_mayor: null, en_oferta: false, precio_oferta: null, disponible: true,
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

  it("ignora ofertas y mayoreos que no son más baratos", () => {
    const p = aPresentacion({ ...variante, en_oferta: true, precio_oferta: 3200, precio_mayor: 3500, cantidad_min_mayor: 12 });
    expect(p?.precioOferta).toBeNull();
    expect(p?.mayor).toBeNull();
  });

  it("oferta apagada no cuenta aunque tenga precio de oferta", () => {
    expect(aPresentacion({ ...variante, en_oferta: false, precio_oferta: 2000 })?.precioOferta).toBeNull();
  });
});

describe("precioMostrado y mensajeMayoreo", () => {
  const p = aPresentacion({ ...variante, precio_mayor: 3000, cantidad_min_mayor: 12 })!;

  it("antes de la cantidad mínima paga el precio normal", () => {
    expect(precioMostrado(p, 11)).toEqual({ precio: 3200, tipo: "unidad" });
    expect(mensajeMayoreo(p, 11, formatCOP)).toEqual({ texto: "Lleva 12 o más y paga $ 3.000 c/u", aplicado: false });
  });

  it("con la cantidad mínima aplica el precio por mayor", () => {
    expect(precioMostrado(p, 12)).toEqual({ precio: 3000, tipo: "mayor" });
    expect(mensajeMayoreo(p, 12, formatCOP)).toEqual({ texto: "Precio por mayor aplicado: $ 3.000 c/u", aplicado: true });
  });

  it("siempre el menor: una oferta más barata que el mayor gana", () => {
    const q = aPresentacion({ ...variante, en_oferta: true, precio_oferta: 2500, precio_mayor: 3000, cantidad_min_mayor: 12 })!;
    expect(precioMostrado(q, 1)).toEqual({ precio: 2500, tipo: "oferta" });
    expect(precioMostrado(q, 20)).toEqual({ precio: 2500, tipo: "oferta" });
  });

  it("si la oferta ya es mejor que el mayor, no se anuncia el mayoreo", () => {
    const q = aPresentacion({ ...variante, en_oferta: true, precio_oferta: 2500, precio_mayor: 3000, cantidad_min_mayor: 12 })!;
    expect(mensajeMayoreo(q, 1, formatCOP)).toBeNull();
    expect(mensajeMayoreo(q, 20, formatCOP)).toBeNull();
    // Pero si el mayor es más barato que la oferta, sí.
    const r = aPresentacion({ ...variante, en_oferta: true, precio_oferta: 3100, precio_mayor: 3000, cantidad_min_mayor: 12 })!;
    expect(mensajeMayoreo(r, 1, formatCOP)?.aplicado).toBe(false);
    expect(precioMostrado(r, 12).tipo).toBe("mayor");
  });

  it("sin cantidad mínima el mayor aplica desde 1", () => {
    const q = aPresentacion({ ...variante, precio_mayor: 3000 })!;
    expect(precioMostrado(q, 1).tipo).toBe("mayor");
  });

  it("sin precio por mayor no hay mensaje", () => {
    expect(mensajeMayoreo(aPresentacion(variante)!, 5, formatCOP)).toBeNull();
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
