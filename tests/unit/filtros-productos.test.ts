import { describe, expect, it } from "vitest";
import {
  leerFiltros,
  normalizarBusqueda,
  rangoPagina,
  urlLista,
} from "@/lib/catalogo/filtros-productos";

describe("leerFiltros", () => {
  it("usa valores por defecto cuando no hay parámetros", () => {
    expect(leerFiltros({})).toEqual({
      q: "",
      categoria: null,
      marca: null,
      estado: "todos",
      sinPrecio: false,
      sinImagen: false,
      orden: "recientes",
      pagina: 1,
    });
  });

  it("lee los filtros válidos de la URL", () => {
    const f = leerFiltros({
      q: "  lenteja ",
      categoria: "3",
      marca: "7",
      estado: "borrador",
      sin_precio: "1",
      sin_imagen: "1",
      orden: "precio_desc",
      pagina: "4",
    });
    expect(f.q).toBe("lenteja");
    expect(f.categoria).toBe(3);
    expect(f.marca).toBe(7);
    expect(f.estado).toBe("borrador");
    expect(f.sinPrecio).toBe(true);
    expect(f.sinImagen).toBe(true);
    expect(f.orden).toBe("precio_desc");
    expect(f.pagina).toBe(4);
  });

  it("sanea lo inválido (nunca confía en la URL)", () => {
    const f = leerFiltros({
      categoria: "abc",
      marca: "-2",
      estado: "hackeado",
      orden: "drop table",
      pagina: "0",
      sin_precio: "si",
    });
    expect(f.categoria).toBeNull();
    expect(f.marca).toBeNull();
    expect(f.estado).toBe("todos");
    expect(f.orden).toBe("recientes");
    expect(f.pagina).toBe(1);
    expect(f.sinPrecio).toBe(false);
  });

  it("toma el primer valor si un parámetro viene repetido", () => {
    expect(leerFiltros({ q: ["uno", "dos"] }).q).toBe("uno");
  });

  it("limita el largo de la búsqueda", () => {
    expect(leerFiltros({ q: "x".repeat(200) }).q).toHaveLength(60);
  });
});

describe("normalizarBusqueda", () => {
  it("quita tildes y ñ y pasa a minúsculas", () => {
    expect(normalizarBusqueda("  Jabón ÑANDÚ ")).toBe("jabon nandu");
  });

  it("escapa los comodines de LIKE para buscarlos como texto", () => {
    expect(normalizarBusqueda("100%")).toBe("100\\%");
    expect(normalizarBusqueda("a_b")).toBe("a\\_b");
    expect(normalizarBusqueda("a\\b")).toBe("a\\\\b");
  });
});

describe("rangoPagina", () => {
  it("calcula el rango de la página y el total", () => {
    expect(rangoPagina(1, 60, 25)).toEqual({
      actual: 1,
      totalPaginas: 3,
      desde: 0,
      hasta: 24,
    });
    expect(rangoPagina(3, 60, 25)).toMatchObject({ desde: 50, hasta: 74 });
  });

  it("acota una página fuera de rango y maneja listas vacías", () => {
    expect(rangoPagina(99, 60, 25).actual).toBe(3);
    expect(rangoPagina(0, 60, 25).actual).toBe(1);
    expect(rangoPagina(1, 0, 25)).toMatchObject({ actual: 1, totalPaginas: 1 });
  });
});

describe("urlLista", () => {
  const base = leerFiltros({ q: "lenteja", estado: "borrador", pagina: "2" });

  it("conserva los filtros y cambia solo la página", () => {
    expect(urlLista("/admin/productos", base, { pagina: 3 })).toBe(
      "/admin/productos?q=lenteja&estado=borrador&pagina=3",
    );
  });

  it("quita un parámetro cuando el valor es null", () => {
    expect(urlLista("/admin/productos", base, { pagina: null })).toBe(
      "/admin/productos?q=lenteja&estado=borrador",
    );
  });

  it("devuelve la ruta limpia si no hay filtros", () => {
    expect(urlLista("/admin/productos", leerFiltros({}))).toBe(
      "/admin/productos",
    );
  });
});
