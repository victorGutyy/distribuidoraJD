"use client";

import { CheckCircle2, Copy, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useTienda } from "@/components/tienda/carrito/ProveedorTienda";
import { formatCOP } from "@/lib/formato";
import { CLAVE_ULTIMO_PEDIDO, leerUltimoPedido } from "@/lib/ultimo-pedido";
import { enlaceWhatsApp } from "@/lib/whatsapp";

function suscribir(avisar: () => void) {
  window.addEventListener("storage", avisar);
  return () => window.removeEventListener("storage", avisar);
}
function leerCrudo(): string | null {
  try {
    return localStorage.getItem(CLAVE_ULTIMO_PEDIDO);
  } catch {
    return null;
  }
}

/**
 * Pantalla "¡Pedido recibido!" (RF-10). El resumen sale del navegador de quien hizo el
 * pedido, no de la base de datos: así el número (consecutivo) no sirve para ver los
 * datos de otras personas. El pedido ya está guardado aunque WhatsApp no abra.
 */
export function ConfirmacionPedido({ numero }: { numero: string }) {
  const { whatsapp } = useTienda();
  const crudo = useSyncExternalStore(suscribir, leerCrudo, () => null);
  const guardado = useMemo(() => leerUltimoPedido(crudo), [crudo]);
  const pedido = guardado?.numero === numero ? guardado : null;
  const [copiado, setCopiado] = useState<"mensaje" | "numero" | null>(null);

  async function copiar(texto: string, cual: "mensaje" | "numero") {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(cual);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      /* el navegador no dejó copiar: la persona puede seleccionar el texto a mano */
    }
  }

  // Sin número configurado, WhatsApp deja elegir a quién enviar el mensaje.
  const enlace = pedido
    ? whatsapp
      ? enlaceWhatsApp(whatsapp, pedido.mensaje)
      : `https://wa.me/?text=${encodeURIComponent(pedido.mensaje)}`
    : null;

  return (
    <div className="grid gap-6">
      <div className="grid justify-items-center gap-2 text-center">
        <CheckCircle2 className="size-14 text-ev-azul" aria-hidden="true" />
        <h1 className="text-2xl font-bold tracking-tight">¡Pedido recibido!</h1>
        <p className="text-muted-foreground">Tu número de pedido es</p>
        <p className="text-3xl font-bold tracking-wide tabular-nums" aria-label={`Número de pedido ${numero}`}>
          {numero}
        </p>
      </div>

      {pedido ? (
        <>
          <p className="text-center text-sm">
            Hola {pedido.clienteNombre.split(" ")[0]}, tu pedido ya quedó registrado.
            {pedido.fechaTexto ? (
              <>
                {" "}
                Lo {pedido.lugar === "Recoger en bodega" ? "puedes recoger" : "recibes"} el{" "}
                <b>{pedido.fechaTexto}</b>.
              </>
            ) : null}{" "}
            Envíalo por WhatsApp para que lo confirmemos.
          </p>

          <div className="grid gap-2">
            <a
              href={enlace ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-ev-azul px-6 text-base font-semibold text-white hover:bg-ev-azul/90"
            >
              <MessageCircle className="size-5" aria-hidden="true" />
              Enviar por WhatsApp
            </a>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => copiar(pedido.mensaje, "mensaje")}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-medium hover:bg-muted"
              >
                <Copy className="size-4" aria-hidden="true" />
                {copiado === "mensaje" ? "¡Copiado!" : "Copiar mensaje"}
              </button>
              <button
                type="button"
                onClick={() => copiar(numero, "numero")}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-medium hover:bg-muted"
              >
                <Copy className="size-4" aria-hidden="true" />
                {copiado === "numero" ? "¡Copiado!" : "Copiar número"}
              </button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Si WhatsApp no se abre, tu pedido igual está guardado: copia el mensaje y envíalo por tu cuenta.
            </p>
          </div>

          <section aria-labelledby="resumen" className="grid gap-3 rounded-xl border p-4">
            <h2 id="resumen" className="font-bold">
              Resumen
            </h2>
            <p className="text-sm text-muted-foreground">{pedido.lugar}</p>
            <ul className="grid gap-1 text-sm">
              {pedido.lineas.map((l) => (
                <li key={`${l.nombre}-${l.presentacion}`} className="flex justify-between gap-3">
                  <span>
                    {l.nombre}
                    {l.presentacion ? ` ${l.presentacion}` : ""} <span className="text-muted-foreground">x{l.cantidad}</span>
                  </span>
                  <span className="tabular-nums">{formatCOP(l.subtotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t pt-3 text-sm">
              <dt>Subtotal</dt>
              <dd className="text-right tabular-nums">{formatCOP(pedido.subtotal)}</dd>
              {pedido.descuentoMayor > 0 ? (
                <>
                  <dt className="text-ev-azul">Descuento por tu compra</dt>
                  <dd className="text-right text-ev-azul tabular-nums">− {formatCOP(pedido.descuentoMayor)}</dd>
                </>
              ) : null}
              {pedido.costoEnvio > 0 ? (
                <>
                  <dt>Envío</dt>
                  <dd className="text-right tabular-nums">{formatCOP(pedido.costoEnvio)}</dd>
                </>
              ) : null}
              <dt className="font-bold">Total a pagar contraentrega</dt>
              <dd className="text-right font-bold tabular-nums">{formatCOP(pedido.total)}</dd>
            </dl>
          </section>
        </>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Guarda este número. Si necesitas ayuda con tu pedido, escríbenos por WhatsApp y menciónalo.
        </p>
      )}

      <Link
        href="/catalogo"
        className="inline-flex h-11 items-center justify-center rounded-lg border text-sm font-medium hover:bg-muted"
      >
        Seguir comprando
      </Link>
    </div>
  );
}
