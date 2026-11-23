import { describe, expect, it } from "vitest";
import {
  inicioDelMes,
  leerFiltrosInventario,
  leerResumenCostos,
  urlInventario,
} from "@/lib/inventario";

describe("leerFiltrosInventario", () => {
  it("sin parámetros: todos, sin búsqueda, página 1", () => {
    expect(leerFiltrosInventario({})).toEqual({ q: "", estado: "todos", pagina: 1 });
  });

  it("lee la búsqueda, el estado y la página", () => {
    expect(leerFiltrosInventario({ q: "  arroz ", estado: "sin_stock", pagina: "3" })).toEqual({
      q: "arroz",
      estado: "sin_stock",
      pagina: 3,
    });
  });

  it("un estado desconocido o una página inválida caen en valores seguros", () => {
    expect(leerFiltrosInventario({ estado: "hackeado", pagina: "-2" })).toMatchObject({
      estado: "todos",
      pagina: 1,
    });
    expect(leerFiltrosInventario({ pagina: "abc" }).pagina).toBe(1);
    expect(leerFiltrosInventario({ pagina: "2.5" }).pagina).toBe(1);
  });

  it("si el parámetro viene repetido toma el primero y recorta búsquedas largas", () => {
    expect(leerFiltrosInventario({ estado: ["poco", "negativo"] }).estado).toBe("poco");
    expect(leerFiltrosInventario({ q: "x".repeat(200) }).q).toHaveLength(60);
  });
});

describe("urlInventario", () => {
  const base = { q: "", estado: "todos" as const, pagina: 1 };

  it("sin filtros es la ruta pelada", () => {
    expect(urlInventario(base)).toBe("/admin/inventario");
  });

  it("conserva los filtros y cambia solo lo pedido", () => {
    const f = { q: "café", estado: "poco" as const, pagina: 2 };
    expect(urlInventario(f, { pagina: 3 })).toBe("/admin/inventario?q=caf%C3%A9&estado=poco&pagina=3");
    expect(urlInventario(f, { pagina: 1 })).toBe("/admin/inventario?q=caf%C3%A9&estado=poco");
    expect(urlInventario(f, { estado: "todos", q: "" , pagina: 1 })).toBe("/admin/inventario");
  });
});

describe("inicioDelMes", () => {
  it("devuelve el primer día del mes a medianoche de Colombia", () => {
    expect(inicioDelMes("2026-11-23")).toBe("2026-11-01T00:00:00-05:00");
    expect(inicioDelMes("2026-01-01")).toBe("2026-01-01T00:00:00-05:00");
  });
});

describe("leerResumenCostos", () => {
  it("convierte el JSON de la función SQL", () => {
    const r = leerResumenCostos({
      pedidos: { pedidos: 4, venta: 120000, ganancia: 18000, venta_con_costo: 100000, lineas_sin_costo: 2 },
      inventario: { valor_inventario: 5_000_000, con_stock: 900, sin_stock: 612, negativos: 29, sin_costo: 1100 },
    });
    expect(r.pedidos).toEqual({ cantidad: 4, venta: 120000, ganancia: 18000, ventaConCosto: 100000, lineasSinCosto: 2 });
    expect(r.inventario).toEqual({ valor: 5_000_000, conStock: 900, sinStock: 612, negativos: 29, sinCosto: 1100 });
  });

  it("con datos raros o vacíos devuelve ceros, nunca revienta", () => {
    for (const malo of [null, undefined, "x", 5, [], { pedidos: "no" }]) {
      const r = leerResumenCostos(malo);
      expect(r.pedidos.ganancia).toBe(0);
      expect(r.inventario.valor).toBe(0);
    }
  });
});
