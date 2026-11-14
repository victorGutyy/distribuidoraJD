import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/tienda/Logo";
import { formatCOP } from "@/lib/formato";
import type { ProductoTarjeta } from "@/lib/tienda/tarjeta";

/**
 * Tarjeta de producto del listado (RF-03). El botón "Agregar" se activa en la
 * fase F5, cuando exista el carrito.
 */
export function TarjetaProducto({
  producto: p,
  prioridad = false,
}: {
  producto: ProductoTarjeta;
  /** true para las primeras tarjetas visibles: la imagen carga sin esperar (mejora el LCP). */
  prioridad?: boolean;
}) {
  const href = `/producto/${p.slug}`;
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border bg-background">
      <Link href={href} className="relative block aspect-square bg-muted" tabIndex={-1} aria-hidden="true">
        {p.imagen ? (
          <Image
            src={p.imagen}
            alt=""
            fill
            sizes="(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 46vw"
            priority={prioridad}
            className="object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center">
            <Logo className="w-1/3 opacity-30 grayscale" sizes="120px" />
          </span>
        )}
        <span className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {p.esOferta ? (
            <span className="rounded-md bg-ev-oferta px-2 py-0.5 text-xs font-bold text-white">Oferta</span>
          ) : null}
          {p.esNuevo ? (
            <span className="rounded-md bg-ev-azul px-2 py-0.5 text-xs font-bold text-white">Nuevo</span>
          ) : null}
        </span>
        {p.agotado ? (
          <span className="absolute top-2 right-2 rounded-md bg-neutral-700 px-2 py-0.5 text-xs font-bold text-white">
            Agotado
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-3">
        {p.marca ? <p className="truncate text-xs text-muted-foreground">{p.marca}</p> : null}
        <h3 className="line-clamp-2 text-sm leading-snug font-semibold">
          <Link href={href} className="hover:underline">
            {p.nombre}
          </Link>
        </h3>
        {p.presentacion ? <p className="truncate text-xs text-muted-foreground">{p.presentacion}</p> : null}

        <div className="mt-auto grid gap-0.5 pt-2">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-lg font-bold tabular-nums">{formatCOP(p.precio)}</span>
            {p.precioAntes !== null ? (
              <span className="text-xs text-muted-foreground tabular-nums line-through">
                {formatCOP(p.precioAntes)}
              </span>
            ) : null}
          </p>
          {p.mayor ? (
            <p className="text-xs font-semibold text-ev-dorado-oscuro tabular-nums">
              Por mayor: {formatCOP(p.mayor.precio)}
              {p.mayor.desde ? ` desde ${p.mayor.desde} und.` : ""}
            </p>
          ) : null}
          {p.masPresentaciones ? (
            <p className="text-xs text-muted-foreground">Más presentaciones</p>
          ) : null}
        </div>

        <button
          type="button"
          disabled
          title="El carrito estará disponible muy pronto"
          className="mt-2 h-11 rounded-lg bg-ev-azul text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {p.agotado ? "Agotado" : "Agregar"}
        </button>
      </div>
    </article>
  );
}
