import { MessageCircle } from "lucide-react";
import { enlaceWhatsApp } from "@/lib/whatsapp";

/** Botón flotante de WhatsApp visible en toda la tienda (RF-12). Sin número, no se dibuja. */
export function BotonWhatsApp({
  numero,
  mensaje,
}: {
  numero: string | null;
  mensaje: string;
}) {
  if (!numero) return null;
  return (
    <a
      href={enlaceWhatsApp(numero, mensaje)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      className="fixed right-4 bottom-4 z-40 flex h-14 items-center gap-2 rounded-full bg-ev-azul px-4 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <MessageCircle className="size-6" aria-hidden="true" />
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
}
