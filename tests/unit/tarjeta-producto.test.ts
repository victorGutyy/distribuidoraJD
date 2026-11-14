import { describe, expect, it } from "vitest";
import { aTarjeta, type FilaTienda } from "@/lib/tienda/tarjeta";

const base: FilaTienda = {
  id: 1,
  nombre: "Lentejas Doña Lupe",
  slug: "lentejas-dona-lupe",
  descripcion: null,
  etiquetas: [],
  destacado: false,
  es_nuevo: false,
  categoria_id: 2,
  categoria_slug: "granos",
  categoria_nombre: "Granos",
  categoria_padre_id: 1,
  marca_id: 3,
  marca_nombre: "Doña Lupe",
  marca_slug: "dona-lupe",
  variantes_visibles: 1,
  precio_desde: 3200,
  hay_oferta: false,
  disponible: true,
  imagen_url: "https://x/y.webp",
  imagen_miniatura_url: null,
  created_at: "2026-11-14T00:00:00Z",
  texto_busqueda: "lentejas",
  variante_principal_id: 10,
  presentacion_principal: "400 g",
  precio_principal: 3200,
  precio_mayor_principal: null,
  cantidad_min_mayor_principal: null,
  en_oferta_principal: false,
  precio_oferta_principal: null,
  disponible_principal: true,
};

describe("aTarjeta", () => {
  it("producto simple: precio normal, sin mayor ni oferta", () => {
    const t = aTarjeta(base);
    expect(t).toMatchObject({
      precio: 3200, precioAntes: null, mayor: null, esOferta: false, agotado: false,
      marca: "Doña Lupe", presentacion: "400 g", imagen: "https://x/y.webp", masPresentaciones: false,
    });
  });

  it("usa la miniatura cuando existe", () => {
    expect(aTarjeta({ ...base, imagen_miniatura_url: "https://x/m.webp" })?.imagen).toBe("https://x/m.webp");
    expect(aTarjeta({ ...base, imagen_url: null })?.imagen).toBeNull();
  });

  it("oferta: muestra el precio de oferta y tacha el normal", () => {
    const t = aTarjeta({ ...base, en_oferta_principal: true, precio_oferta_principal: 2800, hay_oferta: true });
    expect(t).toMatchObject({ precio: 2800, precioAntes: 3200, esOferta: true });
  });

  it("no anuncia un por mayor que es peor que la oferta", () => {
    const peor = aTarjeta({ ...base, en_oferta_principal: true, precio_oferta_principal: 2800, precio_mayor_principal: 3000, cantidad_min_mayor_principal: 10 });
    expect(peor?.mayor).toBeNull();
    const mejor = aTarjeta({ ...base, en_oferta_principal: true, precio_oferta_principal: 3100, precio_mayor_principal: 3000, cantidad_min_mayor_principal: 10 });
    expect(mejor?.mayor).toEqual({ precio: 3000, desde: 10 });
  });

  it("una oferta mayor o igual al precio normal se ignora", () => {
    const t = aTarjeta({ ...base, en_oferta_principal: true, precio_oferta_principal: 3200 });
    expect(t).toMatchObject({ precio: 3200, precioAntes: null });
  });

  it("precio por mayor con y sin cantidad mínima", () => {
    expect(aTarjeta({ ...base, precio_mayor_principal: 3000, cantidad_min_mayor_principal: 12 })?.mayor).toEqual({ precio: 3000, desde: 12 });
    expect(aTarjeta({ ...base, precio_mayor_principal: 3000 })?.mayor).toEqual({ precio: 3000, desde: null });
    // Un "mayor" que no es más barato no se muestra.
    expect(aTarjeta({ ...base, precio_mayor_principal: 3200 })?.mayor).toBeNull();
  });

  it("agotado cuando ninguna presentación está disponible; nuevo; más presentaciones", () => {
    expect(aTarjeta({ ...base, disponible: false })?.agotado).toBe(true);
    expect(aTarjeta({ ...base, es_nuevo: true })?.esNuevo).toBe(true);
    expect(aTarjeta({ ...base, variantes_visibles: 3 })?.masPresentaciones).toBe(true);
  });

  it("descarta filas sin datos básicos o sin precio", () => {
    expect(aTarjeta({ ...base, id: null })).toBeNull();
    expect(aTarjeta({ ...base, slug: null })).toBeNull();
    expect(aTarjeta({ ...base, precio_principal: null })).toBeNull();
    expect(aTarjeta({ ...base, precio_principal: 0 })).toBeNull();
  });
});
