"use server";

import { headers } from "next/headers";
import type { DatosVigentes } from "@/lib/carrito";
import {
  CONFIG_ENTREGA_POR_DEFECTO,
  fechaEntregaBodega,
  fechaEntregaSector,
  textoFechaCorta,
  textoFechaEntrega,
} from "@/lib/entregas";
import { calcularCarrito } from "@/lib/precios";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/publico";
import { obtenerConfigTienda } from "@/lib/tienda/datos";
import { leerVigentes } from "@/lib/tienda/vigentes";
import type { PedidoConfirmado } from "@/lib/ultimo-pedido";
import { erroresPorRuta } from "@/lib/validaciones/comun";
import { checkoutSchema, type CheckoutEntrada } from "@/lib/validaciones/pedido";
import { armarMensajePedido } from "@/lib/whatsapp";
import type { Json } from "@/types/database.types";

export type ResultadoPedido =
  | { ok: true; pedido: PedidoConfirmado }
  | {
      ok: false;
      /** Mensaje general para mostrar arriba del formulario. */
      error?: string;
      /** Errores por campo (ruta del formulario → mensaje). */
      errores?: Record<string, string>;
      /** Precios o disponibilidad de hoy, para que el carrito se ponga al día. */
      vigentes?: Record<number, DatosVigentes | null>;
    };

const falla = (error: string, extra: Partial<Extract<ResultadoPedido, { ok: false }>> = {}): ResultadoPedido => ({
  ok: false,
  error,
  ...extra,
});

/** IP de quien hace el pedido, para el límite anti-abuso (RN-13). */
async function ipDeOrigen(): Promise<string | null> {
  const h = await headers();
  const reenviada = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (reenviada || h.get("x-real-ip") || "").slice(0, 64) || null;
}

/**
 * Crea el pedido (RF-10). El navegador solo manda QUÉ quiere (ids y cantidades) y
 * sus datos; los precios, el envío y la fecha de entrega se calculan aquí con lo que
 * dice la base de datos (RN-06). Si el total que la persona veía no coincide, no se
 * crea nada y se le muestra lo nuevo para que confirme.
 */
export async function crearPedido(entrada: CheckoutEntrada): Promise<ResultadoPedido> {
  const parsed = checkoutSchema.safeParse(entrada);
  if (!parsed.success) {
    const errores = erroresPorRuta(parsed.error);
    // Un campo trampa lleno es un bot: no se le dan pistas.
    if ("web" in errores) return falla("No pudimos procesar tu pedido.");
    return { ok: false, errores };
  }
  const d = parsed.data;

  const [config, vigentes] = await Promise.all([
    obtenerConfigTienda(),
    leerVigentes(d.items.map((i) => i.varianteId)),
  ]);
  if (!vigentes) return falla("No pudimos verificar los precios. Inténtalo de nuevo.");

  const paraElCarrito = Object.fromEntries([...vigentes].map(([id, v]) => [id, v ? v.datos : null]));

  // RN-01 y RN-12: solo se vende lo que sigue visible y disponible.
  const noDisponibles = d.items.filter((i) => {
    const v = vigentes.get(i.varianteId);
    return !v || !v.datos.disponible;
  });
  if (noDisponibles.length > 0) {
    return falla("Algunos productos ya no están disponibles. Revisa tu carrito.", { vigentes: paraElCarrito });
  }

  const calculo = calcularCarrito(
    d.items,
    new Map([...vigentes].map(([id, v]) => [id, (v as NonNullable<typeof v>).datos.precio])),
    { regla: config.reglaMayoreo, umbralMonto: config.umbralMayorMonto },
  );

  // Zona de entrega (fresca, no de la caché) y fecha.
  const ahora = new Date();
  const cfgEntrega = {
    horaCorte: config.horaCorte,
    diasNoHabiles: config.diasNoHabiles,
    diasBodega: CONFIG_ENTREGA_POR_DEFECTO.diasBodega,
  };
  let lugar = "Recoger en bodega";
  let costoEnvio = 0;
  let fecha: string | null;
  if (d.recoge_en_bodega) {
    fecha = fechaEntregaBodega(ahora, cfgEntrega);
  } else {
    const supabase = createPublicClient();
    const { data: sector } = await supabase
      .from("sectores")
      .select("id, nombre, dias_reparto, costo_envio, municipio_id")
      .eq("id", d.sector_id as number)
      .eq("activo", true)
      .maybeSingle();
    const { data: municipio } = sector
      ? await supabase.from("municipios").select("nombre").eq("id", sector.municipio_id).eq("activo", true).maybeSingle()
      : { data: null };
    if (!sector || !municipio) {
      return falla("La zona de entrega que elegiste ya no está disponible. Elige otra.", { errores: { sector_id: "Elige otra zona" } });
    }
    lugar = `${municipio.nombre} – ${sector.nombre}`;
    costoEnvio = sector.costo_envio;
    fecha = fechaEntregaSector(ahora, sector.dias_reparto, cfgEntrega);
  }
  if (!fecha) return falla("Esta zona no tiene días de reparto. Elige otra o recoge en bodega.");

  if (config.pedidoMinimo > 0 && calculo.total < config.pedidoMinimo) {
    return falla("Tu pedido no alcanza el mínimo para poder enviarlo.", { vigentes: paraElCarrito });
  }

  const total = calculo.total + costoEnvio;
  if (total !== d.total_visto) {
    return falla("Los precios o el envío cambiaron desde que armaste tu carrito. Revisa el nuevo total y confirma otra vez.", {
      vigentes: paraElCarrito,
    });
  }

  const direccion = d.recoge_en_bodega ? null : d.direccion;
  const { data, error } = await createAdminClient().rpc("crear_pedido", {
    p_datos: {
      cliente: {
        celular: d.celular,
        nombre: d.nombre,
        nombre_negocio: d.nombre_negocio,
        documento: d.documento,
        direccion,
        referencia: d.referencia,
      },
      pedido: {
        sector_id: d.recoge_en_bodega ? null : d.sector_id,
        recoge_en_bodega: d.recoge_en_bodega,
        direccion_entrega: direccion,
        fecha_entrega_estimada: fecha,
        subtotal: calculo.subtotal,
        descuento_mayor: calculo.descuentoMayor,
        costo_envio: costoEnvio,
        total,
        notas: d.notas,
        ip_origen: await ipDeOrigen(),
      },
      items: calculo.lineas.map((l) => {
        const v = (vigentes.get(l.varianteId) as NonNullable<ReturnType<typeof vigentes.get>>);
        return {
          variante_id: l.varianteId,
          sku: v.sku,
          nombre_producto: v.datos.nombre,
          presentacion: v.datos.presentacion,
          cantidad: l.cantidad,
          precio_unitario_aplicado: l.precioUnitario,
          precio_base: l.precioBase,
          tipo_precio: l.tipo,
          subtotal: l.subtotal,
        };
      }),
    } as Json,
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data) || typeof data.numero !== "string") {
    const mensaje = error?.message ?? "";
    if (mensaje.includes("LIMITE")) {
      return falla("Has enviado varios pedidos en poco tiempo. Espera unos minutos e inténtalo de nuevo.");
    }
    if (mensaje.includes("ZONA")) {
      return falla("La zona o el costo de envío cambiaron. Vuelve a elegir tu zona.", { vigentes: paraElCarrito });
    }
    return falla("No pudimos crear tu pedido. Inténtalo de nuevo; si el problema sigue, escríbenos por WhatsApp.");
  }

  const numero = data.numero;
  const lineas = calculo.lineas.map((l) => {
    const v = (vigentes.get(l.varianteId) as NonNullable<ReturnType<typeof vigentes.get>>).datos;
    return { nombre: v.nombre, presentacion: v.presentacion, cantidad: l.cantidad, precioUnitario: l.precioUnitario, subtotal: l.subtotal, tipo: l.tipo };
  });
  const mensaje = armarMensajePedido({
    numero,
    cliente: { nombre: d.nombre, negocio: d.nombre_negocio, celular: d.celular },
    entrega: {
      lugar,
      fechaCorta: textoFechaCorta(fecha),
      direccion: direccion ? `${direccion}${d.referencia ? ` (${d.referencia})` : ""}` : null,
    },
    notas: d.notas,
    lineas,
    subtotal: calculo.subtotal,
    descuentoMayor: calculo.descuentoMayor,
    costoEnvio,
    total,
  });

  return {
    ok: true,
    pedido: {
      numero,
      mensaje,
      fechaTexto: textoFechaEntrega(fecha),
      lugar,
      clienteNombre: d.nombre,
      subtotal: calculo.subtotal,
      descuentoMayor: calculo.descuentoMayor,
      costoEnvio,
      total,
      lineas: lineas.map((l) => ({ nombre: l.nombre, presentacion: l.presentacion, cantidad: l.cantidad, subtotal: l.subtotal })),
    },
  };
}
