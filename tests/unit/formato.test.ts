import { describe, expect, it } from "vitest";
import { formatCOP } from "@/lib/formato";

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
