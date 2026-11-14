import { describe, expect, it } from "vitest";
import { reordenar } from "@/lib/orden";

const grupo = [
  { id: 10, orden: 1 },
  { id: 20, orden: 2 },
  { id: 30, orden: 3 },
];

describe("reordenar", () => {
  it("sube un elemento intercambiándolo con el anterior", () => {
    expect(reordenar(grupo, 20, "arriba")).toEqual([
      { id: 20, orden: 1 },
      { id: 10, orden: 2 },
    ]);
  });

  it("baja un elemento intercambiándolo con el siguiente", () => {
    expect(reordenar(grupo, 20, "abajo")).toEqual([
      { id: 30, orden: 2 },
      { id: 20, orden: 3 },
    ]);
  });

  it("no hace nada en los extremos", () => {
    expect(reordenar(grupo, 10, "arriba")).toEqual([]);
    expect(reordenar(grupo, 30, "abajo")).toEqual([]);
  });

  it("devuelve [] si el elemento no existe", () => {
    expect(reordenar(grupo, 99, "arriba")).toEqual([]);
  });

  it("renumera cuando varios tienen el mismo orden (p. ej. importados en bloque)", () => {
    const iguales = [
      { id: 1, orden: 0 },
      { id: 2, orden: 0 },
      { id: 3, orden: 0 },
    ];
    // Orden estable por id: 1, 2, 3. Subir el 3 deja 1, 3, 2.
    expect(reordenar(iguales, 3, "arriba")).toEqual([
      { id: 1, orden: 1 },
      { id: 3, orden: 2 },
      { id: 2, orden: 3 },
    ]);
  });

  it("no modifica la lista original", () => {
    const copia = JSON.parse(JSON.stringify(grupo));
    reordenar(grupo, 20, "arriba");
    expect(grupo).toEqual(copia);
  });
});
