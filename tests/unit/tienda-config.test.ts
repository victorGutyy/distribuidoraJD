import { describe, expect, it } from "vitest";
import { leerConfigTienda } from "@/lib/tienda/config";
import { enlaceWhatsApp, normalizarCelularWhatsApp } from "@/lib/whatsapp";

describe("normalizarCelularWhatsApp", () => {
  it("deja el número en formato internacional", () => {
    expect(normalizarCelularWhatsApp("310 123 4567")).toBe("573101234567");
    expect(normalizarCelularWhatsApp("+57 310 123 4567")).toBe("573101234567");
    expect(normalizarCelularWhatsApp(3101234567)).toBe("573101234567");
    expect(normalizarCelularWhatsApp("573101234567")).toBe("573101234567");
  });

  it("rechaza lo que no es un celular colombiano", () => {
    expect(normalizarCelularWhatsApp(null)).toBeNull();
    expect(normalizarCelularWhatsApp("")).toBeNull();
    expect(normalizarCelularWhatsApp("6061234567")).toBeNull(); // fijo
    expect(normalizarCelularWhatsApp("310123")).toBeNull();
    expect(normalizarCelularWhatsApp({})).toBeNull();
  });
});

describe("enlaceWhatsApp", () => {
  it("codifica el mensaje", () => {
    expect(enlaceWhatsApp("573101234567", "Hola, quiero pedir")).toBe(
      "https://wa.me/573101234567?text=Hola%2C%20quiero%20pedir",
    );
    expect(enlaceWhatsApp("573101234567")).toBe("https://wa.me/573101234567");
  });
});

describe("leerConfigTienda", () => {
  it("con la configuración inicial de la base usa valores seguros", () => {
    const c = leerConfigTienda([
      { clave: "mensaje_barra_superior", valor: "Compra por mayor y ahorra" },
      { clave: "whatsapp_pedidos", valor: null },
      { clave: "pedido_minimo", valor: 0 },
      { clave: "empresa", valor: { nit: null, redes: {}, nombre: "EV Distribuidora", horarios: null, direccion: null } },
    ]);
    expect(c.mensajeBarra).toBe("Compra por mayor y ahorra");
    expect(c.whatsapp).toBeNull();
    expect(c.pedidoMinimo).toBe(0);
    expect(c.mensajeWhatsApp).toBe("Hola, quiero hacer un pedido");
    expect(c.empresa).toEqual({ nombre: "EV Distribuidora", direccion: null, horarios: null, redes: [] });
  });

  it("sin ninguna fila tampoco falla", () => {
    const c = leerConfigTienda([]);
    expect(c.empresa.nombre).toBe("EV Distribuidora");
    expect(c.mensajeBarra).toBeNull();
  });

  it("solo acepta redes con https", () => {
    const c = leerConfigTienda([
      {
        clave: "empresa",
        valor: { redes: { instagram: "https://instagram.com/ev", malo: "javascript:alert(1)", http: "http://x.com" } },
      },
    ]);
    expect(c.empresa.redes).toEqual([{ nombre: "instagram", url: "https://instagram.com/ev" }]);
  });

  it("normaliza el WhatsApp y el pedido mínimo", () => {
    const c = leerConfigTienda([
      { clave: "whatsapp_pedidos", valor: "310 123 4567" },
      { clave: "pedido_minimo", valor: 50000.4 },
    ]);
    expect(c.whatsapp).toBe("573101234567");
    expect(c.pedidoMinimo).toBe(50000);
  });
});
