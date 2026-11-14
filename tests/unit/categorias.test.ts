import { describe, expect, it } from "vitest";
import { idsConHijas, opcionesCategoria } from "@/lib/catalogo/categorias";

const cats = [
  { id: 2, nombre: "Aseo", parent_id: null, orden: 2 },
  { id: 1, nombre: "Víveres", parent_id: null, orden: 1 },
  { id: 12, nombre: "Granos", parent_id: 1, orden: 2 },
  { id: 11, nombre: "Enlatados", parent_id: 1, orden: 1 },
  { id: 21, nombre: "Jabones", parent_id: 2, orden: 1 },
];

describe("opcionesCategoria", () => {
  it("lista cada principal seguida de sus subcategorías, en el orden del panel", () => {
    expect(opcionesCategoria(cats)).toEqual([
      { valor: "1", etiqueta: "Víveres" },
      { valor: "11", etiqueta: "Víveres › Enlatados" },
      { valor: "12", etiqueta: "Víveres › Granos" },
      { valor: "2", etiqueta: "Aseo" },
      { valor: "21", etiqueta: "Aseo › Jabones" },
    ]);
  });

  it("devuelve una lista vacía sin categorías", () => {
    expect(opcionesCategoria([])).toEqual([]);
  });
});

describe("idsConHijas", () => {
  it("una principal incluye sus subcategorías", () => {
    expect(idsConHijas(cats, 1).sort((a, b) => a - b)).toEqual([1, 11, 12]);
  });

  it("una subcategoría solo se incluye a sí misma", () => {
    expect(idsConHijas(cats, 21)).toEqual([21]);
  });
});
