import { describe, expect, it } from "vitest";
import { armarCorreoPedidoNuevo, debeSonar, escaparHtml, leerDestinatarios } from "@/lib/aviso-pedido";

const base = {
  numero: "EV-000123",
  clienteNombre: "Ana <b>Pérez</b>",
  clienteNegocio: "Tienda La 14",
  clienteCelular: "3101234567",
  lugar: "Armenia – Centro",
  fechaTexto: "martes 25 de noviembre",
  total: 62000,
  cantidadLineas: 3,
  enlacePanel: "https://ev.co/admin/pedidos/9",
};

describe("armarCorreoPedidoNuevo", () => {
  it("lleva el número y el total en el asunto", () => {
    const c = armarCorreoPedidoNuevo(base);
    expect(c.asunto).toContain("EV-000123");
    expect(c.asunto).toContain("62.000");
  });
  it("escapa el HTML que venga de lo que escribió el cliente", () => {
    const c = armarCorreoPedidoNuevo(base);
    expect(c.html).not.toContain("<b>Pérez</b>");
    expect(c.html).toContain("&lt;b&gt;");
  });
  it("incluye el enlace al panel solo si se conoce", () => {
    expect(armarCorreoPedidoNuevo(base).texto).toContain("https://ev.co/admin/pedidos/9");
    const sin = armarCorreoPedidoNuevo({ ...base, enlacePanel: null });
    expect(sin.html).not.toContain("Abrir en el panel");
  });
  it("singular y plural de productos", () => {
    expect(armarCorreoPedidoNuevo({ ...base, cantidadLineas: 1 }).texto).toContain("1 producto ·");
    expect(armarCorreoPedidoNuevo(base).texto).toContain("3 productos ·");
  });
});

describe("escaparHtml", () => {
  it("neutraliza etiquetas y comillas", () => {
    expect(escaparHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });
});

describe("leerDestinatarios", () => {
  it("separa por coma, punto y coma o espacio y descarta lo inválido", () => {
    expect(leerDestinatarios("a@x.co, b@y.co; nada ,c@z.com")).toEqual(["a@x.co", "b@y.co", "c@z.com"]);
    expect(leerDestinatarios(undefined)).toEqual([]);
    expect(leerDestinatarios("")).toEqual([]);
  });
});

describe("debeSonar", () => {
  it("no suena en la primera lectura ni si el conteo baja o se mantiene", () => {
    expect(debeSonar(null, 5)).toBe(false);
    expect(debeSonar(3, 3)).toBe(false);
    expect(debeSonar(3, 1)).toBe(false);
  });
  it("suena cuando sube", () => {
    expect(debeSonar(0, 1)).toBe(true);
    expect(debeSonar(2, 4)).toBe(true);
  });
});
