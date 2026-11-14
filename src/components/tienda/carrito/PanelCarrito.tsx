"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { ContenidoCarrito } from "@/components/tienda/carrito/ContenidoCarrito";
import { useCarrito } from "@/stores/carrito";

/**
 * Panel lateral del carrito (RF-08). Usa el <dialog> nativo: bloquea el fondo, se
 * cierra con Esc y atrapa el foco, sin librerías. El contenido solo se monta
 * cuando está abierto, para revalidar los precios en ese momento.
 */
export function PanelCarrito() {
  const ref = useRef<HTMLDialogElement>(null);
  const abierto = useCarrito((s) => s.panelAbierto);
  const cerrar = useCarrito((s) => s.cerrarPanel);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      aria-label="Tu carrito"
      onClose={cerrar}
      onClick={(e) => {
        if (e.target === ref.current) cerrar(); // clic en el fondo oscuro
      }}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-md overflow-y-auto bg-background p-0 text-foreground backdrop:bg-black/50"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-2">
        <h2 className="text-lg font-bold">Tu carrito</h2>
        <button
          type="button"
          aria-label="Cerrar el carrito"
          onClick={cerrar}
          className="flex size-11 items-center justify-center rounded-lg hover:bg-muted"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div className="p-4 pb-10">{abierto ? <ContenidoCarrito alContinuar={cerrar} /> : null}</div>
    </dialog>
  );
}
