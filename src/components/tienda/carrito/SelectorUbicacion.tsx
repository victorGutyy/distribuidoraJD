"use client";

import { useId } from "react";
import { useTienda } from "@/components/tienda/carrito/ProveedorTienda";
import { useResumenCarrito } from "@/components/tienda/carrito/useResumenCarrito";
import { textoFechaEntrega } from "@/lib/entregas";
import { formatCOP } from "@/lib/formato";
import { useCarrito } from "@/stores/carrito";

const claseSelect =
  "h-11 w-full rounded-lg border bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

/**
 * Ubicación del pedido (RF-07): Municipio → Sector, o "Recogeré en bodega". Muestra
 * la fecha en que llegaría el pedido. La elección queda guardada en el navegador.
 */
export function SelectorUbicacion() {
  const id = useId();
  const { zonas } = useTienda();
  const fijar = useCarrito((s) => s.fijarUbicacion);
  const { ubicacion, entrega, hidratado } = useResumenCarrito();

  const bodega = ubicacion?.tipo === "bodega";
  const municipioId = ubicacion?.tipo === "sector" ? ubicacion.municipioId : null;
  const sectorId = ubicacion?.tipo === "sector" ? ubicacion.sectorId : null;
  const municipio = zonas.find((z) => z.id === municipioId);

  return (
    <fieldset className="grid gap-3 rounded-xl border p-3">
      <legend className="px-1 text-sm font-semibold">¿Dónde recibes tu pedido?</legend>

      {zonas.length > 0 ? (
        <>
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-mun`} className="text-sm font-medium">
              Municipio
            </label>
            <select
              id={`${id}-mun`}
              className={claseSelect}
              disabled={bodega}
              value={municipioId ?? ""}
              onChange={(e) => {
                const z = zonas.find((x) => x.id === Number(e.target.value));
                // Con un solo sector se elige solo; si no, hay que escoger.
                if (z && z.sectores.length === 1) {
                  fijar({ tipo: "sector", municipioId: z.id, sectorId: z.sectores[0].id });
                } else {
                  fijar(z ? { tipo: "sector", municipioId: z.id, sectorId: 0 } : null);
                }
              }}
            >
              <option value="">Elige tu municipio</option>
              {zonas.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <label htmlFor={`${id}-sec`} className="text-sm font-medium">
              Sector
            </label>
            <select
              id={`${id}-sec`}
              className={claseSelect}
              disabled={bodega || !municipio}
              value={sectorId ?? ""}
              onChange={(e) =>
                municipio &&
                fijar({ tipo: "sector", municipioId: municipio.id, sectorId: Number(e.target.value) })
              }
            >
              <option value="">Elige tu sector</option>
              {municipio?.sectores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Por ahora solo puedes recoger tu pedido en la bodega.
        </p>
      )}

      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          checked={bodega}
          disabled={zonas.length === 0}
          onChange={(e) => fijar(e.target.checked ? { tipo: "bodega" } : null)}
          className="size-5 accent-ev-azul"
        />
        Recogeré en bodega
      </label>

      <div aria-live="polite" className="min-h-5 text-sm">
        {!hidratado ? null : entrega ? (
          entrega.fecha ? (
            <p className="font-semibold text-ev-azul">
              {entrega.esBodega ? "Puedes recogerlo el " : "Tu pedido llega el "}
              {textoFechaEntrega(entrega.fecha)}
              {entrega.costoEnvio > 0 ? (
                <span className="font-normal text-muted-foreground"> · Envío {formatCOP(entrega.costoEnvio)}</span>
              ) : null}
            </p>
          ) : (
            <p className="text-muted-foreground">Este sector no tiene días de reparto. Elige otro.</p>
          )
        ) : (
          <p className="text-muted-foreground">Elige tu municipio y sector para ver la fecha de entrega.</p>
        )}
      </div>
    </fieldset>
  );
}
