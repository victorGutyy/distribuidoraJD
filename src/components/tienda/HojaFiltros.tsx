"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";

/**
 * Hoja inferior de filtros para el celular (RF-05). Usa el <dialog> nativo del
 * navegador: bloquea el fondo, se cierra con Esc y el foco queda atrapado dentro,
 * sin librerías. Se cierra sola al elegir una categoría.
 */
export function HojaFiltros({
  activos,
  children,
}: {
  activos: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-11 gap-2 px-4"
        onClick={() => ref.current?.showModal()}
      >
        <SlidersHorizontal aria-hidden="true" />
        Filtros{activos > 0 ? ` (${activos})` : ""}
      </Button>
      <dialog
        ref={ref}
        aria-label="Filtros"
        onClick={(e) => {
          const objetivo = e.target as HTMLElement;
          // Clic en el fondo oscuro o en un enlace: se cierra.
          if (objetivo === ref.current || objetivo.closest("a")) ref.current?.close();
        }}
        className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-2xl bg-background p-0 text-foreground backdrop:bg-black/50"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-2">
          <h2 className="text-base font-semibold">Filtros</h2>
          <button
            type="button"
            aria-label="Cerrar filtros"
            onClick={() => ref.current?.close()}
            className="flex size-11 items-center justify-center rounded-lg hover:bg-muted"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="p-4 pb-8">{children}</div>
      </dialog>
    </>
  );
}
