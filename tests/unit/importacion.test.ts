import { describe, expect, it } from "vitest";
import {
  COLUMNAS_CATALOGO,
  columnaDeEncabezado,
  leerTabla,
  normalizarEncabezado,
} from "@/lib/importacion/columnas";
import {
  compararCatalogo,
  compararPrecios,
  type VarianteExistente,
} from "@/lib/importacion/comparar";
import { tablaDeExportacion } from "@/lib/importacion/exportar";
import {
  payloadCatalogo,
  payloadPrecios,
  validarFilaCatalogo,
  validarFilaPrecios,
} from "@/lib/importacion/fila";
import { textoCambio } from "@/lib/importacion/formato-cambio";
import { celdaATexto } from "@/lib/importacion/leer-archivo";
import { aVarianteExistente, type FilaBD } from "@/lib/importacion/leer-bd";
import { repartirEnLotes, skusRepetidos, trocear } from "@/lib/importacion/lotes";

const base = { producto: "Arroz", categoria: "Víveres" };

describe("encabezados de columnas", () => {
  it("normaliza tildes, mayúsculas y símbolos", () => {
    expect(normalizarEncabezado(" Categoría ")).toBe("categoria");
    expect(normalizarEncabezado("Precio por mayor")).toBe("precio_por_mayor");
    expect(normalizarEncabezado("﻿sku")).toBe("sku");
  });

  it("reconoce alias y descarta lo desconocido", () => {
    expect(columnaDeEncabezado("Nombre", COLUMNAS_CATALOGO)).toBe("producto");
    expect(columnaDeEncabezado("Precio", COLUMNAS_CATALOGO)).toBe("precio_unidad");
    expect(columnaDeEncabezado("Color favorito", COLUMNAS_CATALOGO)).toBeNull();
    // En modo precios no vale una columna que no es de precios.
    expect(columnaDeEncabezado("marca", ["sku"])).toBeNull();
  });
});

describe("leerTabla", () => {
  it("convierte filas con el número que ve la persona en Excel", () => {
    const r = leerTabla(
      [
        ["SKU", "Producto", "Categoría", "Extra"],
        ["A-1", "Arroz", "Víveres", "x"],
        ["", "", "", ""],
        ["", "Sal", "Víveres", ""],
      ],
      "catalogo",
    );
    expect(r.faltantes).toEqual([]);
    expect(r.ignoradas).toEqual(["Extra"]);
    expect(r.filas.map((f) => f.fila)).toEqual([2, 4]); // la 3 estaba vacía
    expect(r.filas[0].datos).toMatchObject({ sku: "A-1", producto: "Arroz" });
  });

  it("avisa de las columnas obligatorias que faltan", () => {
    expect(leerTabla([["producto"], ["x"]], "catalogo").faltantes).toEqual([
      "categoria",
    ]);
    expect(leerTabla([["precio"], ["1"]], "precios").faltantes).toEqual(["sku"]);
  });
});

describe("celdaATexto", () => {
  it("no formatea los números y entiende vacíos y booleanos", () => {
    expect(celdaATexto(3200)).toBe("3200");
    expect(celdaATexto(0.5)).toBe("0.5");
    expect(celdaATexto(null)).toBe("");
    expect(celdaATexto(true)).toBe("si");
    expect(celdaATexto("  hola ")).toBe("hola");
  });
});

describe("validarFilaCatalogo", () => {
  it("acepta lo mínimo y deja lo vacío en null (no tocar)", () => {
    const r = validarFilaCatalogo(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.fila.precio_unidad).toBeNull();
      expect(r.fila.en_oferta).toBeNull();
      expect(r.fila.etiquetas).toEqual([]);
    }
  });

  it("lee precios con punto de miles y booleanos en español", () => {
    const r = validarFilaCatalogo({
      ...base,
      precio_unidad: "3.200",
      precio_mayor: "3000",
      cantidad_min_mayor: "12",
      disponible: "Sí",
      activo: "NO",
      contenido_unidad: "KG",
      unidad_venta: "Paquete",
      etiquetas: "a, b, A",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.fila).toMatchObject({
        precio_unidad: 3200,
        precio_mayor: 3000,
        cantidad_min_mayor: 12,
        disponible: true,
        activo: false,
        contenido_unidad: "kg",
        unidad_venta: "paquete",
        etiquetas: ["a", "b"],
      });
    }
  });

  it("rechaza datos inválidos diciendo la columna", () => {
    const r = validarFilaCatalogo({
      producto: "",
      categoria: "",
      precio_unidad: "12,5",
      disponible: "tal vez",
      unidad_venta: "docena",
      contenido_unidad: "galones",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const texto = r.errores.join("\n");
      expect(texto).toContain("producto:");
      expect(texto).toContain("categoria:");
      expect(texto).toContain("precio_unidad:");
      expect(texto).toContain("disponible:");
      expect(texto).toContain("unidad_venta:");
      expect(texto).toContain("contenido_unidad:");
    }
  });

  it("aplica las reglas entre precios", () => {
    const mayor = validarFilaCatalogo({ ...base, precio_unidad: "1000", precio_mayor: "1500" });
    expect(mayor.ok).toBe(false);
    const oferta = validarFilaCatalogo({
      ...base,
      precio_unidad: "1000",
      en_oferta: "si",
      precio_oferta: "1000",
    });
    expect(oferta.ok).toBe(false);
    const bien = validarFilaCatalogo({
      ...base,
      precio_unidad: "1000",
      en_oferta: "si",
      precio_oferta: "900",
    });
    expect(bien.ok).toBe(true);
  });

  it("acepta los SKU de la plantilla y rechaza los raros", () => {
    expect(validarFilaCatalogo({ ...base, sku: "EVC-00001-01" }).ok).toBe(true);
    expect(validarFilaCatalogo({ ...base, sku: "EV 1/2" }).ok).toBe(false);
  });
});

describe("validarFilaPrecios y payloads", () => {
  it("exige el SKU", () => {
    expect(validarFilaPrecios({ precio_unidad: "100" }).ok).toBe(false);
    expect(validarFilaPrecios({ sku: "A-1", precio_unidad: "100" }).ok).toBe(true);
  });

  it("el payload no lleva las celdas vacías ni pagina_pdf", () => {
    const r = validarFilaCatalogo({ ...base, precio_unidad: "500", pagina_pdf: "12" });
    if (!r.ok) throw new Error("debía ser válida");
    const p = payloadCatalogo(r.fila);
    expect(p).toEqual({ producto: "Arroz", categoria: "Víveres", precio_unidad: 500 });
    const q = validarFilaPrecios({ sku: "A-1", precio_oferta: "400", en_oferta: "no" });
    if (!q.ok) throw new Error("debía ser válida");
    expect(payloadPrecios(q.fila)).toEqual({ sku: "A-1", en_oferta: false, precio_oferta: 400 });
  });
});

const guardada: VarianteExistente = {
  sku: "EVC-00001-01",
  nombre_presentacion: "460 g",
  contenido_valor: 460,
  contenido_unidad: "g",
  unidad_venta: "individual",
  unidades_por_empaque: 1,
  precio_unidad: 2500,
  precio_mayor: null,
  cantidad_min_mayor: null,
  en_oferta: false,
  precio_oferta: null,
  disponible: true,
  activo: true,
  producto: {
    nombre: "Arveja verde",
    descripcion: null,
    etiquetas: [],
    activo: true,
    marca: "La soberana",
    categoria: "Víveres y despensa",
    subcategoria: "Granos y harinas",
  },
};

function fila(cruda: Record<string, string>) {
  const r = validarFilaCatalogo({
    producto: "Arveja verde",
    categoria: "Víveres y despensa",
    subcategoria: "Granos y harinas",
    marca: "La soberana",
    ...cruda,
  });
  if (!r.ok) throw new Error(r.errores.join());
  return r.fila;
}

describe("compararCatalogo", () => {
  it("SKU que no existe → crear", () => {
    expect(compararCatalogo(fila({ sku: "NUEVO-1" }), undefined).estado).toBe("crear");
  });

  it("igual a lo guardado (aun con otras tildes/mayúsculas) → sin cambios", () => {
    const c = compararCatalogo(
      fila({ sku: guardada.sku, marca: "LA SOBERANA", presentacion: "460 g" }),
      guardada,
    );
    expect(c.estado).toBe("sin_cambios");
  });

  it("una celda vacía no cuenta como cambio", () => {
    expect(compararCatalogo(fila({ sku: guardada.sku }), guardada).estado).toBe(
      "sin_cambios",
    );
  });

  it("detecta precio nuevo con anterior → nuevo", () => {
    const c = compararCatalogo(fila({ sku: guardada.sku, precio_unidad: "2800" }), guardada);
    expect(c.estado).toBe("actualizar");
    expect(c.cambios).toEqual([{ campo: "precio_unidad", antes: 2500, despues: 2800 }]);
    expect(textoCambio(c.cambios[0])).toBe("Precio unidad: $ 2.500 → $ 2.800");
  });

  it("detecta cambio de categoría y de marca", () => {
    const c = compararCatalogo(
      fila({ sku: guardada.sku, subcategoria: "Enlatados", marca: "Otra" }),
      guardada,
    );
    expect(c.cambios.map((x) => x.campo)).toEqual(["subcategoria", "marca"]);
  });
});

describe("compararPrecios", () => {
  it("SKU inexistente → null (es un error)", () => {
    const r = validarFilaPrecios({ sku: "X", precio_unidad: "100" });
    if (!r.ok) throw new Error("válida");
    expect(compararPrecios(r.fila, undefined)).toBeNull();
  });

  it("solo cambia lo que viene en el archivo", () => {
    const r = validarFilaPrecios({ sku: guardada.sku, precio_unidad: "2500", precio_mayor: "2300" });
    if (!r.ok) throw new Error("válida");
    const c = compararPrecios(r.fila, guardada);
    expect(c?.estado).toBe("actualizar");
    expect(c?.cambios).toEqual([{ campo: "precio_mayor", antes: null, despues: 2300 }]);
  });
});

describe("repartirEnLotes", () => {
  const f = (producto: string, n = 1) =>
    Array.from({ length: n }, () => ({ producto, categoria: "C", subcategoria: null, marca: null }));

  it("no parte un producto entre lotes y respeta el máximo de productos", () => {
    const filas = [...f("A", 2), ...f("B"), ...f("a", 1), ...f("C"), ...f("D")];
    const lotes = repartirEnLotes(filas, (x) => x, 2);
    // A y "a" son el mismo producto (sin importar mayúsculas): 3 filas juntas.
    expect(lotes.map((l) => l.map((x) => x.producto))).toEqual([
      ["A", "A", "a", "B"],
      ["C", "D"],
    ]);
  });

  it("respeta el máximo de filas", () => {
    const lotes = repartirEnLotes([...f("A", 3), ...f("B", 3)], (x) => x, 100, 4);
    expect(lotes.map((l) => l.length)).toEqual([3, 3]);
  });
});

describe("trocear y skusRepetidos", () => {
  it("trocear", () => {
    expect(trocear([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("avisa solo desde la segunda aparición", () => {
    const avisos = skusRepetidos([
      { fila: 2, sku: "A-1" },
      { fila: 3, sku: null },
      { fila: 4, sku: "a-1" },
    ]);
    expect([...avisos.keys()]).toEqual([4]);
    expect(avisos.get(4)).toContain("fila 2");
  });
});

describe("lectura de la base y exportación", () => {
  const bd: FilaBD = {
    ...guardada, // el campo sobrante `producto` no importa: aVarianteExistente lo reemplaza
    productos: {
      nombre: "Arveja verde",
      descripcion: null,
      etiquetas: ["legumbre"],
      activo: true,
      marcas: { nombre: "La soberana" },
      categorias: { nombre: "Granos y harinas", padre: { nombre: "Víveres y despensa" } },
    },
  };

  it("la categoría hija con padre se separa en categoría y subcategoría", () => {
    const v = aVarianteExistente(bd);
    expect(v.producto.categoria).toBe("Víveres y despensa");
    expect(v.producto.subcategoria).toBe("Granos y harinas");
  });

  it("una categoría raíz no tiene subcategoría", () => {
    const v = aVarianteExistente({
      ...bd,
      productos: { ...bd.productos, categorias: { nombre: "Aseo", padre: null } },
    });
    expect(v.producto.categoria).toBe("Aseo");
    expect(v.producto.subcategoria).toBeNull();
  });

  it("la exportación usa las mismas columnas que la importación (ida y vuelta)", () => {
    const tabla = tablaDeExportacion([aVarianteExistente(bd)], "catalogo");
    expect(tabla[0]).toEqual([...COLUMNAS_CATALOGO]);
    const cruda = Object.fromEntries(
      tabla[0].map((c, i) => [c, String(tabla[1][i] ?? "")]),
    );
    const r = validarFilaCatalogo(cruda);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const c = compararCatalogo(r.fila, aVarianteExistente(bd));
      expect(c.estado).toBe("sin_cambios"); // exportar y volver a subir no cambia nada
    }
  });

  it("el archivo de precios solo lleva SKU y precios", () => {
    const tabla = tablaDeExportacion([aVarianteExistente(bd)], "precios");
    expect(tabla[0]).toContain("precio_unidad");
    expect(tabla[0]).not.toContain("categoria");
  });
});
