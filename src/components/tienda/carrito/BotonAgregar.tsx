"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { DatosItem } from "@/lib/carrito";
import { useCarrito } from "@/stores/carrito";
import { cn } from "@/lib/utils";

type Props = {
  /** Presentación a agregar; null si el producto tiene varias y hay que elegir. */
  item: DatosItem | null;
  /** Cuántas unidades agregar (en la tarjeta es 1). */
  cantidad?: number;
  /** Enlace al detalle, para elegir presentación. */
  href: string;
  /** Muestra "Ver presentaciones" en lugar de agregar. */
  varias?: boolean;
  className?: string;
};

/**
 * Botón "Agregar" (RF-03). RN-12: una presentación agotada no se puede agregar. Si
 * es la primera vez y no se ha elegido dónde recibir el pedido, abre el carrito
 * para pedirlo (RF-07).
 */
export function BotonAgregar({ item, cantidad = 1, href, varias = false, className }: Props) {
  const agregar = useCarrito((s) => s.agregar);
  const abrirPanel = useCarrito((s) => s.abrirPanel);
  const [agregado, setAgregado] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  const base = "inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold";

  if (varias) {
    return (
      <Link href={href} className={cn(base, "border border-ev-azul text-ev-azul hover:bg-ev-azul/5", className)}>
        Ver presentaciones
      </Link>
    );
  }
  if (!item || !item.disponible) {
    return (
      <button type="button" disabled className={cn(base, "bg-muted text-muted-foreground", className)}>
        Agotado
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        const r = agregar(item, cantidad);
        if (!r.agregado) {
          abrirPanel(); // carrito lleno: que la persona lo revise
          return;
        }
        setAgregado(true);
        clearTimeout(temporizador.current);
        temporizador.current = setTimeout(() => setAgregado(false), 1800);
        if (useCarrito.getState().ubicacion === null) abrirPanel();
      }}
      className={cn(base, "bg-ev-azul text-white hover:bg-ev-azul/90", className)}
    >
      <span aria-live="polite" className="flex items-center gap-1.5">
        {agregado ? (
          <>
            <Check className="size-4" aria-hidden="true" /> Agregado
          </>
        ) : (
          "Agregar"
        )}
      </span>
    </button>
  );
}
