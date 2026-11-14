import { describe, expect, it } from "vitest";
import { leerClienteGuardado, leerUltimoPedido, type PedidoConfirmado } from "@/lib/ultimo-pedido";

const pedido: PedidoConfirmado = {
  numero: "EV-000123",
  mensaje: "*Pedido EV-000123*\nTotal: $1.000",
  fechaTexto: "jueves 12 de noviembre",
  lugar: "Calarcá – Barrio Centro",
  clienteNombre: "Juan Pérez",
  subtotal: 1000,
  descuentoMayor: 0,
  costoEnvio: 0,
  total: 1000,
  lineas: [{ nombre: "Arroz", presentacion: "500 g", cantidad: 1, subtotal: 1000 }],
};

describe("leerUltimoPedido", () => {
  it("lee un pedido guardado", () => {
    expect(leerUltimoPedido(JSON.stringify(pedido))).toEqual(pedido);
  });

  it("descarta lo vacío, dañado o alterado", () => {
    expect(leerUltimoPedido(null)).toBeNull();
    expect(leerUltimoPedido("no es json")).toBeNull();
    expect(leerUltimoPedido("[]")).toBeNull();
    expect(leerUltimoPedido(JSON.stringify({ ...pedido, numero: "123" }))).toBeNull();
    expect(leerUltimoPedido(JSON.stringify({ ...pedido, total: -5 }))).toBeNull();
    expect(leerUltimoPedido(JSON.stringify({ ...pedido, total: "1000" }))).toBeNull();
    expect(leerUltimoPedido(JSON.stringify({ ...pedido, lineas: "x" }))).toBeNull();
  });

  it("ignora las líneas dañadas pero conserva las buenas", () => {
    const r = leerUltimoPedido(JSON.stringify({ ...pedido, lineas: [pedido.lineas[0], { nombre: 5 }, null] }));
    expect(r?.lineas).toHaveLength(1);
  });
});

describe("leerClienteGuardado", () => {
  it("lee los datos y rellena lo que falta con texto vacío", () => {
    expect(leerClienteGuardado(JSON.stringify({ nombre: "Juan", celular: "3101234567" }))).toEqual({
      nombre: "Juan", celular: "3101234567", nombre_negocio: "", documento: "", direccion: "", referencia: "",
    });
  });

  it("sin nombre o celular no sirve", () => {
    expect(leerClienteGuardado(JSON.stringify({ nombre: "Juan" }))).toBeNull();
    expect(leerClienteGuardado("basura")).toBeNull();
    expect(leerClienteGuardado(null)).toBeNull();
  });
});
