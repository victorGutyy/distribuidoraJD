import { describe, expect, it } from "vitest";
import { CONFIG_ENTREGA_POR_DEFECTO } from "@/lib/entregas";
import { resolverEntrega, ubicacionEfectiva, type ZonaPublica } from "@/lib/ubicacion";

const zonas: ZonaPublica[] = [
  { id: 1, nombre: "Calarcá", sectores: [{ id: 10, nombre: "Barrio Centro", diasReparto: [4], costoEnvio: 3000 }] },
  { id: 2, nombre: "Armenia", sectores: [{ id: 20, nombre: "Norte", diasReparto: [], costoEnvio: 0 }] },
];
const lunes = new Date("2026-11-09T15:00:00Z"); // lunes 10:00 en Bogotá

describe("resolverEntrega", () => {
  it("sin ubicación no hay entrega", () => {
    expect(resolverEntrega(null, zonas, lunes, CONFIG_ENTREGA_POR_DEFECTO)).toBeNull();
  });

  it("sector: lugar, costo y próximo día de reparto", () => {
    expect(resolverEntrega({ tipo: "sector", municipioId: 1, sectorId: 10 }, zonas, lunes, CONFIG_ENTREGA_POR_DEFECTO)).toEqual({
      esBodega: false, lugar: "Calarcá – Barrio Centro", sectorId: 10, costoEnvio: 3000, fecha: "2026-11-12",
    });
  });

  it("bodega: sin envío y siguiente día hábil", () => {
    expect(resolverEntrega({ tipo: "bodega" }, zonas, lunes, CONFIG_ENTREGA_POR_DEFECTO)).toEqual({
      esBodega: true, lugar: "Recoger en bodega", sectorId: null, costoEnvio: 0, fecha: "2026-11-10",
    });
  });

  it("una zona que ya no existe (o que no coincide con su municipio) no es válida", () => {
    expect(resolverEntrega({ tipo: "sector", municipioId: 1, sectorId: 99 }, zonas, lunes, CONFIG_ENTREGA_POR_DEFECTO)).toBeNull();
    expect(resolverEntrega({ tipo: "sector", municipioId: 2, sectorId: 10 }, zonas, lunes, CONFIG_ENTREGA_POR_DEFECTO)).toBeNull();
  });

  it("un sector sin días de reparto devuelve fecha null", () => {
    expect(resolverEntrega({ tipo: "sector", municipioId: 2, sectorId: 20 }, zonas, lunes, CONFIG_ENTREGA_POR_DEFECTO)?.fecha).toBeNull();
  });
});

describe("ubicacionEfectiva", () => {
  it("sin zonas solo se puede recoger en bodega", () => {
    expect(ubicacionEfectiva(null, [])).toEqual({ tipo: "bodega" });
    expect(ubicacionEfectiva(null, zonas)).toBeNull();
    expect(ubicacionEfectiva({ tipo: "bodega" }, zonas)).toEqual({ tipo: "bodega" });
  });
});
