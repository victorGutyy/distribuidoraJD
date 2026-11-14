"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/tienda/Logo";
import type { ItemCarrito } from "@/lib/carrito";
import { formatCOP } from "@/lib/formato";
import type { LineaCalculada } from "@/lib/precios";
import { MAX_CANTIDAD_ITEM } from "@/lib/carrito";
import { useCarrito } from "@/stores/carrito";

/** Una línea del carrito (RF-08): imagen, nombre, presentación, cantidad editable, precio aplicado y subtotal. */
export function FilaCarrito({ item, linea }: { item: ItemCarrito; linea: LineaCalculada | undefined }) {
  const cambiar = useCarrito((s) => s.cambiarCantidad);
  const quitar = useCarrito((s) => s.quitar);
  const nombreCompleto = item.presentacion ? `${item.nombre}, ${item.presentacion}` : item.nombre;

  return (
    <li className="grid grid-cols-[4rem_1fr] gap-3 rounded-xl border bg-background p-3">
      <Link
        href={`/producto/${item.productoSlug}`}
        className="relative block size-16 overflow-hidden rounded-lg bg-muted"
        tabIndex={-1}
        aria-hidden="true"
      >
        {item.imagen ? (
          <Image src={item.imagen} alt="" fill sizes="64px" className="object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center">
            <Logo className="w-8 opacity-30 grayscale" sizes="32px" />
          </span>
        )}
      </Link>

      <div className="grid min-w-0 gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/producto/${item.productoSlug}`} className="line-clamp-2 text-sm font-semibold hover:underline">
              {item.nombre}
            </Link>
            {item.presentacion ? <p className="truncate text-xs text-muted-foreground">{item.presentacion}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => quitar(item.varianteId)}
            aria-label={`Quitar ${nombreCompleto} del carrito`}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>

        {!item.disponible ? (
          <p role="alert" className="text-xs font-semibold text-destructive">
            Agotado: quítalo para continuar con tu pedido.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center">
            <button
              type="button"
              aria-label={`Una unidad menos de ${nombreCompleto}`}
              onClick={() => cambiar(item.varianteId, item.cantidad - 1)}
              className="flex size-9 items-center justify-center rounded-l-lg border hover:bg-muted"
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_CANTIDAD_ITEM}
              aria-label={`Cantidad de ${nombreCompleto}`}
              value={item.cantidad}
              onChange={(e) => cambiar(item.varianteId, Number(e.target.value))}
              className="h-9 w-14 [appearance:textfield] border-y bg-background text-center text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              aria-label={`Una unidad más de ${nombreCompleto}`}
              onClick={() => cambiar(item.varianteId, item.cantidad + 1)}
              className="flex size-9 items-center justify-center rounded-r-lg border hover:bg-muted"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>

          {linea ? (
            <div className="text-right">
              <p className="text-sm font-bold tabular-nums">{formatCOP(linea.subtotal)}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatCOP(linea.precioUnitario)} c/u
                {linea.tipo === "mayor" ? " · por mayor" : linea.tipo === "oferta" ? " · oferta" : ""}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
