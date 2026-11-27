import { describe, expect, it } from "vitest";
import {
  agruparLineas,
  calcularCarrito,
  descuentoConfigurado,
  faltaParaMinimo,
  precioBase,
  precioConDescuento,
  precioDeLinea,
  textoDescuento,
  type ConfigPrecios,
  type VariantePrecio,
} from "@/lib/precios";
import { aPresentacion, precioMostrado, type VarianteDetalle } from "@/lib/tienda/producto";

const v = (extra: Partial<VariantePrecio> = {}): VariantePrecio => ({
  precioUnidad: 3200,
  enOferta: false,
  precioOferta: null,
  ...extra,
});
const sinDescuento: ConfigPrecios = { montoMinimo: 0, porcentaje: 0 };
const cinco: ConfigPrecios = { montoMinimo: 500_000, porcentaje: 5 };

describe("precioBase y precioConDescuento", () => {
  it("la oferta vale solo si está activa y es más barata", () => {
    expect(precioBase(v({ enOferta: true, precioOferta: 2800 }))).toEqual({ precio: 2800, tipo: "oferta" });
    expect(precioBase(v({ enOferta: false, precioOferta: 2800 })).tipo).toBe("unidad");
    expect(precioBase(v({ enOferta: true, precioOferta: 3200 })).tipo).toBe("unidad");
    expect(precioBase(v({ enOferta: true, precioOferta: null })).tipo).toBe("unidad");
  });

  it("el descuento se redondea al peso más cercano", () => {
    expect(precioConDescuento(3200, 5)).toBe(3040);
    expect(precioConDescuento(1731, 5)).toBe(1644); // 1644,45
    expect(precioConDescuento(1932, 5)).toBe(1835); // 1835,4
    expect(precioConDescuento(1000, 5)).toBe(950);
  });
});

describe("precioDeLinea (RN-04: siempre el menor)", () => {
  it("sin descuento activo paga el precio de unidad", () => {
    expect(precioDeLinea(v(), false, 5)).toEqual({ precio: 3200, tipo: "unidad", precioBase: 3200 });
  });

  it("con descuento activo baja el porcentaje y queda marcado como «mayor»", () => {
    expect(precioDeLinea(v(), true, 5)).toEqual({ precio: 3040, tipo: "mayor", precioBase: 3200 });
  });

  it("una oferta mejor que el descuento NO se rebaja otra vez", () => {
    const oferta = v({ enOferta: true, precioOferta: 2800 }); // 5 % de 3200 = 3040 > 2800
    expect(precioDeLinea(oferta, true, 5)).toEqual({ precio: 2800, tipo: "oferta", precioBase: 2800 });
  });

  it("una oferta peor que el descuento cede ante el descuento", () => {
    const oferta = v({ enOferta: true, precioOferta: 3150 }); // 3040 < 3150
    expect(precioDeLinea(oferta, true, 5)).toEqual({ precio: 3040, tipo: "mayor", precioBase: 3150 });
  });
});

describe("descuento por monto (RN-03)", () => {
  const variantes = new Map([
    [1, v({ precioUnidad: 10_000 })],
    [2, v({ precioUnidad: 2_000, enOferta: true, precioOferta: 1_500 })],
  ]);

  it("por debajo del monto no hay descuento y se informa cuánto falta", () => {
    const r = calcularCarrito([{ varianteId: 1, cantidad: 49 }], variantes, cinco); // 490.000
    expect(r.descuentoActivo).toBe(false);
    expect(r.descuentoMayor).toBe(0);
    expect(r.total).toBe(490_000);
    expect(r.faltaParaDescuento).toBe(10_000);
  });

  it("justo en el monto SÍ aplica («iguales o mayores a $500.000»)", () => {
    const r = calcularCarrito([{ varianteId: 1, cantidad: 50 }], variantes, cinco); // 500.000
    expect(r.descuentoActivo).toBe(true);
    expect(r.subtotal).toBe(500_000);
    expect(r.total).toBe(475_000);
    expect(r.descuentoMayor).toBe(25_000);
    expect(r.faltaParaDescuento).toBe(0);
    expect(r.lineas[0]).toMatchObject({ precioUnitario: 9_500, tipo: "mayor" });
  });

  it("el monto se mide con el subtotal que ve el cliente, ofertas incluidas", () => {
    // 40 × 10.000 = 400.000 + 70 × 1.500 (oferta) = 105.000 → 505.000 (a precio normal serían 540.000)
    const r = calcularCarrito([{ varianteId: 1, cantidad: 40 }, { varianteId: 2, cantidad: 70 }], variantes, cinco);
    expect(r.subtotal).toBe(505_000);
    expect(r.descuentoActivo).toBe(true);
    // El producto en oferta (1.500) ya es mejor que el 5 % de 2.000 (1.900): conserva la oferta.
    expect(r.lineas[1]).toMatchObject({ precioUnitario: 1_500, tipo: "oferta" });
    expect(r.lineas[0]).toMatchObject({ precioUnitario: 9_500, tipo: "mayor" });
    expect(r.total).toBe(40 * 9_500 + 70 * 1_500);
  });

  it("con las ofertas el subtotal puede quedar por debajo del monto aunque a precio normal lo supere", () => {
    // 20 × 10.000 + 150 × 1.500 = 425.000 (a precio normal: 500.000)
    const r = calcularCarrito([{ varianteId: 1, cantidad: 20 }, { varianteId: 2, cantidad: 150 }], variantes, cinco);
    expect(r.subtotal).toBe(425_000);
    expect(r.descuentoActivo).toBe(false);
  });

  it("monto o porcentaje en 0 apagan el descuento", () => {
    for (const cfg of [sinDescuento, { montoMinimo: 500_000, porcentaje: 0 }, { montoMinimo: 0, porcentaje: 5 }]) {
      const r = calcularCarrito([{ varianteId: 1, cantidad: 500 }], variantes, cfg);
      expect(r.descuentoActivo).toBe(false);
      expect(r.descuentoMayor).toBe(0);
      expect(r.faltaParaDescuento).toBe(0);
    }
    expect(descuentoConfigurado(cinco)).toBe(true);
    expect(descuentoConfigurado(sinDescuento)).toBe(false);
    expect(descuentoConfigurado({ montoMinimo: 100, porcentaje: 100 })).toBe(false);
  });

  it("textoDescuento arma el aviso o devuelve null si no hay descuento", () => {
    const f = (n: number) => `$${n.toLocaleString("es-CO")}`;
    expect(textoDescuento(cinco, f)).toBe("Compras desde $500.000: 5 % de descuento");
    expect(textoDescuento(sinDescuento, f)).toBeNull();
  });
});

describe("calcularCarrito: totales e invariantes", () => {
  it("subtotal − descuento = total y todo son pesos enteros", () => {
    const variantes = new Map([[1, v({ precioUnidad: 1731 })], [2, v({ precioUnidad: 1932, enOferta: true, precioOferta: 1900 })]]);
    const r = calcularCarrito([{ varianteId: 1, cantidad: 200 }, { varianteId: 2, cantidad: 100 }], variantes, cinco);
    expect(r.descuentoActivo).toBe(true);
    expect(r.total).toBe(r.subtotal - r.descuentoMayor);
    expect(r.total).toBe(r.lineas.reduce((s, l) => s + l.subtotal, 0));
    for (const n of [r.subtotal, r.descuentoMayor, r.total]) expect(Number.isInteger(n)).toBe(true);
  });

  it("sin ofertas, el descuento real queda muy cerca del 5 % exacto (solo cambia por el redondeo por unidad)", () => {
    const variantes = new Map([[1, v({ precioUnidad: 1731 })], [2, v({ precioUnidad: 1932 })]]);
    const r = calcularCarrito([{ varianteId: 1, cantidad: 200 }, { varianteId: 2, cantidad: 100 }], variantes, cinco);
    expect(r.subtotal).toBe(200 * 1731 + 100 * 1932);
    expect(Math.abs(r.descuentoMayor - r.subtotal * 0.05)).toBeLessThan(150);
  });

  it("une líneas repetidas, ignora cantidades inválidas y reporta lo desconocido", () => {
    expect(
      agruparLineas([
        { varianteId: 1, cantidad: 2 },
        { varianteId: 1, cantidad: 3 },
        { varianteId: 2, cantidad: 0 },
        { varianteId: 3, cantidad: 1.5 },
      ]),
    ).toEqual([{ varianteId: 1, cantidad: 5 }]);
    const r = calcularCarrito([{ varianteId: 1, cantidad: 1 }, { varianteId: 99, cantidad: 2 }], new Map([[1, v()]]), sinDescuento);
    expect(r.lineas).toHaveLength(1);
    expect(r.desconocidas).toEqual([99]);
  });

  it("carrito vacío = ceros", () => {
    expect(calcularCarrito([], new Map(), cinco)).toMatchObject({ subtotal: 0, descuentoMayor: 0, total: 0, descuentoActivo: false });
  });
});

describe("faltaParaMinimo", () => {
  it("calcula lo que falta, sin números negativos", () => {
    expect(faltaParaMinimo(38000, 50000)).toBe(12000);
    expect(faltaParaMinimo(60000, 50000)).toBe(0);
    expect(faltaParaMinimo(100, 0)).toBe(0);
  });
});

describe("la tienda y el carrito muestran el mismo precio base", () => {
  // precioMostrado (detalle de producto) y precioBase/precioDeLinea sin descuento deben coincidir.
  const casos: Partial<VarianteDetalle>[] = [
    {},
    { en_oferta: true, precio_oferta: 2800 },
    { en_oferta: true, precio_oferta: 3200 },
    { en_oferta: true, precio_oferta: null },
    { en_oferta: false, precio_oferta: 2800 },
  ];
  const detalle = (extra: Partial<VarianteDetalle>): VarianteDetalle => ({
    id: 1, sku: "S", nombre_presentacion: null, contenido_valor: null, contenido_unidad: null,
    unidad_venta: "individual", unidades_por_empaque: 1, peso_g: null, alto_cm: null, ancho_cm: null, largo_cm: null,
    precio_unidad: 3200, en_oferta: false, precio_oferta: null, disponible: true,
    ...extra,
  });

  it.each(casos.map((c, i) => [i, c] as const))("caso %i", (_i, extra) => {
    const d = detalle(extra);
    const p = aPresentacion(d)!;
    const calc: VariantePrecio = {
      precioUnidad: d.precio_unidad as number,
      enOferta: d.en_oferta,
      precioOferta: d.precio_oferta,
    };
    const mostrado = precioMostrado(p);
    const cobrado = precioDeLinea(calc, false, 5);
    expect(mostrado.precio).toBe(cobrado.precio);
    expect(mostrado.tipo).toBe(cobrado.tipo);
  });
});
