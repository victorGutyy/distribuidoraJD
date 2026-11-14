import { describe, expect, it } from "vitest";
import {
  armarPayload,
  productoVacio,
  valoresDesdeBD,
  varianteVacia,
} from "@/lib/catalogo/producto-form";
import { erroresPorCampo } from "@/lib/validaciones/comun";
import {
  partirEtiquetas,
  productoSchema,
  varianteSchema,
} from "@/lib/validaciones/producto";

/** Un producto válido mínimo: una presentación sin precio (queda en borrador). */
function productoBase() {
  const p = productoVacio();
  p.nombre = "Lentejas Doña Lupe";
  p.categoria_id = "3";
  return p;
}

describe("productoSchema", () => {
  it("acepta un producto SIN precio (queda en borrador, RF-24)", () => {
    const r = productoSchema.safeParse(productoBase());
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.variantes[0].precio_unidad).toBeNull();
      expect(r.data.categoria_id).toBe(3);
      expect(r.data.marca_id).toBeNull();
    }
  });

  it("convierte precios escritos en formato colombiano a pesos enteros", () => {
    const p = productoBase();
    p.variantes[0].precio_unidad = "3.200";
    p.variantes[0].precio_mayor = "$ 3000";
    p.variantes[0].cantidad_min_mayor = "12";
    const r = productoSchema.safeParse(p);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.variantes[0].precio_unidad).toBe(3200);
      expect(r.data.variantes[0].precio_mayor).toBe(3000);
      expect(r.data.variantes[0].cantidad_min_mayor).toBe(12);
    }
  });

  it("exige nombre, categoría y al menos una presentación", () => {
    const r = productoSchema.safeParse({ ...productoVacio(), variantes: [] });
    expect(r.success).toBe(false);
    if (!r.success) {
      const e = erroresPorCampo(r.error);
      expect(e.nombre?.[0]).toBe("Escribe el nombre del producto");
      expect(e.categoria_id?.[0]).toBe("Elige una categoría");
      expect(e.variantes?.[0]).toBe("Agrega al menos una presentación");
    }
  });

  it("rechaza el precio por mayor mayor que el de unidad", () => {
    const p = productoBase();
    p.variantes[0].precio_unidad = "3000";
    p.variantes[0].precio_mayor = "5000";
    const r = productoSchema.safeParse(p);
    expect(r.success).toBe(false);
  });

  it("rechaza decimales y ceros en los precios (RN-05)", () => {
    for (const malo of ["3200.5", "12,5", "0", "-5", "abc"]) {
      const v = { ...varianteVacia(), precio_unidad: malo };
      expect(varianteSchema.safeParse(v).success).toBe(false);
    }
  });

  it("una oferta exige precio de oferta menor que el de unidad", () => {
    const sinPrecio = {
      ...varianteVacia(),
      precio_unidad: "3000",
      en_oferta: true,
    };
    expect(varianteSchema.safeParse(sinPrecio).success).toBe(false);

    const mayor = { ...sinPrecio, precio_oferta: "3500" };
    expect(varianteSchema.safeParse(mayor).success).toBe(false);

    const bien = { ...sinPrecio, precio_oferta: "2500" };
    expect(varianteSchema.safeParse(bien).success).toBe(true);
  });

  it("el precio por mayor exige el precio por unidad", () => {
    const v = { ...varianteVacia(), precio_mayor: "2000" };
    expect(varianteSchema.safeParse(v).success).toBe(false);
  });

  it("detecta SKUs repetidos dentro del formulario, sin importar mayúsculas", () => {
    const p = productoBase();
    p.variantes = [
      { ...varianteVacia(), sku: "EV-00001-01" },
      { ...varianteVacia(), sku: "ev-00001-01" },
    ];
    const r = productoSchema.safeParse(p);
    expect(r.success).toBe(false);
  });

  it("valida el formato del SKU y las unidades por empaque", () => {
    expect(
      varianteSchema.safeParse({ ...varianteVacia(), sku: "con espacios" })
        .success,
    ).toBe(false);
    expect(
      varianteSchema.safeParse({
        ...varianteVacia(),
        unidades_por_empaque: "0",
      }).success,
    ).toBe(false);
  });

  it("convierte las etiquetas separadas por comas en una lista sin repetidos", () => {
    const p = { ...productoBase(), etiquetas: "granos, Legumbres , granos," };
    const r = productoSchema.safeParse(p);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.etiquetas).toEqual(["granos", "Legumbres"]);
  });
});

describe("partirEtiquetas", () => {
  it("limpia espacios, vacíos y repetidos", () => {
    expect(partirEtiquetas("")).toEqual([]);
    expect(partirEtiquetas(" a , ,B,a ")).toEqual(["a", "B"]);
  });
});

describe("armarPayload y valoresDesdeBD", () => {
  it("arma el payload de un producto nuevo con SKU vacío = autogenerar", () => {
    const p = productoBase();
    p.variantes[0].precio_unidad = "3.200";
    const r = productoSchema.parse(p);
    const { p_producto, p_variantes } = armarPayload(r, "lentejas-dona-lupe");
    expect(p_producto.id).toBeNull();
    expect(p_producto.slug).toBe("lentejas-dona-lupe");
    expect(p_variantes[0].id).toBeNull();
    expect(p_variantes[0].sku).toBeNull();
    expect(p_variantes[0].precio_unidad).toBe(3200);
    expect(p_variantes[0].unidad_venta).toBe("individual");
  });

  it("al editar conserva los ids y no envía slug", () => {
    const p = { ...productoBase(), id: "5" };
    p.variantes[0].id = "9";
    p.variantes[0].sku = "EV-00005-01";
    const { p_producto, p_variantes } = armarPayload(productoSchema.parse(p));
    expect(p_producto.id).toBe(5);
    expect(p_producto.slug).toBeNull();
    expect(p_variantes[0].id).toBe(9);
    expect(p_variantes[0].sku).toBe("EV-00005-01");
  });

  it("ida y vuelta: base de datos → formulario → validado conserva los datos", () => {
    const valores = valoresDesdeBD(
      {
        id: 5,
        nombre: "Atún La Soberana",
        descripcion: null,
        categoria_id: 3,
        marca_id: 7,
        etiquetas: ["enlatados", "pescado"],
        destacado: true,
        es_nuevo: false,
        activo: true,
      },
      [
        {
          id: 20,
          producto_id: 5,
          sku: "EV-00005-02",
          nombre_presentacion: "140 g",
          contenido_valor: 140,
          contenido_unidad: "g",
          unidad_venta: "individual",
          unidades_por_empaque: 1,
          peso_g: null,
          alto_cm: null,
          ancho_cm: null,
          largo_cm: null,
          precio_unidad: 5900,
          precio_mayor: 5500,
          cantidad_min_mayor: 6,
          en_oferta: false,
          precio_oferta: null,
          disponible: true,
          imagen_url: null,
          orden: 2,
          activo: true,
          created_at: "",
          updated_at: "",
        },
        {
          id: 10,
          producto_id: 5,
          sku: "EV-00005-01",
          nombre_presentacion: "80 g",
          contenido_valor: 80,
          contenido_unidad: "g",
          unidad_venta: "individual",
          unidades_por_empaque: 1,
          peso_g: null,
          alto_cm: null,
          ancho_cm: null,
          largo_cm: null,
          precio_unidad: null,
          precio_mayor: null,
          cantidad_min_mayor: null,
          en_oferta: false,
          precio_oferta: null,
          disponible: true,
          imagen_url: null,
          orden: 1,
          activo: true,
          created_at: "",
          updated_at: "",
        },
      ],
    );
    // Se ordenan por `orden` y los números pasan a texto.
    expect(valores.variantes.map((v) => v.id)).toEqual(["10", "20"]);
    expect(valores.etiquetas).toBe("enlatados, pescado");
    expect(valores.variantes[1].precio_unidad).toBe("5900");

    const r = productoSchema.safeParse(valores);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.variantes[1].precio_unidad).toBe(5900);
      expect(r.data.variantes[0].precio_unidad).toBeNull();
      expect(r.data.marca_id).toBe(7);
    }
  });
});
