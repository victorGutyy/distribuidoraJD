/**
 * Aviso de pedido nuevo para el equipo. Lógica PURA, con pruebas.
 * (El envío real del correo está en lib/correo.ts; aquí solo se arma el contenido.)
 */

import { formatCOP } from "@/lib/formato";

export type DatosAvisoPedido = {
  numero: string;
  clienteNombre: string;
  clienteNegocio: string | null;
  clienteCelular: string;
  lugar: string;
  fechaTexto: string;
  total: number;
  cantidadLineas: number;
  /** Dirección completa del panel (https://…/admin/pedidos/ID) o null si no se conoce. */
  enlacePanel: string | null;
};

export function escaparHtml(t: string): string {
  return t
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function armarCorreoPedidoNuevo(d: DatosAvisoPedido): { asunto: string; texto: string; html: string } {
  const productos = `${d.cantidadLineas} ${d.cantidadLineas === 1 ? "producto" : "productos"}`;
  const filas: [string, string][] = [
    ["Cliente", d.clienteNegocio ? `${d.clienteNombre} (${d.clienteNegocio})` : d.clienteNombre],
    ["Celular", d.clienteCelular],
    ["Entrega", `${d.lugar} · ${d.fechaTexto}`],
    ["Pedido", `${productos} · ${formatCOP(d.total)} contraentrega`],
  ];
  const texto = [
    `Nuevo pedido ${d.numero}`,
    ...filas.map(([k, v]) => `${k}: ${v}`),
    d.enlacePanel ? `Ábrelo en el panel: ${d.enlacePanel}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px">
<h2 style="margin:0 0 12px">Nuevo pedido ${escaparHtml(d.numero)}</h2>
<table style="border-collapse:collapse;width:100%">${filas
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 8px 4px 0;color:#555;vertical-align:top">${escaparHtml(k)}</td><td style="padding:4px 0"><b>${escaparHtml(v)}</b></td></tr>`,
    )
    .join("")}</table>${
    d.enlacePanel
      ? `<p style="margin-top:16px"><a href="${escaparHtml(d.enlacePanel)}" style="background:#015bc1;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Abrir en el panel</a></p>`
      : ""
  }</div>`;
  return { asunto: `Nuevo pedido ${d.numero} · ${formatCOP(d.total)}`, texto, html };
}

/** Lista de destinatarios desde una variable de entorno ("a@x.co, b@y.co"); descarta lo que no parece correo. */
export function leerDestinatarios(valor: string | undefined): string[] {
  return (valor ?? "")
    .split(/[,;\s]+/)
    .map((c) => c.trim())
    .filter((c) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c));
}

/** El panel suena cuando LLEGA un pedido nuevo (sube el conteo), no en la primera lectura ni cuando baja. */
export function debeSonar(anterior: number | null, actual: number): boolean {
  return anterior !== null && actual > anterior;
}
