import { describe, expect, it } from "vitest";
import { parsearDecimal, parsearEntero, parsearEnteroConSigno, parsearPesos } from "@/lib/numeros";

describe("parsearEnteroConSigno (existencias)", () => {
  it("acepta positivos, cero y negativos", () => {
    expect(parsearEnteroConSigno("66")).toBe(66);
    expect(parsearEnteroConSigno("0")).toBe(0);
    expect(parsearEnteroConSigno("-17")).toBe(-17);
  });
  it("acepta punto de miles", () => {
    expect(parsearEnteroConSigno("1.672")).toBe(1672);
    expect(parsearEnteroConSigno("-1.672")).toBe(-1672);
  });
  it("rechaza decimales, grupos mal puestos y texto", () => {
    expect(parsearEnteroConSigno("1.5")).toBeNull();
    expect(parsearEnteroConSigno("1,5")).toBeNull();
    expect(parsearEnteroConSigno("1.23")).toBeNull();
    expect(parsearEnteroConSigno("abc")).toBeNull();
    expect(parsearEnteroConSigno("--3")).toBeNull();
    expect(parsearEnteroConSigno("")).toBeNull();
  });
});

describe("parsearPesos", () => {
  it("lee enteros simples y con separador de miles", () => {
    expect(parsearPesos("3200")).toBe(3200);
    expect(parsearPesos("3.200")).toBe(3200);
    expect(parsearPesos("12.500")).toBe(12500);
    expect(parsearPesos("1.234.567")).toBe(1234567);
    expect(parsearPesos("0")).toBe(0);
  });

  it("ignora el símbolo $ y los espacios", () => {
    expect(parsearPesos("$ 12.500")).toBe(12500);
    expect(parsearPesos(" $3200 ")).toBe(3200);
  });

  it("rechaza decimales: los precios son pesos enteros (RN-05)", () => {
    expect(parsearPesos("3.2")).toBeNull();
    expect(parsearPesos("12,5")).toBeNull();
    expect(parsearPesos("3200.50")).toBeNull();
  });

  it("rechaza grupos de miles mal puestos, signos y texto", () => {
    expect(parsearPesos("1.23")).toBeNull();
    expect(parsearPesos("12.5000")).toBeNull();
    expect(parsearPesos("-500")).toBeNull();
    expect(parsearPesos("abc")).toBeNull();
    expect(parsearPesos("")).toBeNull();
  });
});

describe("parsearEntero", () => {
  it("solo acepta dígitos", () => {
    expect(parsearEntero("12")).toBe(12);
    expect(parsearEntero(" 7 ")).toBe(7);
    expect(parsearEntero("1.000")).toBeNull();
    expect(parsearEntero("-1")).toBeNull();
    expect(parsearEntero("2,5")).toBeNull();
    expect(parsearEntero("")).toBeNull();
  });
});

describe("parsearDecimal", () => {
  it("acepta coma o punto como separador decimal", () => {
    expect(parsearDecimal("0,5")).toBe(0.5);
    expect(parsearDecimal("0.5")).toBe(0.5);
    expect(parsearDecimal("250")).toBe(250);
    expect(parsearDecimal("1,25")).toBe(1.25);
  });

  it("rechaza texto, signos y separadores dobles", () => {
    expect(parsearDecimal("abc")).toBeNull();
    expect(parsearDecimal("-1")).toBeNull();
    expect(parsearDecimal("1,2,3")).toBeNull();
    expect(parsearDecimal("")).toBeNull();
  });
});
