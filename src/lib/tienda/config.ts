import { normalizarCelularWhatsApp } from "@/lib/whatsapp";

/**
 * Configuración PÚBLICA de la tienda (tabla `configuracion`, solo las claves que
 * RLS deja leer a cualquier visitante). Lógica PURA, con pruebas: convierte las
 * filas {clave, valor} en un objeto tipado y tolera valores vacíos o mal escritos.
 */

export type ConfigTienda = {
  mensajeBarra: string | null;
  /** Número internacional listo para wa.me ("573101234567"), o null si no hay. */
  whatsapp: string | null;
  mensajeWhatsApp: string;
  pedidoMinimo: number;
  /** Regla del precio por mayor: por cantidad (RN-02) o por monto del pedido (RN-03). */
  reglaMayoreo: "por_cantidad" | "por_monto" | "ambas";
  umbralMayorMonto: number;
  /** "HH:MM" límite, el día anterior al reparto, para entrar en esa ruta. */
  horaCorte: string;
  /** Fechas "AAAA-MM-DD" sin reparto ni atención. */
  diasNoHabiles: string[];
  empresa: {
    nombre: string;
    direccion: string | null;
    horarios: string | null;
    redes: { nombre: string; url: string }[];
  };
};

export type FilaConfig = { clave: string; valor: unknown };

const texto = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

const entero = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0;

const horaValida = (v: unknown): string | null =>
  typeof v === "string" && /^([01]?\d|2[0-3]):[0-5]\d$/.test(v.trim()) ? v.trim() : null;

const reglaValida = (v: unknown): "por_cantidad" | "por_monto" | "ambas" =>
  v === "por_monto" || v === "ambas" ? v : "por_cantidad";

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function leerConfigTienda(filas: readonly FilaConfig[]): ConfigTienda {
  const por = new Map(filas.map((f) => [f.clave, f.valor]));
  const empresa = esObjeto(por.get("empresa")) ? (por.get("empresa") as Record<string, unknown>) : {};
  const redes = esObjeto(empresa.redes) ? empresa.redes : {};

  return {
    mensajeBarra: texto(por.get("mensaje_barra_superior")),
    whatsapp: normalizarCelularWhatsApp(por.get("whatsapp_pedidos")),
    mensajeWhatsApp:
      texto(por.get("mensaje_whatsapp_flotante")) ??
      "Hola, quiero hacer un pedido",
    pedidoMinimo: entero(por.get("pedido_minimo")),
    reglaMayoreo: reglaValida(por.get("regla_mayoreo")),
    umbralMayorMonto: entero(por.get("umbral_mayor_monto")),
    horaCorte: horaValida(por.get("hora_corte")) ?? "17:00",
    diasNoHabiles: Array.isArray(por.get("dias_no_habiles"))
      ? (por.get("dias_no_habiles") as unknown[]).filter(
          (d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d),
        )
      : [],
    empresa: {
      nombre: texto(empresa.nombre) ?? "EV Distribuidora",
      direccion: texto(empresa.direccion),
      horarios: texto(empresa.horarios),
      // Solo enlaces https: nunca se pinta un javascript: ni un texto cualquiera.
      redes: Object.entries(redes).flatMap(([nombre, url]) =>
        typeof url === "string" && /^https:\/\//i.test(url.trim())
          ? [{ nombre, url: url.trim() }]
          : [],
      ),
    },
  };
}
