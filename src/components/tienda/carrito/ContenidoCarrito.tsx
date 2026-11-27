"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { consultarVigentes } from "@/app/(tienda)/carrito/actions";
import { FilaCarrito } from "@/components/tienda/carrito/FilaCarrito";
import { useTienda } from "@/components/tienda/carrito/ProveedorTienda";
import { SelectorUbicacion } from "@/components/tienda/carrito/SelectorUbicacion";
import { useResumenCarrito } from "@/components/tienda/carrito/useResumenCarrito";
import { formatCOP } from "@/lib/formato";
import { descuentoConfigurado } from "@/lib/precios";
import { useCarrito } from "@/stores/carrito";
import { cn } from "@/lib/utils";

/**
 * Contenido del carrito (RF-08), compartido por el panel lateral y la página
 * /carrito. Al mostrarse revalida precios y disponibilidad contra el servidor y
 * avisa si algo cambió (RN-06).
 */
export function ContenidoCarrito({ alContinuar }: { alContinuar?: () => void }) {
  const { pedidoMinimo, precios } = useTienda();
  const r = useResumenCarrito();
  const avisos = useCarrito((s) => s.avisos);
  const descartarAvisos = useCarrito((s) => s.descartarAvisos);
  const aplicarVigentes = useCarrito((s) => s.aplicarVigentes);
  const revalidado = useRef(false);

  // Una sola revalidación por vez que se muestra el carrito, cuando ya se leyó el navegador.
  useEffect(() => {
    if (!r.hidratado || revalidado.current || r.items.length === 0) return;
    revalidado.current = true;
    consultarVigentes(r.items.map((i) => i.varianteId))
      .then((vigentes) => {
        const ids = Object.keys(vigentes);
        if (ids.length === 0) return; // el servidor no respondió con datos: no se cambia nada
        aplicarVigentes(new Map(ids.map((id) => [Number(id), vigentes[Number(id)]])));
      })
      .catch(() => undefined); // sin conexión: se muestra lo guardado
  }, [r.hidratado, r.items, aplicarVigentes]);

  if (r.hidratado && r.items.length === 0) {
    return (
      <div className="grid justify-items-center gap-3 p-8 text-center">
        <ShoppingCart className="size-10 text-muted-foreground" aria-hidden="true" />
        <p className="text-lg font-semibold">Tu carrito está vacío</p>
        <p className="text-sm text-muted-foreground">Agrega productos desde el catálogo para armar tu pedido.</p>
        <Link
          href="/catalogo"
          onClick={alContinuar}
          className="inline-flex h-11 items-center rounded-lg bg-ev-azul px-6 text-sm font-semibold text-white"
        >
          Ver el catálogo
        </Link>
      </div>
    );
  }

  const lineas = new Map(r.calculo.lineas.map((l) => [l.varianteId, l]));
  const sinUbicacion = !r.entrega || !r.entrega.fecha;
  const bloqueado = r.items.length === 0 || r.hayAgotados || r.faltaMinimo > 0 || sinUbicacion;
  const motivo = r.hayAgotados
    ? "Quita los productos agotados para continuar."
    : r.faltaMinimo > 0
      ? `Te faltan ${formatCOP(r.faltaMinimo)} para el pedido mínimo (${formatCOP(pedidoMinimo)}).`
      : sinUbicacion
        ? "Elige dónde recibes tu pedido para continuar."
        : null;

  return (
    <div className="grid gap-4">
      {avisos.length > 0 ? (
        <div role="status" className="grid gap-1 rounded-xl border border-ev-dorado bg-ev-dorado/10 p-3 text-sm">
          {avisos.map((a) => (
            <p key={a}>{a}</p>
          ))}
          <button type="button" onClick={descartarAvisos} className="w-fit text-xs font-semibold underline">
            Entendido
          </button>
        </div>
      ) : null}

      <ul className="grid gap-2" aria-label="Productos en tu carrito">
        {r.items.map((item) => (
          <FilaCarrito key={item.varianteId} item={item} linea={lineas.get(item.varianteId)} />
        ))}
      </ul>

      <SelectorUbicacion />

      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-xl border bg-muted/40 p-4 text-sm">
        <dt>Subtotal</dt>
        <dd className="text-right tabular-nums">{formatCOP(r.calculo.subtotal)}</dd>
        {r.calculo.descuentoMayor > 0 ? (
          <>
            <dt className="text-ev-azul">Descuento por tu compra</dt>
            <dd className="text-right text-ev-azul tabular-nums">− {formatCOP(r.calculo.descuentoMayor)}</dd>
          </>
        ) : null}
        <dt>Envío</dt>
        <dd className="text-right tabular-nums">
          {r.entrega ? (r.entrega.costoEnvio > 0 ? formatCOP(r.entrega.costoEnvio) : "Sin costo") : "—"}
        </dd>
        <dt className="pt-1 text-base font-bold">Total</dt>
        <dd className="pt-1 text-right text-base font-bold tabular-nums">{formatCOP(r.total)}</dd>
      </dl>

      {descuentoConfigurado(precios) ? (
        <p
          aria-live="polite"
          className={cn(
            "rounded-lg border p-3 text-sm font-medium",
            r.calculo.descuentoActivo ? "border-ev-azul bg-ev-azul/5 text-ev-azul" : "border-ev-dorado bg-ev-dorado/10",
          )}
        >
          {r.calculo.descuentoActivo
            ? `¡Descuento del ${precios.porcentaje} % aplicado a tu compra!`
            : `Te faltan ${formatCOP(r.calculo.faltaParaDescuento)} para el ${precios.porcentaje} % de descuento (compras desde ${formatCOP(precios.montoMinimo)}).`}
        </p>
      ) : null}

      {pedidoMinimo > 0 ? (
        <div aria-live="polite" className="grid gap-1">
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="presentation">
            <div
              className={cn("h-full rounded-full transition-all", r.faltaMinimo > 0 ? "bg-ev-dorado" : "bg-ev-azul")}
              style={{ width: `${Math.min(100, Math.round((r.calculo.total / pedidoMinimo) * 100))}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {r.faltaMinimo > 0
              ? `Te faltan ${formatCOP(r.faltaMinimo)} para el pedido mínimo.`
              : "¡Ya alcanzaste el pedido mínimo!"}
          </p>
        </div>
      ) : null}

      {motivo ? <p className="text-sm text-muted-foreground">{motivo}</p> : null}

      {bloqueado ? (
        <span
          aria-disabled="true"
          className="inline-flex h-12 cursor-not-allowed items-center justify-center rounded-lg bg-ev-azul px-6 text-base font-semibold text-white opacity-50"
        >
          Finalizar pedido
        </span>
      ) : (
        <Link
          href="/checkout"
          onClick={alContinuar}
          className="inline-flex h-12 items-center justify-center rounded-lg bg-ev-azul px-6 text-base font-semibold text-white hover:bg-ev-azul/90"
        >
          Finalizar pedido
        </Link>
      )}
    </div>
  );
}
