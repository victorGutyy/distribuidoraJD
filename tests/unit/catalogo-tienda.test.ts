import { describe, expect, it } from "vitest";
import { formatCOP } from "@/lib/formato";
import {
  armarArbol,
  conteosAcumulados,
  resolverCategoria,
  type CategoriaTienda,
} from "@/lib/tienda/categorias";
import {
  chipsActivos,
  hayFiltros,
  leerFiltrosCatalogo,
  rangoCatalogo,
  urlCatalogo,
} from "@/lib/tienda/filtros-catalogo";

const cat = (id: number, nombre: string, slug: string, parent_id: number | null = null): CategoriaTienda => ({
  id, nombre, slug, parent_id, orden: id, icono_url: null,
});
const categorias = [
  cat(1, "Víveres", "viveres"),
  cat(2, "Granos", "granos", 1),
  cat(3, "Enlatados", "enlatados", 1),
  cat(4, "Aseo", "aseo"),
];

describe("leerFiltrosCatalogo", () => {
  it("sin parámetros devuelve los valores por defecto", () => {
    expect(leerFiltrosCatalogo({})).toEqual({
      q: "", cat: null, marcas: [], min: null, max: null,
      ofertas: false, disponibles: false, orden: "relevancia", pagina: 1,
    });
  });

  it("sanea lo que viene de la URL", () => {
    const f = leerFiltrosCatalogo({
      q: "  arroz   diana  ",
      cat: "Granos; DROP",
      marca: ["la-soberana", "x y", "la-soberana,diana"],
      min: "1000",
      max: "abc",
      ofertas: "1",
      disponibles: "si",
      orden: "hackeo",
      page: "-3",
    });
    expect(f).toMatchObject({
      q: "arroz diana",
      cat: null,
      marcas: ["la-soberana", "diana"],
      min: 1000,
      max: null,
      ofertas: true,
      disponibles: false,
      orden: "relevancia",
      pagina: 1,
    });
  });

  it("descarta un máximo menor que el mínimo y acepta la página", () => {
    const f = leerFiltrosCatalogo({ min: "5000", max: "1000", page: "3", orden: "precio_asc" });
    expect(f.max).toBeNull();
    expect(f.pagina).toBe(3);
    expect(f.orden).toBe("precio_asc");
  });
});

describe("urlCatalogo", () => {
  const base = leerFiltrosCatalogo({});

  it("no escribe lo que está por defecto", () => {
    expect(urlCatalogo(base)).toBe("/catalogo");
  });

  it("conserva filtros y vuelve a la página 1 al cambiar uno", () => {
    const f = leerFiltrosCatalogo({ cat: "granos", marca: "diana", page: "4" });
    expect(urlCatalogo(f, { ofertas: true })).toBe("/catalogo?cat=granos&marca=diana&ofertas=1");
    expect(urlCatalogo(f, { pagina: 5 })).toBe("/catalogo?cat=granos&marca=diana&page=5");
    expect(urlCatalogo(f, { cat: null, marcas: [] })).toBe("/catalogo");
  });

  it("repite el parámetro marca y ordena", () => {
    const f = leerFiltrosCatalogo({ q: "arroz", marca: ["a", "b"], orden: "nombre", min: "100" });
    expect(urlCatalogo(f)).toBe("/catalogo?q=arroz&marca=a&marca=b&min=100&orden=nombre");
  });

  it("ida y vuelta: leer lo que se escribió da lo mismo", () => {
    const f = leerFiltrosCatalogo({ q: "jabón", cat: "aseo", marca: ["a", "b"], min: "100", max: "900", ofertas: "1", orden: "precio_desc" });
    const params = Object.fromEntries(new URL(urlCatalogo(f), "http://x").searchParams.entries());
    const multi = new URL(urlCatalogo(f), "http://x").searchParams.getAll("marca");
    expect(leerFiltrosCatalogo({ ...params, marca: multi })).toEqual(f);
  });
});

describe("chipsActivos y hayFiltros", () => {
  it("un chip por filtro, con el enlace que lo quita", () => {
    const f = leerFiltrosCatalogo({ cat: "granos", marca: ["diana", "otra"], min: "1000", max: "2000", ofertas: "1" });
    expect(hayFiltros(f)).toBe(true);
    const chips = chipsActivos(
      f,
      { categoria: "Granos", marcas: new Map([["diana", "Diana"]]) },
      formatCOP,
    );
    expect(chips.map((c) => c.etiqueta)).toEqual(["Granos", "Diana", "otra", "$ 1.000 a $ 2.000", "Solo ofertas"]);
    expect(chips[1].href).toBe("/catalogo?cat=granos&marca=otra&min=1000&max=2000&ofertas=1");
  });

  it("buscar o paginar no cuenta como filtro", () => {
    expect(hayFiltros(leerFiltrosCatalogo({ q: "arroz", page: "2" }))).toBe(false);
  });
});

describe("rangoCatalogo", () => {
  it("acota la página al total", () => {
    expect(rangoCatalogo(9, 50)).toEqual({ actual: 3, totalPaginas: 3, desde: 48, hasta: 71 });
    expect(rangoCatalogo(1, 0).totalPaginas).toBe(1);
  });
});

describe("categorías de la tienda", () => {
  it("arma el árbol", () => {
    const arbol = armarArbol(categorias);
    expect(arbol.map((n) => [n.raiz.slug, n.hijas.map((h) => h.slug)])).toEqual([
      ["viveres", ["granos", "enlatados"]],
      ["aseo", []],
    ]);
  });

  it("una principal incluye a sus hijas; una hija, solo a ella", () => {
    expect(resolverCategoria(categorias, "viveres").ids).toEqual([1, 2, 3]);
    const hija = resolverCategoria(categorias, "granos");
    expect(hija.ids).toEqual([2]);
    expect(hija.raiz?.slug).toBe("viveres");
    expect(resolverCategoria(categorias, "no-existe").actual).toBeNull();
  });

  it("suma los productos de las hijas en su principal", () => {
    const total = conteosAcumulados(categorias, new Map([[2, 5], [3, 2], [4, 1]]));
    expect(total.get(1)).toBe(7);
    expect(total.get(2)).toBe(5);
    expect(total.get(4)).toBe(1);
  });
});
