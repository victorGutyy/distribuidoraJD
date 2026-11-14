import { describe, expect, it } from "vitest";
import { sectorSchema } from "@/lib/validaciones/zonas";

const base = { municipio_id: "3", nombre: "Barrio Centro", dias: ["4", "2"], costo_envio: "3.000", activo: true };

describe("sectorSchema", () => {
  it("convierte el formulario a números y ordena los días", () => {
    const r = sectorSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({ municipio_id: 3, nombre: "Barrio Centro", dias: [2, 4], costo_envio: 3000, activo: true });
    }
  });

  it("el costo vacío es 0 y los días repetidos o inválidos se limpian", () => {
    const r = sectorSchema.safeParse({ ...base, costo_envio: "", dias: ["1", "1", "9", "x"] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({ costo_envio: 0, dias: [1] });
  });

  it("exige al menos un día, un nombre y un costo en pesos enteros", () => {
    expect(sectorSchema.safeParse({ ...base, dias: [] }).success).toBe(false);
    expect(sectorSchema.safeParse({ ...base, dias: ["9"] }).success).toBe(false);
    expect(sectorSchema.safeParse({ ...base, nombre: "  " }).success).toBe(false);
    expect(sectorSchema.safeParse({ ...base, costo_envio: "3,5" }).success).toBe(false);
    expect(sectorSchema.safeParse({ ...base, municipio_id: "" }).success).toBe(false);
  });
});
