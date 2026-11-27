/**
 * Valores de la configuración, convertidos a TEXTO para rellenar los formularios del
 * panel. Lógica PURA, con pruebas. Lee los valores crudos (jsonb) de la tabla
 * `configuracion` tolerando lo vacío, lo ausente y lo mal escrito.
 */

export type FilaConfigCruda = { clave: string; valor: unknown };

export type ValoresConfigFormulario = {
  whatsapp: string;
  mensaje_whatsapp: string;
  mensaje_barra: string;
  pedido_minimo: string;
  descuento_monto_minimo: string;
  descuento_porcentaje: string;
  hora_corte: string;
  dias_no_habiles: string;
  empresa: {
    nombre: string;
    nit: string;
    direccion: string;
    horarios: string;
    facebook: string;
    instagram: string;
    tiktok: string;
  };
};

const txt = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown): string =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? String(Math.round(v)) : "0";
const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function valoresConfigFormulario(filas: readonly FilaConfigCruda[]): ValoresConfigFormulario {
  const por = new Map(filas.map((f) => [f.clave, f.valor]));
  const empresa = esObjeto(por.get("empresa")) ? (por.get("empresa") as Record<string, unknown>) : {};
  const redes = esObjeto(empresa.redes) ? empresa.redes : {};
  const hora = txt(por.get("hora_corte"));
  const dias = por.get("dias_no_habiles");

  // El celular se guarda con 57; en el formulario se escribe sin él.
  const celular = txt(por.get("whatsapp_pedidos")).replace(/\D/g, "").replace(/^57(?=3\d{9}$)/, "");

  return {
    whatsapp: celular,
    mensaje_whatsapp: txt(por.get("mensaje_whatsapp_flotante")) || "Hola, quiero hacer un pedido en EV Distribuidora",
    mensaje_barra: txt(por.get("mensaje_barra_superior")),
    pedido_minimo: num(por.get("pedido_minimo")),
    descuento_monto_minimo: num(por.get("descuento_monto_minimo")),
    descuento_porcentaje: num(por.get("descuento_porcentaje")),
    hora_corte: /^([01]?\d|2[0-3]):[0-5]\d$/.test(hora) ? hora : "17:00",
    dias_no_habiles: Array.isArray(dias) ? dias.filter((d): d is string => typeof d === "string").join("\n") : "",
    empresa: {
      nombre: txt(empresa.nombre) || "EV Distribuidora",
      nit: txt(empresa.nit),
      direccion: txt(empresa.direccion),
      horarios: txt(empresa.horarios),
      facebook: txt(redes.facebook),
      instagram: txt(redes.instagram),
      tiktok: txt(redes.tiktok),
    },
  };
}

/**
 * La columna `valor` es jsonb NOT NULL, y un null de JSON llega a Postgres como NULL
 * de SQL (que la tabla rechaza). Lo "vacío" se guarda como texto vacío: la tienda ya
 * lo lee como "sin valor".
 */
export const paraGuardar = (v: string | null): string => v ?? "";
