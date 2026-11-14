import { describe, expect, it } from "vitest";
import {
  agregarItem,
  aplicarVigentes,
  aEntradas,
  cambiarCantidad,
  limitarCantidad,
  sanitizarItems,
  sanitizarUbicacion,
  MAX_ITEMS_CARRITO,
  quitarItem,
  totalUnidades,
  type DatosVigentes,
  type ItemCarrito,
} from "@/lib/carrito";
import { checkoutSchema, normalizarCelular } from "@/lib/validaciones/pedido";
import { armarMensajePedido, pesoCompacto, type DatosMensajePedido } from "@/lib/whatsapp";

const datos = (id: number, extra: Partial<DatosVigentes> = {}): DatosVigentes => ({
  varianteId: id,
  productoSlug: `producto-${id}`,
  nombre: `Producto ${id}`,
  presentacion: "500 g",
  imagen: null,
  precio: { precioUnidad: 1000, precioMayor: null, cantidadMinMayor: null, enOferta: false, precioOferta: null },
  disponible: true,
  ...extra,
});
const item = (id: number, cantidad = 1, extra: Partial<DatosVigentes> = {}): ItemCarrito => ({ ...datos(id, extra), cantidad });

describe("operaciones del carrito", () => {
  it("agrega, suma si ya estaba y respeta el máximo por ítem", () => {
    const a = agregarItem([], datos(1), 2);
    expect(a).toMatchObject({ agregado: true, items: [{ varianteId: 1, cantidad: 2 }] });
    const b = agregarItem(a.items, datos(1), 3);
    expect(b.items).toHaveLength(1);
    expect(b.items[0].cantidad).toBe(5);
    expect(agregarItem(b.items, datos(1), 99999).items[0].cantidad).toBe(9999);
  });

  it("RN-12: no se agrega una presentación agotada", () => {
    const r = agregarItem([], datos(1, { disponible: false }), 1);
    expect(r).toMatchObject({ agregado: false, motivo: "agotado", items: [] });
  });

  it("no pasa del máximo de ítems distintos", () => {
    const lleno = Array.from({ length: MAX_ITEMS_CARRITO }, (_, i) => item(i + 1));
    expect(agregarItem(lleno, datos(999), 1)).toMatchObject({ agregado: false, motivo: "lleno" });
    expect(agregarItem(lleno, datos(1), 1).agregado).toBe(true); // sumar a uno existente sí
  });

  it("cambia la cantidad; cero o menos quita el ítem", () => {
    const base = [item(1, 2), item(2, 1)];
    expect(cambiarCantidad(base, 1, 7)[0].cantidad).toBe(7);
    expect(cambiarCantidad(base, 1, 0).map((i) => i.varianteId)).toEqual([2]);
    expect(cambiarCantidad(base, 1, Number.NaN).map((i) => i.varianteId)).toEqual([2]);
    expect(quitarItem(base, 2)).toHaveLength(1);
  });

  it("limitarCantidad devuelve enteros entre 1 y 9999", () => {
    expect(limitarCantidad(2.9)).toBe(2);
    expect(limitarCantidad(0)).toBe(1);
    expect(limitarCantidad(1e9)).toBe(9999);
    expect(limitarCantidad(Number.NaN)).toBe(1);
  });

  it("solo manda ids y cantidades al servidor, nunca precios", () => {
    expect(aEntradas([item(1, 3)])).toEqual([{ varianteId: 1, cantidad: 3 }]);
    expect(totalUnidades([item(1, 3), item(2, 4)])).toBe(7);
  });
});

describe("aplicarVigentes (revalidar al abrir el carrito)", () => {
  it("quita lo que ya no se vende y avisa", () => {
    const r = aplicarVigentes([item(1), item(2)], new Map([[1, datos(1)], [2, null]]));
    expect(r.items.map((i) => i.varianteId)).toEqual([1]);
    expect(r.avisos[0]).toContain("ya no está a la venta");
  });

  it("actualiza el precio y avisa, conservando la cantidad", () => {
    const nuevo = datos(1, { precio: { precioUnidad: 1200, precioMayor: null, cantidadMinMayor: null, enOferta: false, precioOferta: null } });
    const r = aplicarVigentes([item(1, 4)], new Map([[1, nuevo]]));
    expect(r.items[0]).toMatchObject({ cantidad: 4, precio: { precioUnidad: 1200 } });
    expect(r.avisos).toEqual(["El precio de «Producto 1» cambió. Revisa el total."]);
  });

  it("marca los agotados y bloquea", () => {
    const r = aplicarVigentes([item(1)], new Map([[1, datos(1, { disponible: false })]]));
    expect(r.hayAgotados).toBe(true);
    expect(r.avisos[0]).toContain("se agotó");
  });

  it("sin cambios no hay avisos; lo no consultado queda igual", () => {
    const r = aplicarVigentes([item(1), item(2)], new Map([[1, datos(1)]]));
    expect(r.avisos).toEqual([]);
    expect(r.items).toHaveLength(2);
    expect(r.hayAgotados).toBe(false);
  });
});

describe("normalizarCelular", () => {
  it("acepta formatos comunes y deja 10 dígitos", () => {
    expect(normalizarCelular("310 123 4567")).toBe("3101234567");
    expect(normalizarCelular("+57 310-123-4567")).toBe("3101234567");
    expect(normalizarCelular("573101234567")).toBe("3101234567");
  });
  it("rechaza lo que no es celular colombiano", () => {
    for (const malo of ["", "6061234567", "310123", "2101234567", "31012345678"]) {
      expect(normalizarCelular(malo)).toBeNull();
    }
  });
});

describe("checkoutSchema", () => {
  const base = {
    nombre: "Juan Pérez",
    celular: "310 123 4567",
    nombre_negocio: "Tienda La Esquina",
    documento: "",
    recoge_en_bodega: false,
    sector_id: 3,
    direccion: "Cra 25 # 30-12",
    referencia: "",
    notas: "",
    acepta_datos: true as const,
    web: "",
    items: [{ varianteId: 1, cantidad: 12 }],
    total_visto: 36000,
  };

  it("acepta un pedido completo y normaliza los datos", () => {
    const r = checkoutSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.celular).toBe("3101234567");
      expect(r.data.documento).toBeNull();
      expect(r.data.notas).toBeNull();
    }
  });

  it("recoger en bodega no pide sector ni dirección", () => {
    expect(checkoutSchema.safeParse({ ...base, recoge_en_bodega: true, sector_id: null, direccion: "" }).success).toBe(true);
  });

  it("a domicilio exige sector y dirección", () => {
    const r = checkoutSchema.safeParse({ ...base, sector_id: null, direccion: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const campos = r.error.issues.map((i) => i.path[0]);
      expect(campos).toContain("sector_id");
      expect(campos).toContain("direccion");
    }
  });

  it("exige aceptar la política de datos, rechaza el honeypot lleno y el carrito vacío", () => {
    expect(checkoutSchema.safeParse({ ...base, acepta_datos: false }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, web: "http://spam.com" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, items: [] }).success).toBe(false);
  });

  it("valida cantidades y documento", () => {
    expect(checkoutSchema.safeParse({ ...base, items: [{ varianteId: 1, cantidad: 0 }] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, items: [{ varianteId: 1, cantidad: 1.5 }] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, documento: "900.123.456-7" }).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...base, documento: "abc" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, celular: "123" }).success).toBe(false);
  });
});

describe("mensaje de WhatsApp (RF-10)", () => {
  const pedido: DatosMensajePedido = {
    numero: "EV-000123",
    cliente: { nombre: "Juan Pérez", negocio: "Tienda La Esquina", celular: "3101234567" },
    entrega: { lugar: "Calarcá – Barrio Centro", fechaCorta: "jueves 12/11", direccion: "Cra 25 # 30-12" },
    notas: null,
    lineas: [
      { nombre: "Lentejas Doña Lupe", presentacion: "400 g", cantidad: 12, precioUnitario: 3200, subtotal: 38400, tipo: "mayor" },
      { nombre: "Atún La Soberana", presentacion: "140 g", cantidad: 6, precioUnitario: 5900, subtotal: 35400, tipo: "unidad" },
    ],
    subtotal: 78900,
    descuentoMayor: 4800,
    costoEnvio: 0,
    total: 74100,
  };

  it("sigue el formato del documento de requerimientos", () => {
    expect(armarMensajePedido(pedido)).toBe(
      [
        "*Pedido EV-000123*",
        "Cliente: Juan Pérez – Tienda La Esquina",
        "Cel: 3101234567",
        "Entrega: Calarcá – Barrio Centro · jueves 12/11",
        "Dirección: Cra 25 # 30-12",
        "",
        "1. Lentejas Doña Lupe 400 g x12 – $3.200 c/u = $38.400 (mayor)",
        "2. Atún La Soberana 140 g x6 – $5.900 c/u = $35.400",
        "",
        "Subtotal: $78.900",
        "Ahorro por mayor: $4.800",
        "*Total: $74.100*",
        "Pago: contraentrega",
      ].join("\n"),
    );
  });

  it("recoger en bodega no lleva dirección; el envío y las notas solo si existen", () => {
    const m = armarMensajePedido({
      ...pedido,
      cliente: { ...pedido.cliente, negocio: null },
      entrega: { lugar: "Recoge en bodega", fechaCorta: "sábado 14/11", direccion: null },
      notas: "Llamar al llegar",
      costoEnvio: 3000,
      descuentoMayor: 0,
      total: 81900,
    });
    expect(m).toContain("Cliente: Juan Pérez\n");
    expect(m).toContain("Entrega: Recoge en bodega · sábado 14/11");
    expect(m).not.toContain("Dirección:");
    expect(m).toContain("Notas: Llamar al llegar");
    expect(m).toContain("Envío: $3.000");
    expect(m).not.toContain("Ahorro por mayor");
  });

  it("un pedido muy largo se recorta sin pasar del límite", () => {
    const muchas = Array.from({ length: 80 }, (_, i) => ({
      nombre: `Producto de nombre largo número ${i + 1}`, presentacion: "500 g", cantidad: 2, precioUnitario: 1500, subtotal: 3000, tipo: "unidad" as const,
    }));
    const m = armarMensajePedido({ ...pedido, lineas: muchas });
    expect(m.length).toBeLessThanOrEqual(1500);
    expect(m).toMatch(/… y \d+ productos más \(ver el pedido EV-000123\)/);
    expect(m).toContain("*Total: $74.100*"); // el total nunca se recorta
  });

  it("pesoCompacto", () => {
    expect(pesoCompacto(3200)).toBe("$3.200");
    expect(pesoCompacto(1234567)).toBe("$1.234.567");
    expect(pesoCompacto(0)).toBe("$0");
  });
});

describe("lo guardado en el navegador se limpia antes de usarse", () => {
  it("conserva los ítems válidos y descarta los dañados o repetidos", () => {
    const bueno = item(1, 3);
    const r = sanitizarItems([
      bueno,
      bueno, // repetido
      { ...bueno, varianteId: 2, cantidad: 0 }, // cantidad inválida
      { ...bueno, varianteId: 3, precio: { ...bueno.precio, precioUnidad: -5 } },
      { ...bueno, varianteId: 4, precio: null },
      "basura",
      null,
      { ...bueno, varianteId: 5, imagen: "javascript:alert(1)", cantidad: 1e9 },
    ]);
    expect(r.map((i) => i.varianteId)).toEqual([1, 5]);
    expect(r[1].imagen).toBeNull();
    expect(r[1].cantidad).toBe(9999);
  });

  it("algo que no es una lista da un carrito vacío", () => {
    expect(sanitizarItems(undefined)).toEqual([]);
    expect(sanitizarItems({ a: 1 })).toEqual([]);
  });

  it("sanitizarUbicacion", () => {
    expect(sanitizarUbicacion({ tipo: "bodega" })).toEqual({ tipo: "bodega" });
    expect(sanitizarUbicacion({ tipo: "sector", municipioId: 2, sectorId: 5, extra: 1 })).toEqual({ tipo: "sector", municipioId: 2, sectorId: 5 });
    expect(sanitizarUbicacion({ tipo: "sector", municipioId: 2 })).toBeNull();
    expect(sanitizarUbicacion("bodega")).toBeNull();
    expect(sanitizarUbicacion(null)).toBeNull();
  });
});
