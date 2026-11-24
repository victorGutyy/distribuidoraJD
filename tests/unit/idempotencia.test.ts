import { describe, expect, it } from "vitest";
import { claveParaPedido, firmaDelCarrito, leerClaveGuardada } from "@/lib/idempotencia";

describe("firmaDelCarrito", () => {
  it("no depende del orden de las líneas", () => {
    const a = firmaDelCarrito([{ varianteId: 2, cantidad: 1 }, { varianteId: 1, cantidad: 3 }], 5000);
    const b = firmaDelCarrito([{ varianteId: 1, cantidad: 3 }, { varianteId: 2, cantidad: 1 }], 5000);
    expect(a).toBe(b);
  });
  it("cambia si cambia una cantidad o el total", () => {
    const base = firmaDelCarrito([{ varianteId: 1, cantidad: 3 }], 5000);
    expect(firmaDelCarrito([{ varianteId: 1, cantidad: 4 }], 5000)).not.toBe(base);
    expect(firmaDelCarrito([{ varianteId: 1, cantidad: 3 }], 5100)).not.toBe(base);
  });
});

describe("claveParaPedido", () => {
  it("reutiliza la clave si el carrito es el mismo (reintento tras perder la conexión)", () => {
    const g = { clave: "abc", firma: "1x1|100" };
    expect(claveParaPedido(g, "1x1|100", () => "nueva")).toEqual(g);
  });
  it("genera otra si el carrito cambió o no había clave", () => {
    expect(claveParaPedido({ clave: "abc", firma: "1x1|100" }, "1x2|200", () => "nueva")).toEqual({ clave: "nueva", firma: "1x2|200" });
    expect(claveParaPedido(null, "f", () => "nueva")).toEqual({ clave: "nueva", firma: "f" });
  });
});

describe("leerClaveGuardada", () => {
  it("lee lo válido y descarta lo dañado", () => {
    expect(leerClaveGuardada('{"clave":"a","firma":"b"}')).toEqual({ clave: "a", firma: "b" });
    expect(leerClaveGuardada("no json")).toBeNull();
    expect(leerClaveGuardada('{"clave":1}')).toBeNull();
    expect(leerClaveGuardada(null)).toBeNull();
  });
});
