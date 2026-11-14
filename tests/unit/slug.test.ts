import { describe, expect, it } from "vitest";
import { slugUnico, slugify } from "@/lib/slug";

describe("slugify", () => {
  it("quita tildes y ñ y usa guiones", () => {
    expect(slugify("Lentejas Doña Lupe")).toBe("lentejas-dona-lupe");
    expect(slugify("Jabón de tocador")).toBe("jabon-de-tocador");
    expect(slugify("Cuidado oral")).toBe("cuidado-oral");
  });

  it("convierte símbolos y signos en guiones sin repetirlos", () => {
    expect(slugify("Útiles escolares  y   oficina!!")).toBe(
      "utiles-escolares-y-oficina",
    );
    expect(slugify("Pague 1, lleve 2")).toBe("pague-1-lleve-2");
    expect(slugify("  --Hola--  ")).toBe("hola");
  });

  it("traduce el & a 'y'", () => {
    expect(slugify("Hogar & ferretería")).toBe("hogar-y-ferreteria");
  });

  it("conserva los números", () => {
    expect(slugify("Velón #12")).toBe("velon-12");
    expect(slugify("Atún 140 g")).toBe("atun-140-g");
  });

  it("devuelve vacío si no queda ningún carácter válido", () => {
    expect(slugify("¡¡¡???")).toBe("");
    expect(slugify("")).toBe("");
  });

  it("respeta el largo máximo sin dejar un guion al final", () => {
    const s = slugify("palabra ".repeat(30), 20);
    expect(s.length).toBeLessThanOrEqual(20);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("slugUnico", () => {
  it("devuelve la base si está libre", () => {
    expect(slugUnico("granos", [])).toBe("granos");
    expect(slugUnico("granos", ["enlatados"])).toBe("granos");
  });

  it("agrega un sufijo numérico si ya existe", () => {
    expect(slugUnico("granos", ["granos"])).toBe("granos-2");
    expect(slugUnico("granos", ["granos", "granos-2"])).toBe("granos-3");
  });

  it("acepta un Set y salta los números ocupados", () => {
    expect(slugUnico("a", new Set(["a", "a-2", "a-3"]))).toBe("a-4");
  });

  it("usa 'sin-nombre' cuando la base está vacía", () => {
    expect(slugUnico("", [])).toBe("sin-nombre");
    expect(slugUnico("", ["sin-nombre"])).toBe("sin-nombre-2");
  });
});
