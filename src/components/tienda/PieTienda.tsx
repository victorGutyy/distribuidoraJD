import Link from "next/link";
import { Logo } from "@/components/tienda/Logo";
import type { ConfigTienda } from "@/lib/tienda/config";

/** Pie de página (RF-01): contacto, dirección, horarios y redes. */
export function PieTienda({ config }: { config: ConfigTienda }) {
  const { empresa } = config;
  const sinContacto = !empresa.direccion && !empresa.horarios && !config.whatsapp;
  return (
    <footer className="mt-12 border-t bg-ev-negro text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-3">
        <div className="grid content-start gap-3">
          <Logo className="w-16" sizes="64px" />
          <p className="text-sm text-white/80">
            Pedidos por mayor y al detal en el Quindío. Arma tu pedido, envíalo por
            WhatsApp y paga contraentrega.
          </p>
        </div>

        <div className="grid content-start gap-2 text-sm">
          <h2 className="font-semibold">Contacto</h2>
          {empresa.direccion ? <p className="text-white/80">{empresa.direccion}</p> : null}
          {empresa.horarios ? <p className="text-white/80">{empresa.horarios}</p> : null}
          {config.whatsapp ? (
            <p className="text-white/80">WhatsApp: +{config.whatsapp}</p>
          ) : null}
          {sinContacto ? (
            <p className="text-white/80">
              Muy pronto publicaremos nuestros datos de contacto.
            </p>
          ) : null}
        </div>

        <div className="grid content-start gap-2 text-sm">
          <h2 className="font-semibold">Compra</h2>
          <Link href="/catalogo" className="text-white/80 hover:text-white hover:underline">
            Ver catálogo
          </Link>
          <p className="text-white/80">Pago contraentrega</p>
          {empresa.redes.map((r) => (
            <a
              key={r.nombre}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/80 capitalize hover:text-white hover:underline"
            >
              {r.nombre}
            </a>
          ))}
        </div>
      </div>
      <p className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/60">
        © {empresa.nombre}. Todos los derechos reservados.
      </p>
    </footer>
  );
}
