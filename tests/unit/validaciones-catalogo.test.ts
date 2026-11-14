import { describe, expect, it } from "vitest";
import {
  categoriaSchema,
  idDeFormulario,
  marcaSchema,
} from "@/lib/validaciones/catalogo";
import { erroresPorCampo } from "@/lib/validaciones/comun";

describe("categoriaSchema", () => {
  it("acepta una categoría principal (parent vacío)", () => {
    const r = categoriaSchema.safeParse({
      nombre: "  Víveres y despensa ",
      parent_id: "",
      activa: true,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.nombre).toBe("Víveres y despensa");
      expect(r.data.parent_id).toBeNull();
    }
  });

  it("acepta una subcategoría y convierte el id a número", () => {
    const r = categoriaSchema.safeParse({
      nombre: "Granos",
      parent_id: "3",
      activa: false,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.parent_id).toBe(3);
  });

  it("rechaza nombre vacío o demasiado largo", () => {
    const vacio = categoriaSchema.safeParse({
      nombre: " ",
      parent_id: "",
      activa: true,
    });
    expect(vacio.success).toBe(false);
    if (!vacio.success) {
      expect(erroresPorCampo(vacio.error).nombre?.[0]).toBe(
        "Escribe el nombre",
      );
    }
    const largo = categoriaSchema.safeParse({
      nombre: "x".repeat(81),
      parent_id: "",
      activa: true,
    });
    expect(largo.success).toBe(false);
  });

  it("rechaza un parent_id que no sea un entero positivo", () => {
    for (const malo of ["abc", "-1", "0", "2.5"]) {
      expect(
        categoriaSchema.safeParse({
          nombre: "X",
          parent_id: malo,
          activa: true,
        }).success,
      ).toBe(false);
    }
  });
});

describe("marcaSchema e idDeFormulario", () => {
  it("valida el nombre de la marca", () => {
    expect(
      marcaSchema.safeParse({ nombre: "Doña Lupe", activa: true }).success,
    ).toBe(true);
    expect(marcaSchema.safeParse({ nombre: "", activa: true }).success).toBe(
      false,
    );
  });

  it("idDeFormulario solo acepta enteros positivos", () => {
    expect(idDeFormulario.safeParse("12").success).toBe(true);
    expect(idDeFormulario.safeParse("").success).toBe(false);
    expect(idDeFormulario.safeParse("x").success).toBe(false);
    expect(idDeFormulario.safeParse("0").success).toBe(false);
  });
});
