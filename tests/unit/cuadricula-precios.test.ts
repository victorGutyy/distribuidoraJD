import { describe, expect, it } from "vitest";
import {
  aFilaPrecio,
  filaCambiada,
  idsModificados,
  valoresDesdeFila,
  type FilaPrecio,
} from "@/lib/catalogo/cuadricula-precios";
import { edicionPrecioSchema } from "@/lib/validaciones/precios";

const fila: FilaPrecio = {
  id: 7,
  sku: "EVC-00007-01",
  producto_nombre: "Arroz",
  nombre_presentacion: "500 g",
  marca_nombre: null,
  precio_unidad: 3200,
  precio_mayor: null,
  cantidad_min_mayor: null,
  en_oferta: false,
  precio_oferta: null,
  disponible: true,
};

describe("valoresDesdeFila y filaCambiada", () => {
  it("lo sin precio queda como texto vacío", () => {
    expect(valoresDesdeFila({ ...fila, precio_unidad: null }).precio_unidad).toBe("");
  });

  it("escribir lo mismo de otra forma no es un cambio", () => {
    const base = valoresDesdeFila(fila);
    expect(filaCambiada(base, { ...base, precio_unidad: "3.200" })).toBe(false);
    expect(filaCambiada(base, { ...base, precio_unidad: " 3200 " })).toBe(false);
  });

  it("detecta cambios de precio, de oferta y de disponibilidad", () => {
    const base = valoresDesdeFila(fila);
    expect(filaCambiada(base, { ...base, precio_unidad: "3500" })).toBe(true);
    expect(filaCambiada(base, { ...base, precio_mayor: "3000" })).toBe(true);
    expect(filaCambiada(base, { ...base, en_oferta: true })).toBe(true);
    expect(filaCambiada(base, { ...base, disponible: false })).toBe(true);
    // Borrar un precio también es un cambio.
    expect(filaCambiada(base, { ...base, precio_unidad: "" })).toBe(true);
  });

  it("idsModificados devuelve solo las filas distintas", () => {
    const base = { 1: valoresDesdeFila(fila), 2: valoresDesdeFila({ ...fila, id: 2 }) };
    const actual = { 1: base[1], 2: { ...base[2], precio_unidad: "1000" } };
    expect(idsModificados(base, actual)).toEqual([2]);
  });
});

describe("aFilaPrecio", () => {
  it("descarta filas sin id o sin SKU y pone valores por defecto", () => {
    const v = {
      id: 1, sku: "A", producto_nombre: "P", nombre_presentacion: null, marca_nombre: null,
      precio_unidad: null, precio_mayor: null, cantidad_min_mayor: null, en_oferta: null,
      precio_oferta: null, disponible: null,
    };
    const r = aFilaPrecio(v as never);
    expect(r?.en_oferta).toBe(false);
    expect(r?.disponible).toBe(true);
    expect(aFilaPrecio({ ...v, id: null } as never)).toBeNull();
  });
});

describe("edicionPrecioSchema (editor rápido)", () => {
  const ok = {
    id: 7, precio_unidad: "3.200", precio_mayor: "3000", cantidad_min_mayor: "12",
    en_oferta: false, precio_oferta: "", disponible: true,
  };

  it("convierte el texto a números y lo vacío a null (borra el dato)", () => {
    const r = edicionPrecioSchema.safeParse({ ...ok, precio_mayor: "", cantidad_min_mayor: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toMatchObject({ precio_unidad: 3200, precio_mayor: null, cantidad_min_mayor: null });
    }
  });

  it("aplica las mismas reglas que el formulario de producto", () => {
    expect(edicionPrecioSchema.safeParse({ ...ok, precio_mayor: "4000" }).success).toBe(false);
    expect(edicionPrecioSchema.safeParse({ ...ok, precio_unidad: "", precio_mayor: "100" }).success).toBe(false);
    expect(edicionPrecioSchema.safeParse({ ...ok, en_oferta: true }).success).toBe(false);
    expect(edicionPrecioSchema.safeParse({ ...ok, en_oferta: true, precio_oferta: "3200" }).success).toBe(false);
    expect(edicionPrecioSchema.safeParse({ ...ok, en_oferta: true, precio_oferta: "2900" }).success).toBe(true);
    expect(edicionPrecioSchema.safeParse({ ...ok, precio_unidad: "12,5" }).success).toBe(false);
  });
});
