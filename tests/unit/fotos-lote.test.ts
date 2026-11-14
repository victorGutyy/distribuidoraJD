import { describe, expect, it } from "vitest";
import {
  agruparFotos,
  parsearNombreFoto,
  planearSubida,
  skuDeProducto,
} from "@/lib/catalogo/fotos-lote";

describe("parsearNombreFoto", () => {
  it("lee el SKU y el número de foto", () => {
    expect(parsearNombreFoto("EVC-00001.jpg")).toEqual({ sku: "EVC-00001", orden: 1 });
    expect(parsearNombreFoto("EVC-00001_2.JPEG")).toEqual({ sku: "EVC-00001", orden: 2 });
    expect(parsearNombreFoto("evc-00123_10.png")).toEqual({ sku: "EVC-00123", orden: 10 });
    expect(parsearNombreFoto("  EVC-00001.webp ")).toEqual({ sku: "EVC-00001", orden: 1 });
  });

  it("si trae el SKU de una presentación, usa el de su producto", () => {
    expect(parsearNombreFoto("EVC-00001-01.jpg")?.sku).toBe("EVC-00001");
    expect(parsearNombreFoto("EV-00005-01_3.jpg")).toEqual({ sku: "EV-00005", orden: 3 });
    expect(skuDeProducto("EVC-00001")).toBe("EVC-00001");
    expect(skuDeProducto("EVC-00001-12")).toBe("EVC-00001");
  });

  it("rechaza nombres que no sirven", () => {
    for (const malo of ["foto.gif", "EVC-00001", "EVC-00001_0.jpg", "EVC-00001_11.jpg", "EVC-00001_a.jpg", "EVC-00001_2_3.jpg", "../x.jpg", "EVC 1.jpg", ".jpg", "a/b.jpg"]) {
      expect(parsearNombreFoto(malo)).toBeNull();
    }
  });
});

describe("agruparFotos", () => {
  const e = (nombre: string) => ({ archivo: nombre, nombre });

  it("agrupa por producto y ordena por número", () => {
    const { grupos, invalidos, repetidos } = agruparFotos([e("EVC-00002_2.jpg"), e("EVC-00001.jpg"), e("EVC-00002.jpg"), e("raro.txt"), e("EVC-00001.png")]);
    expect(grupos.map((g) => [g.sku, g.archivos.map((a) => a.orden)])).toEqual([["EVC-00001", [1]], ["EVC-00002", [1, 2]]]);
    expect(invalidos).toEqual(["raro.txt"]);
    expect(repetidos).toEqual(["EVC-00001.png"]);
  });

  it("el SKU de presentación y el de producto cuentan como el mismo producto", () => {
    const { grupos, repetidos } = agruparFotos([e("EVC-00001.jpg"), e("EVC-00001-01.jpg")]);
    expect(grupos).toHaveLength(1);
    expect(repetidos).toEqual(["EVC-00001-01.jpg"]);
  });
});

describe("planearSubida", () => {
  const grupos = [
    { sku: "A", archivos: [{ archivo: "a1", orden: 1 }, { archivo: "a2", orden: 2 }] },
    { sku: "B", archivos: [{ archivo: "b1", orden: 1 }] },
    { sku: "C", archivos: [{ archivo: "c1", orden: 1 }] },
    { sku: "D", archivos: [{ archivo: "d1", orden: 1 }, { archivo: "d2", orden: 2 }, { archivo: "d3", orden: 3 }] },
  ];
  const productos = {
    A: { productoId: 1, nombre: "Uno", imagenes: 0 },
    B: { productoId: 2, nombre: "Dos", imagenes: 1 },
    D: { productoId: 4, nombre: "Cuatro", imagenes: 8 },
  };

  it("omite los productos que ya tienen foto y avisa de los SKU que no existen", () => {
    const p = planearSubida(grupos, productos, { omitirConFoto: true, maxPorProducto: 10 });
    expect(p.porSubir.map((x) => x.sku)).toEqual(["A"]);
    expect(p.yaTienenFoto).toEqual(["B", "D"]);
    expect(p.sinProducto).toEqual(["C"]);
  });

  it("sin omitir, respeta el máximo de fotos por producto", () => {
    const p = planearSubida(grupos, productos, { omitirConFoto: false, maxPorProducto: 10 });
    expect(p.porSubir.map((x) => [x.sku, x.archivos.length])).toEqual([["A", 2], ["B", 1], ["D", 2]]);
    expect(p.recortadas).toBe(1); // D traía 3 y solo caben 2
  });
});
