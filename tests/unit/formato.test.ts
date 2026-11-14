import { describe, expect, it } from "vitest";
import { formatCOP, formatFechaDia, formatFechaHora } from "@/lib/formato";

describe("formatCOP", () => {
  it("agrupa los miles con punto y antepone '$ '", () => {
    expect(formatCOP(12500)).toBe("$ 12.500");
    expect(formatCOP(1234)).toBe("$ 1.234");
    expect(formatCOP(1234567)).toBe("$ 1.234.567");
  });

  it("no agrega separador por debajo de mil", () => {
    expect(formatCOP(0)).toBe("$ 0");
    expect(formatCOP(950)).toBe("$ 950");
  });

  it("redondea a pesos enteros (RN-05)", () => {
    expect(formatCOP(999.6)).toBe("$ 1.000");
  });

  it("maneja valores negativos (p. ej. un ajuste)", () => {
    expect(formatCOP(-5000)).toBe("-$ 5.000");
  });
});

describe("fechas del panel", () => {
  it("formatFechaDia escribe el día sin cambiar de zona horaria", () => {
    expect(formatFechaDia("2026-11-19")).toBe("jue 19 nov 2026");
    expect(formatFechaDia("2026-01-01")).toBe("jue 1 ene 2026");
    expect(formatFechaDia(null)).toBe("—");
    expect(formatFechaDia("basura")).toBe("—");
  });

  it("formatFechaHora usa la hora de Bogotá", () => {
    // 2026-11-14T02:00Z = 13 de noviembre, 9:00 p. m. en Bogotá
    expect(formatFechaHora("2026-11-14T02:00:00Z")).toContain("13");
    expect(formatFechaHora("no es fecha")).toBe("—");
    expect(formatFechaHora(null)).toBe("—");
  });
});
