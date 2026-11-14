"use client";

import { useRouter } from "next/navigation";
import {
  ETIQUETA_ORDEN,
  ORDENES_CATALOGO,
  urlCatalogo,
  type FiltrosCatalogo,
  type OrdenCatalogo,
} from "@/lib/tienda/filtros-catalogo";

/** Selector de orden (RF-02): al cambiarlo se navega a la misma lista con otro orden. */
export function OrdenCatalogoSelect({ filtros }: { filtros: FiltrosCatalogo }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-muted-foreground sm:inline">Ordenar por</span>
      <select
        value={filtros.orden}
        onChange={(e) => router.push(urlCatalogo(filtros, { orden: e.target.value as OrdenCatalogo }))}
        aria-label="Ordenar por"
        className="h-11 rounded-lg border bg-background px-3 text-base md:text-sm"
      >
        {ORDENES_CATALOGO.map((o) => (
          <option key={o} value={o}>
            {ETIQUETA_ORDEN[o]}
          </option>
        ))}
      </select>
    </label>
  );
}
