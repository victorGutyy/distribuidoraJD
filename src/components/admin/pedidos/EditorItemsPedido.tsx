"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { editarItemsPedido } from "@/app/admin/(panel)/pedidos/actions";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/lib/formato";

export type ItemPedidoVista = {
  id: number;
  sku: string;
  nombre_producto: string;
  presentacion: string | null;
  cantidad: number;
  precio_unitario_aplicado: number;
  tipo_precio: string;
  subtotal: number;
};

const ETIQUETA_TIPO: Record<string, string> = { mayor: "con descuento", oferta: "oferta", unidad: "" };

/**
 * Lista de productos del pedido (RF-27, con el precio y nombre que tenían al pedir,
 * RN-08). Si el pedido es editable y el usuario puede, permite cambiar cantidades o
 * quitar productos (cantidad 0) indicando el motivo; queda en el historial.
 */
export function EditorItemsPedido({
  pedidoId,
  items,
  puedeEditar,
}: {
  pedidoId: number;
  items: ItemPedidoVista[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [editando, setEditando] = useState(false);
  const [cantidades, setCantidades] = useState<Record<number, string>>({});
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cambios = items
    .map((i) => ({ id: i.id, cantidad: Number(cantidades[i.id] ?? i.cantidad), original: i.cantidad }))
    .filter((c) => c.cantidad !== c.original);
  const invalida = cambios.some((c) => !Number.isInteger(c.cantidad) || c.cantidad < 0 || c.cantidad > 9999);

  function guardar() {
    setError(null);
    empezar(async () => {
      const r = await editarItemsPedido({
        id: pedidoId,
        items: cambios.map(({ id, cantidad }) => ({ id, cantidad })),
        nota: motivo,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setEditando(false);
      setCantidades({});
      setMotivo("");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Producto</th>
              <th className="px-3 py-2 text-right font-medium">Cantidad</th>
              <th className="px-3 py-2 text-right font-medium">Precio c/u</th>
              <th className="px-3 py-2 text-right font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((i) => {
              const cantidad = editando ? Number(cantidades[i.id] ?? i.cantidad) : i.cantidad;
              const sub = Number.isFinite(cantidad) ? cantidad * i.precio_unitario_aplicado : i.subtotal;
              return (
                <tr key={i.id} className={editando && cantidad === 0 ? "bg-destructive/5 line-through" : undefined}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{i.nombre_producto}</div>
                    <div className="text-xs text-muted-foreground">
                      {[i.presentacion, i.sku].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {editando ? (
                      <>
                        <label htmlFor={`cant-${i.id}`} className="sr-only">
                          Cantidad de {i.nombre_producto}
                        </label>
                        <input
                          id={`cant-${i.id}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={9999}
                          value={cantidades[i.id] ?? String(i.cantidad)}
                          onChange={(e) => setCantidades((c) => ({ ...c, [i.id]: e.target.value }))}
                          className="h-10 w-20 rounded-lg border bg-background px-2 text-right"
                        />
                      </>
                    ) : (
                      i.cantidad
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCOP(i.precio_unitario_aplicado)}
                    {ETIQUETA_TIPO[i.tipo_precio] ? (
                      <div className="text-xs text-muted-foreground">{ETIQUETA_TIPO[i.tipo_precio]}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{formatCOP(sub)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {puedeEditar && !editando ? (
        <div>
          <Button type="button" variant="outline" className="h-11" onClick={() => setEditando(true)}>
            Editar productos
          </Button>
        </div>
      ) : null}

      {editando ? (
        <div className="grid gap-2 rounded-xl border p-3">
          <p className="text-sm text-muted-foreground">
            Cambia las cantidades; con <b>0</b> se quita el producto. Cada unidad conserva el precio con que se cobró.
          </p>
          <label htmlFor="motivo-edicion" className="text-sm font-medium">
            Motivo del cambio (obligatorio)
          </label>
          <input
            id="motivo-edicion"
            type="text"
            maxLength={300}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="h-11 w-full rounded-lg border bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          />
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="h-11"
              disabled={pendiente || cambios.length === 0 || invalida || motivo.trim() === ""}
              onClick={guardar}
            >
              {pendiente ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Guardar cambios ({cambios.length})
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={pendiente}
              onClick={() => {
                setEditando(false);
                setCantidades({});
                setError(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
