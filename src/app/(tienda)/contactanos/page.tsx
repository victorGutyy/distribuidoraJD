import type { Metadata } from "next";
import { PaginaInformativa } from "@/components/tienda/PaginaInformativa";
import { obtenerConfigTienda } from "@/lib/tienda/datos";
import { enlaceWhatsApp } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Contáctanos",
  alternates: { canonical: "/contactanos" },
};

export default async function Contactanos() {
  const { empresa, whatsapp, mensajeWhatsApp } = await obtenerConfigTienda();
  const hayDatos = whatsapp || empresa.direccion || empresa.horarios || empresa.redes.length > 0;
  return (
    <PaginaInformativa titulo="Contáctanos">
      <p>Escríbenos y te ayudamos con tu pedido, precios o cualquier duda.</p>
      {whatsapp ? (
        <p>
          <a
            href={enlaceWhatsApp(whatsapp, mensajeWhatsApp)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center rounded-lg bg-ev-azul px-6 text-sm font-semibold text-white"
          >
            Escribir por WhatsApp
          </a>
        </p>
      ) : null}
      {empresa.direccion ? (
        <p>
          <span className="font-semibold">Dirección: </span>
          {empresa.direccion}
        </p>
      ) : null}
      {empresa.horarios ? (
        <p>
          <span className="font-semibold">Horario de atención: </span>
          {empresa.horarios}
        </p>
      ) : null}
      {empresa.redes.length > 0 ? (
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          {empresa.redes.map((r) => (
            <a key={r.nombre} href={r.url} target="_blank" rel="noopener noreferrer" className="capitalize underline">
              {r.nombre}
            </a>
          ))}
        </p>
      ) : null}
      {!hayDatos ? <p>Muy pronto publicaremos nuestros datos de contacto.</p> : null}
    </PaginaInformativa>
  );
}
