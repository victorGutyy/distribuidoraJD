"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { formatCOP } from "@/lib/formato";
import {
  mensajeMayoreo,
  precioMostrado,
  type PresentacionVista,
} from "@/lib/tienda/producto";
import { cn } from "@/lib/utils";

const MAX_CANTIDAD = 9999;

/**
 * Selector de presentación y cantidad (RF-06). Muestra el precio según la
 * cantidad y el mensaje de mayoreo; el botón de agregar al carrito se activa en
 * la fase F5. La ficha técnica sigue a la presentación elegida.
 */
export function SelectorPresentacion({ presentaciones }: { presentaciones: PresentacionVista[] }) {
  const [indice, setIndice] = useState(0);
  const [cantidad, setCantidad] = useState(1);
  const p = presentaciones[indice];
  if (!p) return null;

  const precio = precioMostrado(p, cantidad);
  const mayoreo = mensajeMayoreo(p, cantidad, formatCOP);
  const ajustar = (n: number) => setCantidad(Math.min(MAX_CANTIDAD, Math.max(1, Math.floor(n) || 1)));

  return (
    <div className="grid gap-5">
      {presentaciones.length > 1 ? (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold">Presentación</legend>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
            {presentaciones.map((o, i) => {
              const mejor = o.precioOferta ?? o.precioUnidad;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={i === indice}
                  onClick={() => setIndice(i)}
                  className={cn(
                    "grid min-h-14 gap-0.5 rounded-xl border-2 p-3 text-left transition-colors",
                    i === indice ? "border-ev-azul bg-ev-azul/5" : "hover:border-ev-plata",
                  )}
                >
                  <span className="text-sm font-semibold">{o.etiqueta}</span>
                  <span className="text-xs text-muted-foreground">{o.venta}</span>
                  <span className="text-sm font-bold tabular-nums">{formatCOP(mejor)}</span>
                  {!o.disponible ? <span className="text-xs font-semibold text-muted-foreground">Agotado</span> : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <p className="text-sm text-muted-foreground">
          {p.etiqueta} · {p.venta}
        </p>
      )}

      <div className="grid gap-1">
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-3xl font-bold tabular-nums" aria-live="polite">
            {formatCOP(precio.precio)}
          </span>
          {precio.precio < p.precioUnidad ? (
            <span className="text-base text-muted-foreground tabular-nums line-through">
              {formatCOP(p.precioUnidad)}
            </span>
          ) : null}
          <span className="text-sm text-muted-foreground">c/u</span>
        </p>
        {precio.tipo === "oferta" ? (
          <p className="text-sm font-semibold text-ev-oferta">Precio de oferta</p>
        ) : null}
        {mayoreo ? (
          <p
            className={cn(
              "text-sm font-semibold",
              mayoreo.aplicado ? "text-ev-azul" : "text-ev-dorado-oscuro",
            )}
          >
            {mayoreo.texto}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <label htmlFor="cantidad" className="text-sm font-semibold">
            Cantidad
          </label>
          <div className="flex items-center">
            <button
              type="button"
              aria-label="Una unidad menos"
              onClick={() => ajustar(cantidad - 1)}
              disabled={cantidad <= 1}
              className="flex size-11 items-center justify-center rounded-l-lg border hover:bg-muted disabled:opacity-40"
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <input
              id="cantidad"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_CANTIDAD}
              value={cantidad}
              onChange={(e) => ajustar(Number(e.target.value))}
              className="h-11 w-16 [appearance:textfield] border-y bg-background text-center text-base tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              aria-label="Una unidad más"
              onClick={() => ajustar(cantidad + 1)}
              className="flex size-11 items-center justify-center rounded-r-lg border hover:bg-muted"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <button
          type="button"
          disabled
          title="El carrito estará disponible muy pronto"
          className="h-11 flex-1 rounded-lg bg-ev-azul px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
        >
          {p.disponible ? "Agregar al carrito" : "Agotado"}
        </button>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl border bg-muted/40 p-4 text-sm">
        <dt className="text-muted-foreground">SKU</dt>
        <dd className="font-medium">{p.sku}</dd>
        <dt className="text-muted-foreground">Se vende</dt>
        <dd className="font-medium">{p.venta}</dd>
        {p.peso ? (
          <>
            <dt className="text-muted-foreground">Peso</dt>
            <dd className="font-medium">{p.peso}</dd>
          </>
        ) : null}
        {p.medidas ? (
          <>
            <dt className="text-muted-foreground">Medidas</dt>
            <dd className="font-medium">{p.medidas}</dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}
