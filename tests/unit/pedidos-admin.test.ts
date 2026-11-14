import { describe, expect, it } from "vitest";
import {
  agruparPorSector,
  fechaValida,
  hayFiltrosPedidos,
  leerFiltrosPedidos,
  textoParaBuscar,
  urlPedidos,
} from "@/lib/filtros-pedidos";
import {
  celularParaWhatsApp,
  esEditable,
  esEstadoPedido,
  esFinal,
  puedeCambiarEstado,
  puedeCancelarse,
  puedeEditarItems,
  siguienteEstado,
} from "@/lib/pedidos";

describe("flujo de estados (RF-27)", () => {
  it("avanza de uno en uno hasta entregado", () => {
    expect(siguienteEstado("nuevo")).toBe("confirmado");
    expect(siguienteEstado("confirmado")).toBe("en_preparacion");
    expect(siguienteEstado("en_preparacion")).toBe("despachado");
    expect(siguienteEstado("despachado")).toBe("entregado");
    expect(siguienteEstado("entregado")).toBeNull();
    expect(siguienteEstado("cancelado")).toBeNull();
  });

  it("se cancela mientras no esté despachado", () => {
    expect(["nuevo", "confirmado", "en_preparacion"].every((e) => puedeCancelarse(e as never))).toBe(true);
    expect(puedeCancelarse("despachado")).toBe(false);
    expect(puedeCancelarse("entregado")).toBe(false);
    expect(puedeCancelarse("cancelado")).toBe(false);
  });

  it("solo se editan los pedidos nuevos o confirmados", () => {
    expect(esEditable("nuevo")).toBe(true);
    expect(esEditable("confirmado")).toBe(true);
    expect(esEditable("en_preparacion")).toBe(false);
    expect(esFinal("entregado")).toBe(true);
    expect(esFinal("cancelado")).toBe(true);
    expect(esFinal("nuevo")).toBe(false);
  });

  it("reconoce estados válidos", () => {
    expect(esEstadoPedido("nuevo")).toBe(true);
    expect(esEstadoPedido("hackeo")).toBe(false);
    expect(esEstadoPedido(null)).toBe(false);
  });
});

describe("permisos sobre un pedido (matriz §6)", () => {
  it("el admin cambia el estado de cualquiera; el editor solo mira", () => {
    expect(puedeCambiarEstado("admin", 5, [])).toBe(true);
    expect(puedeCambiarEstado("admin", null, [])).toBe(true);
    expect(puedeCambiarEstado("editor", 5, [5])).toBe(false);
  });

  it("el vendedor solo en sus sectores (y nunca en bodega sin sector)", () => {
    expect(puedeCambiarEstado("vendedor", 5, [5, 6])).toBe(true);
    expect(puedeCambiarEstado("vendedor", 7, [5, 6])).toBe(false);
    expect(puedeCambiarEstado("vendedor", null, [5])).toBe(false);
  });

  it("solo el admin edita ítems y solo en pedidos editables", () => {
    expect(puedeEditarItems("admin", "nuevo")).toBe(true);
    expect(puedeEditarItems("admin", "en_preparacion")).toBe(false);
    expect(puedeEditarItems("vendedor", "nuevo")).toBe(false);
    expect(puedeEditarItems("editor", "confirmado")).toBe(false);
  });
});

describe("celularParaWhatsApp", () => {
  it("antepone 57 a un celular colombiano", () => {
    expect(celularParaWhatsApp("3101234567")).toBe("573101234567");
    expect(celularParaWhatsApp("310 123 4567")).toBe("573101234567");
    expect(celularParaWhatsApp("6061234567")).toBeNull();
  });
});

describe("filtros de pedidos", () => {
  it("fechaValida rechaza fechas que no existen", () => {
    expect(fechaValida("2026-11-19")).toBe("2026-11-19");
    expect(fechaValida("2026-02-31")).toBeNull();
    expect(fechaValida("19/11/2026")).toBeNull();
    expect(fechaValida(undefined)).toBeNull();
  });

  it("sin parámetros devuelve los valores por defecto", () => {
    expect(leerFiltrosPedidos({})).toEqual({ q: "", estado: null, desde: null, hasta: null, entrega: null, sector: null, vista: "lista", pagina: 1 });
    expect(hayFiltrosPedidos(leerFiltrosPedidos({}))).toBe(false);
  });

  it("sanea lo que viene de la URL", () => {
    const f = leerFiltrosPedidos({ q: "  Juan   Pérez ", estado: "hackeo", desde: "2026-11-10", hasta: "2026-11-01", entrega: "2026-11-19", sector: "abc", pagina: "3" });
    expect(f).toMatchObject({ q: "Juan Pérez", estado: null, desde: "2026-11-10", hasta: null, entrega: "2026-11-19", sector: null, pagina: 3 });
  });

  it("urlPedidos conserva filtros y vuelve a la página 1 al cambiar uno", () => {
    const f = leerFiltrosPedidos({ estado: "nuevo", entrega: "2026-11-19", pagina: "4" });
    expect(urlPedidos(f, { sector: 3 })).toBe("/admin/pedidos?estado=nuevo&entrega=2026-11-19&sector=3");
    expect(urlPedidos(f, { pagina: 5 })).toBe("/admin/pedidos?estado=nuevo&entrega=2026-11-19&pagina=5");
    expect(urlPedidos(f, { estado: null, entrega: null })).toBe("/admin/pedidos");
  });

  it("la vista por ruta se conserva en la URL", () => {
    const f = leerFiltrosPedidos({ vista: "ruta", entrega: "2026-11-19" });
    expect(f.vista).toBe("ruta");
    expect(urlPedidos(f)).toBe("/admin/pedidos?entrega=2026-11-19&vista=ruta");
    expect(leerFiltrosPedidos({ vista: "otra" }).vista).toBe("lista");
  });

  it("textoParaBuscar quita tildes y escapa comodines", () => {
    expect(textoParaBuscar("  Pérez 100%_ ")).toBe("perez 100\\%\\_");
  });
});

describe("agruparPorSector (pedidos por ruta, HU-04)", () => {
  const p = (id: number, sector: string | null, municipio: string | null = "Calarcá") => ({ id, sector_nombre: sector, municipio_nombre: sector ? municipio : null });

  it("agrupa por sector, en orden alfabético, y deja la bodega al final", () => {
    const g = agruparPorSector([p(1, "Norte"), p(2, null), p(3, "Centro"), p(4, "Norte")]);
    expect(g.map((x) => x.titulo)).toEqual(["Calarcá – Centro", "Calarcá – Norte", "Recoge en bodega"]);
    expect(g[1].pedidos.map((x) => x.id)).toEqual([1, 4]);
  });
});
