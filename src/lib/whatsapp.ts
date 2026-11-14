/**
 * Enlaces de WhatsApp (wa.me) y mensaje del pedido (RF-10). Lógica PURA, con pruebas.
 */

/**
 * Deja el número en formato internacional para wa.me: "57" + 10 dígitos.
 * Acepta "310 123 4567", "+57 310 123 4567" o "573101234567". Devuelve null si
 * no parece un celular colombiano (10 dígitos que empiezan por 3).
 */
export function normalizarCelularWhatsApp(valor: unknown): string | null {
  if (typeof valor !== "string" && typeof valor !== "number") return null;
  const digitos = String(valor).replace(/\D/g, "");
  if (/^3\d{9}$/.test(digitos)) return `57${digitos}`;
  if (/^573\d{9}$/.test(digitos)) return digitos;
  return null;
}

/** https://wa.me/573101234567?text=Hola%20… (el texto va codificado). */
export function enlaceWhatsApp(numero: string, texto?: string): string {
  const base = `https://wa.me/${numero}`;
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}

/** 3200 → "$3.200" (compacto, como en el mensaje del pedido del documento). */
export function pesoCompacto(n: number): string {
  return `$${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

export type DatosMensajePedido = {
  numero: string;
  cliente: { nombre: string; negocio: string | null; celular: string };
  entrega: {
    /** "Calarcá – Barrio Centro" o "Recoge en bodega". */
    lugar: string;
    /** "jueves 12/11" */
    fechaCorta: string | null;
    /** Solo si el pedido se envía a una dirección. */
    direccion: string | null;
  };
  notas: string | null;
  lineas: {
    nombre: string;
    presentacion: string | null;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
    tipo: "unidad" | "oferta" | "mayor";
  }[];
  subtotal: number;
  descuentoMayor: number;
  costoEnvio: number;
  total: number;
};

/**
 * Mensaje que el cliente envía por WhatsApp (formato de RF-10). Si el pedido es
 * muy largo, el texto se recorta ("… y N productos más") para que el enlace no
 * supere lo que WhatsApp admite; el pedido completo ya quedó guardado.
 */
export function armarMensajePedido(d: DatosMensajePedido, maxCaracteres = 1500): string {
  const cabecera = [
    `*Pedido ${d.numero}*`,
    `Cliente: ${d.cliente.nombre}${d.cliente.negocio ? ` – ${d.cliente.negocio}` : ""}`,
    `Cel: ${d.cliente.celular}`,
    `Entrega: ${d.entrega.lugar}${d.entrega.fechaCorta ? ` · ${d.entrega.fechaCorta}` : ""}`,
    ...(d.entrega.direccion ? [`Dirección: ${d.entrega.direccion}`] : []),
    ...(d.notas ? [`Notas: ${d.notas}`] : []),
    "",
  ];

  const lineas = d.lineas.map((l, i) => {
    const etiqueta = l.tipo === "mayor" ? " (mayor)" : l.tipo === "oferta" ? " (oferta)" : "";
    const nombre = l.presentacion ? `${l.nombre} ${l.presentacion}` : l.nombre;
    return `${i + 1}. ${nombre} x${l.cantidad} – ${pesoCompacto(l.precioUnitario)} c/u = ${pesoCompacto(l.subtotal)}${etiqueta}`;
  });

  const pie = [
    "",
    `Subtotal: ${pesoCompacto(d.subtotal)}`,
    ...(d.descuentoMayor > 0 ? [`Ahorro por mayor: ${pesoCompacto(d.descuentoMayor)}`] : []),
    ...(d.costoEnvio > 0 ? [`Envío: ${pesoCompacto(d.costoEnvio)}`] : []),
    `*Total: ${pesoCompacto(d.total)}*`,
    "Pago: contraentrega",
  ];

  const fijo = [...cabecera, ...pie].join("\n").length;
  let cuerpo = lineas;
  if (fijo + lineas.join("\n").length > maxCaracteres) {
    let usado = fijo + 60; // reserva para la línea "… y N productos más"
    const caben: string[] = [];
    for (const linea of lineas) {
      if (usado + linea.length + 1 > maxCaracteres) break;
      caben.push(linea);
      usado += linea.length + 1;
    }
    const restantes = lineas.length - caben.length;
    cuerpo = [
      ...caben,
      `… y ${restantes} ${restantes === 1 ? "producto más" : "productos más"} (ver el pedido ${d.numero})`,
    ];
  }
  return [...cabecera, ...cuerpo, ...pie].join("\n");
}
