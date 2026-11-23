import { describe, expect, it } from "vitest";
import {
  calcularGanancia,
  estadoMargen,
  estadoStock,
  formatPorcentaje,
  formatStock,
  gananciaLinea,
  valorInventario,
} from "@/lib/costos";

describe("calcularGanancia", () => {
  it("precio menos costo, y el margen con un decimal", () => {
    expect(calcularGanancia(10042, 9081)).toEqual({ ganancia: 961, margenPct: 9.6 });
    expect(calcularGanancia(1000, 800)).toEqual({ ganancia: 200, margenPct: 20 });
  });

  it("vender por debajo del costo da ganancia negativa", () => {
    expect(calcularGanancia(1400, 2350)).toEqual({ ganancia: -950, margenPct: -67.9 });
  });

  it("sin precio o sin costo no se inventa un cero", () => {
    expect(calcularGanancia(null, 800)).toBeNull();
    expect(calcularGanancia(1000, null)).toBeNull();
    expect(calcularGanancia(undefined, undefined)).toBeNull();
    expect(calcularGanancia(0, 500)).toBeNull();
  });

  it("un costo en 0 es un dato válido (regalo o muestra): margen 100 %", () => {
    expect(calcularGanancia(1000, 0)).toEqual({ ganancia: 1000, margenPct: 100 });
  });
});

describe("estadoMargen", () => {
  it("avisa cuando el precio queda por debajo del costo", () => {
    expect(estadoMargen(4450, 4500)).toBe("perdida");
  });
  it("margen bajo si gana menos del 5 %", () => {
    expect(estadoMargen(1000, 970)).toBe("bajo");
    expect(estadoMargen(1000, 950)).toBe("ok");
  });
  it("sin dato cuando falta algo", () => {
    expect(estadoMargen(1000, null)).toBe("sin_dato");
  });
  it("ganancia exactamente 0 es margen bajo, no pérdida", () => {
    expect(estadoMargen(1000, 1000)).toBe("bajo");
  });
});

describe("estadoStock", () => {
  it("clasifica las existencias", () => {
    expect(estadoStock(null)).toBe("sin_dato");
    expect(estadoStock(-2)).toBe("negativo");
    expect(estadoStock(0)).toBe("agotado");
    expect(estadoStock(5)).toBe("bajo");
    expect(estadoStock(6)).toBe("ok");
  });
});

describe("valorInventario", () => {
  it("stock por costo", () => {
    expect(valorInventario(66, 9081)).toBe(599346);
  });
  it("el stock cero, negativo o sin costo no suma", () => {
    expect(valorInventario(0, 1000)).toBe(0);
    expect(valorInventario(-3, 1000)).toBe(0);
    expect(valorInventario(10, null)).toBe(0);
    expect(valorInventario(null, 1000)).toBe(0);
  });
});

describe("gananciaLinea", () => {
  it("usa el costo copiado al crear el pedido", () => {
    expect(gananciaLinea(3, 1635, 1549)).toBe(258);
  });
  it("sin costo copiado no se puede saber", () => {
    expect(gananciaLinea(3, 1635, null)).toBeNull();
  });
});

describe("formato", () => {
  it("porcentaje con coma", () => {
    expect(formatPorcentaje(14.9)).toBe("14,9 %");
    expect(formatPorcentaje(20)).toBe("20,0 %");
    expect(formatPorcentaje(-67.9)).toBe("-67,9 %");
  });
  it("existencias con punto de miles y signo", () => {
    expect(formatStock(1672)).toBe("1.672");
    expect(formatStock(-17)).toBe("-17");
    expect(formatStock(229529)).toBe("229.529");
  });
});
