"use client";

import { ShoppingCart } from "lucide-react";
import { totalUnidades } from "@/lib/carrito";
import { useCarrito } from "@/stores/carrito";

/** Botón del carrito en el encabezado, con el contador de unidades (RF-01). Abre el panel lateral. */
export function BotonCarrito() {
  const hidratado = useCarrito((s) => s.hidratado);
  const items = useCarrito((s) => s.items);
  const abrir = useCarrito((s) => s.abrirPanel);
  const unidades = hidratado ? totalUnidades(items) : 0;

  return (
    <button
      type="button"
      onClick={abrir}
      aria-label={unidades > 0 ? `Abrir el carrito, ${unidades} ${unidades === 1 ? "unidad" : "unidades"}` : "Abrir el carrito, vacío"}
      className="relative flex size-11 items-center justify-center rounded-lg hover:bg-muted"
    >
      <ShoppingCart className="size-6" aria-hidden="true" />
      {unidades > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-ev-azul px-1 text-xs font-bold text-white"
        >
          {unidades > 99 ? "99+" : unidades}
        </span>
      ) : null}
    </button>
  );
}
