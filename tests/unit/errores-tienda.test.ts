import { describe, expect, it } from "vitest";
import { esRangoVacio, exigir } from "@/lib/tienda/errores";

describe("exigir", () => {
  it("no hace nada si la consulta salió bien", () => {
    expect(() => exigir(null, "el catálogo")).not.toThrow();
    expect(() => exigir(undefined, "el catálogo")).not.toThrow();
  });

  it("lanza con un mensaje que dice qué se leía (así no se guarda un vacío en la caché)", () => {
    expect(() => exigir({ code: "57014", message: "canceling statement due to statement timeout" }, "el catálogo")).toThrow(
      /el catálogo \(57014\): canceling statement/,
    );
  });

  it("funciona aunque el error no traiga código ni mensaje", () => {
    expect(() => exigir({}, "las categorías")).toThrow(/las categorías: sin detalle/);
  });
});

describe("esRangoVacio", () => {
  it("solo la página fuera de rango es «normal»; un tiempo de espera NO", () => {
    expect(esRangoVacio({ code: "PGRST103" })).toBe(true);
    expect(esRangoVacio({ code: "57014" })).toBe(false);
    expect(esRangoVacio(null)).toBe(false);
  });
});
