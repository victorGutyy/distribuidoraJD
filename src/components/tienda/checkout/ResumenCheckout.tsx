"use client";

import Link from "next/link";
import { SelectorUbicacion } from "@/components/tienda/carrito/SelectorUbicacion";
import { useResumenCarrito } from "@/components/tienda/carrito/useResumenCarrito";
import { formatCOP } from "@/lib/formato";

/** Resumen del pedido en el checkout (RF-09): productos, ubicación, fecha y totales. */
export function ResumenCheckout() {
  const r = useResumenCarrito();
  const lineas = new Map(r.calculo.lineas.map((l) => [l.varianteId, l]));

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Tu pedido</h2>
        <Link href="/carrito" className="text-sm font-medium text-ev-azul hover:underline">
          Editar carrito
        </Link>
      </div>

      {r.hidratado && r.items.length === 0 ? (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">
          Tu carrito está vacío.{" "}
          <Link href="/catalogo" className="font-semibold text-ev-azul underline">
            Ver el catálogo
          </Link>
        </p>
      ) : (
        <ul className="grid gap-2" aria-label="Productos de tu pedido">
          {r.items.map((i) => {
            const l = lineas.get(i.varianteId);
            return (
              <li key={i.varianteId} className="flex justify-between gap-3 rounded-lg border p-3 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium">{i.nombre}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[i.presentacion, `x${i.cantidad}`].filter(Boolean).join(" · ")}
                    {l?.tipo === "mayor" ? " · con descuento" : l?.tipo === "oferta" ? " · oferta" : ""}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">{l ? formatCOP(l.subtotal) : ""}</span>
              </li>
            );
          })}
        </ul>
      )}

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
    </div>
  );
}
