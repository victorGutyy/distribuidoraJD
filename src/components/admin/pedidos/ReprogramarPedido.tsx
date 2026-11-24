"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reprogramarPedido } from "@/app/admin/(panel)/pedidos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  pedidoId: number;
  fechaActual: string | null;
  direccionActual: string | null;
  notasActuales: string | null;
  /** Los pedidos que se recogen en bodega no tienen dirección. */
  recogeEnBodega: boolean;
  /** Hoy en Bogotá («AAAA-MM-DD»): la fecha nueva no puede ser anterior. */
  hoy: string;
};

const claseTexto =
  "w-full rounded-lg border bg-background px-3 py-2 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

/**
 * Mueve la fecha de entrega o corrige la dirección y las notas de un pedido que aún no salió a
 * reparto (P-01). Pide siempre el motivo: queda en el historial junto con quién lo hizo.
 */
export function ReprogramarPedido({ pedidoId, fechaActual, direccionActual, notasActuales, recogeEnBodega, hoy }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [fecha, setFecha] = useState(fechaActual ?? "");
  const [direccion, setDireccion] = useState(direccionActual ?? "");
  const [notas, setNotas] = useState(notasActuales ?? "");
  const [motivo, setMotivo] = useState("");

  const cambioFecha = fecha !== (fechaActual ?? "");
  const cambioDireccion = !recogeEnBodega && direccion.trim() !== (direccionActual ?? "");
  const cambioNotas = notas.trim() !== (notasActuales ?? "");
  const hayCambios = cambioFecha || cambioDireccion || cambioNotas;

  function guardar() {
    setError(null);
    empezar(async () => {
      const r = await reprogramarPedido({
        id: pedidoId,
        fecha: cambioFecha && fecha ? fecha : null,
        direccion: cambioDireccion ? direccion.trim() : null,
        notas: cambioNotas ? notas.trim() : null,
        motivo,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setAviso(r.mensaje);
      setAbierto(false);
      setMotivo("");
      router.refresh();
    });
  }

  if (!abierto) {
    return (
      <div className="grid gap-2">
        {aviso ? (
          <p role="status" className="text-sm text-muted-foreground">
            {aviso}
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => {
            setAviso(null);
            setAbierto(true);
          }}
        >
          Reprogramar o corregir entrega…
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-xl border p-3">
      {error ? (
        <p role="alert" className="rounded-lg border border-destructive bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-1">
        <Label htmlFor="rep-fecha">Fecha de entrega</Label>
        <Input id="rep-fecha" type="date" min={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-11" />
      </div>

      {!recogeEnBodega ? (
        <div className="grid gap-1">
          <Label htmlFor="rep-direccion">Dirección de entrega</Label>
          <Input
            id="rep-direccion"
            maxLength={150}
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            className="h-11"
          />
        </div>
      ) : null}

      <div className="grid gap-1">
        <Label htmlFor="rep-notas">Notas del pedido</Label>
        <textarea id="rep-notas" rows={2} maxLength={300} value={notas} onChange={(e) => setNotas(e.target.value)} className={claseTexto} />
      </div>

      <div className="grid gap-1">
        <Label htmlFor="rep-motivo">Motivo del cambio (obligatorio)</Label>
        <textarea
          id="rep-motivo"
          rows={2}
          maxLength={300}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej.: el cliente pidió que llegue el jueves"
          className={claseTexto}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" className="h-11" disabled={pendiente || !hayCambios || motivo.trim().length < 3} onClick={guardar}>
          {pendiente ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Guardar cambios
        </Button>
        <Button type="button" variant="outline" className="h-11" disabled={pendiente} onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
