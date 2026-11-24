"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cambiarEstadoPedido } from "@/app/admin/(panel)/pedidos/actions";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/lib/formato";
import {
  ACCION_AVANZAR,
  ETIQUETA_ESTADO,
  esFinal,
  puedeCancelarse,
  puedeMarcarNoEntregado,
  requiereConfirmacion,
  siguienteEstado,
  type EstadoPedido,
} from "@/lib/pedidos";

type Modo = "cancelar" | "no_entregado" | "confirmar" | null;

/**
 * Botones para cambiar el estado del pedido (RF-27): avanzar al siguiente paso (con confirmación
 * al despachar o entregar), «no se entregó» y cancelar, ambos con motivo obligatorio. La base de
 * datos vuelve a comprobar el flujo, el rol y la zona: aquí solo se muestran los botones que corresponden.
 */
export function AccionesPedido({
  pedidoId,
  numero,
  total,
  estado,
  puede,
}: {
  pedidoId: number;
  numero: string;
  /** Total a cobrar, para recordarlo al confirmar la entrega. */
  total: number;
  estado: EstadoPedido;
  /** Si este usuario puede cambiar el estado de este pedido (admin, o vendedor de su sector). */
  puede: boolean;
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [modo, setModo] = useState<Modo>(null);
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
      setModo(null);
      setMotivo("");
      router.refresh();
    });
  }

  function abrir(m: Modo) {
    setError(null);
    setMotivo("");
    setModo(m);
  }

  const campoMotivo = (etiqueta: string) => (
    <>
      <label htmlFor="motivo-estado" className="text-sm font-medium">
        {etiqueta}
      </label>
      <textarea
        id="motivo-estado"
        rows={3}
        maxLength={300}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        className="w-full rounded-lg border bg-background px-3 py-2 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
      />
    </>
  );

  return (
    <div className="grid gap-3">
      {error ? (
        <p role="alert" className="rounded-lg border border-destructive bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {siguiente && modo === "confirmar" ? (
        <div className="grid gap-2 rounded-xl border border-ev-azul/50 bg-ev-azul/5 p-3">
          <p className="text-sm font-medium">
            ¿Marcar {numero} como {ETIQUETA_ESTADO[siguiente].toLowerCase()}?
          </p>
          <p className="text-sm text-muted-foreground">
            {siguiente === "entregado"
              ? `Total a cobrar: ${formatCOP(total)}. Pasa a las ventas y no tiene vuelta atrás.`
              : "El pedido sale a reparto."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="h-11" disabled={pendiente} onClick={() => cambiar(siguiente)}>
              {pendiente ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Sí, marcar como {ETIQUETA_ESTADO[siguiente].toLowerCase()}
            </Button>
            <Button type="button" variant="outline" className="h-11" disabled={pendiente} onClick={() => setModo(null)}>
              Volver
            </Button>
          </div>
        </div>
      ) : siguiente ? (
        <Button
          type="button"
          className="h-12 text-base"
          disabled={pendiente}
          onClick={() => (requiereConfirmacion(siguiente) ? abrir("confirmar") : cambiar(siguiente))}
        >
          {pendiente && modo === null ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {ACCION_AVANZAR[estado]}
        </Button>
      ) : null}

      {puedeMarcarNoEntregado(estado) ? (
        modo === "no_entregado" ? (
          <div className="grid gap-2 rounded-xl border p-3">
            {campoMotivo("¿Por qué no se entregó? (obligatorio)")}
            <p className="text-xs text-muted-foreground">
              El pedido vuelve a «Confirmado» para que lo reprogrames y salga otro día.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="h-11"
                disabled={pendiente || motivo.trim() === ""}
                onClick={() => cambiar("confirmado", motivo)}
              >
                {pendiente ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                Devolver a confirmado
              </Button>
              <Button type="button" variant="outline" className="h-11" disabled={pendiente} onClick={() => setModo(null)}>
                Volver
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" className="h-11" onClick={() => abrir("no_entregado")}>
            No se entregó…
          </Button>
        )
      ) : null}

      {puedeCancelarse(estado) ? (
        modo === "cancelar" ? (
          <div className="grid gap-2 rounded-xl border border-destructive/40 p-3">
            {campoMotivo("Motivo de la cancelación (obligatorio)")}
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
              <Button type="button" variant="outline" className="h-11" disabled={pendiente} onClick={() => setModo(null)}>
                No cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" className="mt-2 h-11 text-destructive" onClick={() => abrir("cancelar")}>
            Cancelar pedido…
          </Button>
        )
      ) : null}
    </div>
  );
}
