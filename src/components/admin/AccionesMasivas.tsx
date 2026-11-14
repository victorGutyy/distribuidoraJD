"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  aplicarAccionMasiva,
  type AccionMasivaInput,
} from "@/app/admin/(panel)/productos/actions";
import { claseSelect } from "@/components/admin/CampoForm";
import { Button } from "@/components/ui/button";
import type { OpcionCategoria } from "@/lib/catalogo/categorias";

type Props = {
  ids: number[];
  categorias: OpcionCategoria[];
  /**
   * Resultado de la acción. El AVISO lo muestra el padre: esta barra desaparece
   * al limpiar la selección y se llevaría el mensaje consigo.
   */
  alTerminar: (resultado: AvisoMasivo) => void;
};

export type AvisoMasivo = { tipo: "ok" | "error"; texto: string };

/**
 * Barra que aparece al seleccionar productos: activar, desactivar o mover de
 * categoría (RF-24). El servidor vuelve a comprobar el rol y los datos.
 */
export function AccionesMasivas({ ids, categorias, alTerminar }: Props) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [categoriaId, setCategoriaId] = useState("");

  const ejecutar = (entrada: AccionMasivaInput) => {
    iniciar(async () => {
      const r = await aplicarAccionMasiva(entrada);
      if (r.error) {
        alTerminar({ tipo: "error", texto: r.error });
        return;
      }
      alTerminar({ tipo: "ok", texto: r.ok ?? "Listo." });
      router.refresh();
    });
  };

  return (
    <div className="grid gap-2 rounded-xl border bg-muted/50 p-3">
      <p className="text-sm font-medium" aria-live="polite">
        {ids.length}{" "}
        {ids.length === 1 ? "producto seleccionado" : "productos seleccionados"}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={pendiente}
          onClick={() =>
            ejecutar({ ids, accion: "activar", categoriaId: null })
          }
        >
          Activar
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={pendiente}
          onClick={() =>
            ejecutar({ ids, accion: "desactivar", categoriaId: null })
          }
        >
          Desactivar
        </Button>
        <label className="sr-only" htmlFor="masiva-categoria">
          Categoría de destino
        </label>
        <select
          id="masiva-categoria"
          className={`${claseSelect} w-auto min-w-48`}
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
        >
          <option value="">Mover a la categoría…</option>
          {categorias.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.etiqueta}
            </option>
          ))}
        </select>
        <Button
          type="button"
          className="h-11"
          disabled={pendiente || categoriaId === ""}
          onClick={() =>
            ejecutar({
              ids,
              accion: "categoria",
              categoriaId: Number(categoriaId),
            })
          }
        >
          Mover
        </Button>
      </div>
    </div>
  );
}
