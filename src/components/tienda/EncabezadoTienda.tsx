import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { BotonCarrito } from "@/components/tienda/carrito/BotonCarrito";
import { BuscadorTienda } from "@/components/tienda/BuscadorTienda";
import { Logo } from "@/components/tienda/Logo";
import type { CategoriaTienda } from "@/lib/tienda/categorias";
import { enlaceWhatsApp } from "@/lib/whatsapp";

type Props = {
  categorias: CategoriaTienda[];
  /** Productos por categoría (con las hijas sumadas): las vacías no se muestran. */
  conteos: ReadonlyMap<number, number>;
  whatsapp: string | null;
  mensajeWhatsApp: string;
};

/**
 * Encabezado de la tienda (RF-01): logo, buscador, carrito y WhatsApp, y debajo
 * el menú de categorías principales. Mobile-first: en el celular el buscador va
 * en su propia fila.
 */
export function EncabezadoTienda({ categorias, conteos, whatsapp, mensajeWhatsApp }: Props) {
  const raices = categorias.filter((c) => c.parent_id === null && (conteos.get(c.id) ?? 0) > 0);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 px-4 py-2 md:gap-x-6">
        <Link href="/" aria-label="EV Distribuidora, ir al inicio">
          <Logo priority className="w-12 md:w-14" sizes="56px" />
        </Link>

        <div className="order-last col-span-3 md:order-none md:col-span-1">
          <BuscadorTienda />
        </div>

        <div className="flex items-center gap-1 justify-self-end">
          {whatsapp ? (
            <a
              href={enlaceWhatsApp(whatsapp, mensajeWhatsApp)}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-muted md:flex"
            >
              <MessageCircle className="size-5" aria-hidden="true" />
              WhatsApp
            </a>
          ) : null}
          <BotonCarrito />
        </div>
      </div>

      {raices.length > 0 ? (
        <nav aria-label="Categorías" className="border-t">
          <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-1 text-sm">
            <li>
              <Link
                href="/catalogo"
                className="flex h-11 items-center rounded-lg px-3 font-semibold whitespace-nowrap hover:bg-muted"
              >
                Todo el catálogo
              </Link>
            </li>
            {raices.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/catalogo?cat=${c.slug}`}
                  className="flex h-11 items-center rounded-lg px-3 whitespace-nowrap hover:bg-muted"
                >
                  {c.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
