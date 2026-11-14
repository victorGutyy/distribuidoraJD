import { describe, expect, it } from "vitest";
import {
  agruparLineas,
  alcanzaMayorPorCantidad,
  calcularCarrito,
  faltaParaMinimo,
  precioBase,
  precioDeLinea,
  type VariantePrecio,
} from "@/lib/precios";
import { aPresentacion, precioMostrado, type VarianteDetalle } from "@/lib/tienda/producto";

const v = (extra: Partial<VariantePrecio> = {}): VariantePrecio => ({
  precioUnidad: 3200,
  precioMayor: null,
  cantidadMinMayor: null,
  enOferta: false,
  precioOferta: null,
  ...extra,
});
const porCantidad = { regla: "por_cantidad", umbralMonto: 0 } as const;

describe("precioBase y precioDeLinea (RN-04: siempre el menor)", () => {
  it("sin oferta ni mayor paga el precio de unidad", () => {
    expect(precioDeLinea(v(), true)).toEqual({ precio: 3200, tipo: "unidad", precioBase: 3200 });
  });

  it("la oferta vale solo si está activa y es más barata", () => {
    expect(precioBase(v({ enOferta: true, precioOferta: 2800 }))).toEqual({ precio: 2800, tipo: "oferta" });
    expect(precioBase(v({ enOferta: false, precioOferta: 2800 })).tipo).toBe("unidad");
    expect(precioBase(v({ enOferta: true, precioOferta: 3200 })).tipo).toBe("unidad");
    expect(precioBase(v({ enOferta: true, precioOferta: null })).tipo).toBe("unidad");
  });

  it("el mayor solo gana si es estrictamente más barato que la oferta", () => {
    const base = { enOferta: true, precioOferta: 2800 };
    expect(precioDeLinea(v({ ...base, precioMayor: 2500 }), true).tipo).toBe("mayor");
    expect(precioDeLinea(v({ ...base, precioMayor: 2800 }), true).tipo).toBe("oferta");
    expect(precioDeLinea(v({ ...base, precioMayor: 3000 }), true)).toMatchObject({ precio: 2800, tipo: "oferta" });
  });

  it("si el mayoreo no está activo, no se aplica", () => {
    expect(precioDeLinea(v({ precioMayor: 3000 }), false).tipo).toBe("unidad");
  });
});

describe("RN-02: mayoreo por cantidad", () => {
  const mayor = v({ precioMayor: 3000, cantidadMinMayor: 12 });

  it("alcanza al llegar a la cantidad mínima", () => {
    expect(alcanzaMayorPorCantidad(mayor, 11)).toBe(false);
    expect(alcanzaMayorPorCantidad(mayor, 12)).toBe(true);
    expect(alcanzaMayorPorCantidad(v(), 100)).toBe(false);
  });

  it("sin cantidad mínima, el mayor rige desde la primera unidad", () => {
    expect(alcanzaMayorPorCantidad(v({ precioMayor: 3000 }), 1)).toBe(true);
  });

  it("calcularCarrito aplica el mayor solo a la línea que alcanza la cantidad", () => {
    const variantes = new Map([[1, mayor], [2, mayor]]);
    const r = calcularCarrito(
      [{ varianteId: 1, cantidad: 12 }, { varianteId: 2, cantidad: 5 }],
      variantes,
      porCantidad,
    );
    expect(r.lineas[0]).toMatchObject({ precioUnitario: 3000, tipo: "mayor", subtotal: 36000 });
    expect(r.lineas[1]).toMatchObject({ precioUnitario: 3200, tipo: "unidad", subtotal: 16000 });
    expect(r.subtotal).toBe(12 * 3200 + 5 * 3200);
    expect(r.descuentoMayor).toBe(12 * 200);
    expect(r.total).toBe(36000 + 16000);
  });
});

describe("RN-03: mayoreo por monto", () => {
  const variantes = new Map([
    [1, v({ precioMayor: 3000, cantidadMinMayor: 12 })],
    [2, v({ precioUnidad: 5000 })], // sin precio por mayor
  ]);
  const cfg = { regla: "por_monto", umbralMonto: 20000 } as const;

  it("por debajo del umbral no hay mayoreo, aunque la cantidad sea alta", () => {
    const r = calcularCarrito([{ varianteId: 1, cantidad: 5 }], variantes, cfg); // 16.000
    expect(r.mayoreoPorMonto).toBe(false);
    expect(r.lineas[0].tipo).toBe("unidad");
  });

  it("al alcanzar el umbral (a precio unidad) todo lo que tenga mayor lo usa, sin pedir cantidad", () => {
    const r = calcularCarrito(
      [{ varianteId: 1, cantidad: 2 }, { varianteId: 2, cantidad: 3 }], // 6.400 + 15.000 = 21.400
      variantes,
      cfg,
    );
    expect(r.mayoreoPorMonto).toBe(true);
    expect(r.lineas[0]).toMatchObject({ tipo: "mayor", precioUnitario: 3000 });
    expect(r.lineas[1]).toMatchObject({ tipo: "unidad", precioUnitario: 5000 });
  });

  it("un umbral de 0 apaga la regla", () => {
    const r = calcularCarrito([{ varianteId: 1, cantidad: 50 }], variantes, { regla: "por_monto", umbralMonto: 0 });
    expect(r.mayoreoPorMonto).toBe(false);
  });
});

describe("calcularCarrito: totales e invariantes", () => {
  it("subtotal − descuento = total, con ofertas y mayoreo mezclados", () => {
    const variantes = new Map([
      [1, v({ precioMayor: 2500, cantidadMinMayor: 6, enOferta: true, precioOferta: 2900 })],
      [2, v({ precioUnidad: 1000 })],
    ]);
    const r = calcularCarrito([{ varianteId: 1, cantidad: 6 }, { varianteId: 2, cantidad: 3 }], variantes, porCantidad);
    expect(r.lineas[0]).toMatchObject({ tipo: "mayor", precioBase: 2900, precioUnitario: 2500 });
    expect(r.subtotal).toBe(6 * 2900 + 3000);
    expect(r.descuentoMayor).toBe(6 * 400);
    expect(r.total).toBe(r.subtotal - r.descuentoMayor);
    expect(r.total).toBe(r.lineas.reduce((s, l) => s + l.subtotal, 0));
  });

  it("une líneas repetidas, ignora cantidades inválidas y reporta lo desconocido", () => {
    expect(agruparLineas([{ varianteId: 1, cantidad: 2 }, { varianteId: 1, cantidad: 3 }, { varianteId: 2, cantidad: 0 }, { varianteId: 3, cantidad: 1.5 }])).toEqual([
      { varianteId: 1, cantidad: 5 },
    ]);
    const r = calcularCarrito([{ varianteId: 1, cantidad: 1 }, { varianteId: 99, cantidad: 2 }], new Map([[1, v()]]), porCantidad);
    expect(r.lineas).toHaveLength(1);
    expect(r.desconocidas).toEqual([99]);
  });

  it("carrito vacío = ceros", () => {
    expect(calcularCarrito([], new Map(), porCantidad)).toMatchObject({ subtotal: 0, descuentoMayor: 0, total: 0 });
  });

  it("todos los resultados son pesos enteros", () => {
    const r = calcularCarrito([{ varianteId: 1, cantidad: 7 }], new Map([[1, v({ precioMayor: 2999, cantidadMinMayor: 3 })]]), porCantidad);
    for (const n of [r.subtotal, r.descuentoMayor, r.total]) expect(Number.isInteger(n)).toBe(true);
  });
});

describe("faltaParaMinimo", () => {
  it("calcula lo que falta, sin números negativos", () => {
    expect(faltaParaMinimo(38000, 50000)).toBe(12000);
    expect(faltaParaMinimo(60000, 50000)).toBe(0);
    expect(faltaParaMinimo(100, 0)).toBe(0);
  });
});

describe("la tienda y el carrito calculan lo mismo", () => {
  // precioMostrado (detalle de producto) y precioDeLinea (pedido) deben coincidir siempre.
  const casos: Partial<VarianteDetalle>[] = [
    {},
    { precio_mayor: 3000, cantidad_min_mayor: 12 },
    { precio_mayor: 3000 },
    { en_oferta: true, precio_oferta: 2800 },
    { en_oferta: true, precio_oferta: 2800, precio_mayor: 2500, cantidad_min_mayor: 6 },
    { en_oferta: true, precio_oferta: 2500, precio_mayor: 2800, cantidad_min_mayor: 6 },
    { en_oferta: true, precio_oferta: 2800, precio_mayor: 2800, cantidad_min_mayor: 6 },
  ];
  const detalle = (extra: Partial<VarianteDetalle>): VarianteDetalle => ({
    id: 1, sku: "S", nombre_presentacion: null, contenido_valor: null, contenido_unidad: null,
    unidad_venta: "individual", unidades_por_empaque: 1, peso_g: null, alto_cm: null, ancho_cm: null, largo_cm: null,
    precio_unidad: 3200, precio_mayor: null, cantidad_min_mayor: null, en_oferta: false, precio_oferta: null, disponible: true,
    ...extra,
  });

  it.each(casos.map((c, i) => [i, c] as const))("caso %i", (_i, extra) => {
    const d = detalle(extra);
    const p = aPresentacion(d)!;
    const calc: VariantePrecio = {
      precioUnidad: d.precio_unidad as number,
      precioMayor: d.precio_mayor,
      cantidadMinMayor: d.cantidad_min_mayor,
      enOferta: d.en_oferta,
      precioOferta: d.precio_oferta,
    };
    for (const cantidad of [1, 5, 6, 12, 50]) {
      const mostrado = precioMostrado(p, cantidad);
      const cobrado = precioDeLinea(calc, alcanzaMayorPorCantidad(calc, cantidad));
      expect({ precio: mostrado.precio, tipo: mostrado.tipo }).toEqual({ precio: cobrado.precio, tipo: cobrado.tipo });
    }
  });
});
