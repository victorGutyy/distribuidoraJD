"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cambiarEstadoPedido } from "@/app/admin/(panel)/pedidos/actions";
import { Button } from "@/components/ui/button";
import {
  ACCION_AVANZAR,
  esFinal,
  puedeCancelarse,
  siguienteEstado,
  type EstadoPedido,
} from "@/lib/pedidos";

/**
 * Botones para cambiar el estado del pedido (RF-27): avanzar al siguiente paso y
 * cancelar con motivo obligatorio. La base de datos vuelve a comprobar el flujo, el
 * rol y la zona: aquí solo se muestran los botones que corresponden.
 */
export function AccionesPedido({
  pedidoId,
  estado,
  puede,
}: {
  pedidoId: number;
  estado: EstadoPedido;
  /** Si este usuario puede cambiar el estado de este pedido (admin, o vendedor de su sector). */
  puede: boolean;
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");

  const siguiente = siguienteEstado(estado);

  if (!puede) {
    return <p className="text-sm text-muted-foreground">Solo puedes ver este pedido; no puedes cambiar su estado.</p>;
  }
  if (esFinal(estado)) {
    return (
      <p className="text-sm text-muted-foreground">
        {estado === "entregado" ? "Este pedido ya fue entregado." : "Este pedido está cancelado."} No admite más cambios.
      </p>
    );
  }

  function cambiar(nuevo: EstadoPedido, nota?: string) {
    setError(null);
    empezar(async () => {
      const r = await cambiarEstadoPedido({ id: pedidoId, estado: nuevo, nota });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setCancelando(false);
      setMotivo("");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3">
      {error ? (
        <p role="alert" className="rounded-lg border border-destructive bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {siguiente ? (
        <Button type="button" className="h-12 text-base" disabled={pendiente} onClick={() => cambiar(siguiente)}>
          {pendiente && !cancelando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {ACCION_AVANZAR[estado]}
        </Button>
      ) : null}

      {puedeCancelarse(estado) ? (
        cancelando ? (
          <div className="grid gap-2 rounded-xl border border-destructive/40 p-3">
            <label htmlFor="motivo-cancelar" className="text-sm font-medium">
              Motivo de la cancelación (obligatorio)
            </label>
            <textarea
              id="motivo-cancelar"
              rows={3}
              maxLength={300}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="destructive"
                className="h-11"
                disabled={pendiente || motivo.trim() === ""}
                onClick={() => cambiar("cancelado", motivo)}
              >
                {pendiente ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                Sí, cancelar el pedido
              </Button>
              <Button type="button" variant="outline" className="h-11" disabled={pendiente} onClick={() => setCancelando(false)}>
                No cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" className="h-11 text-destructive" onClick={() => setCancelando(true)}>
            Cancelar pedido…
          </Button>
        )
      ) : null}
    </div>
  );
}
