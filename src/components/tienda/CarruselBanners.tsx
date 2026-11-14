"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import type { BannerInicio } from "@/lib/tienda/consultas";
import { esEnlaceExterno } from "@/lib/tienda/imagenes";
import { cn } from "@/lib/utils";

/**
 * Carrusel de banners (RF-01). Usa el desplazamiento nativo con "snap" (se desliza
 * con el dedo sin JavaScript); los botones y los puntos son un extra. No cambia
 * solo: así nadie pierde el banner que estaba leyendo.
 */
export function CarruselBanners({ banners }: { banners: BannerInicio[] }) {
  const pista = useRef<HTMLUListElement>(null);
  const [actual, setActual] = useState(0);

  if (banners.length === 0) return null;

  const ir = (i: number) => {
    const el = pista.current;
    if (!el) return;
    const destino = Math.min(banners.length - 1, Math.max(0, i));
    el.scrollTo({ left: destino * el.clientWidth, behavior: "smooth" });
  };

  return (
    <section aria-roledescription="carrusel" aria-label="Promociones" className="relative">
      <ul
        ref={pista}
        onScroll={(e) => {
          const el = e.currentTarget;
          setActual(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {banners.map((b, i) => {
          const imagen = (
            <>
              <Image
                src={b.imagenMovil ?? b.imagen}
                alt=""
                fill
                priority={i === 0}
                sizes="100vw"
                className={cn("object-cover", b.imagenMovil && "md:hidden")}
              />
              {b.imagenMovil ? (
                <Image
                  src={b.imagen}
                  alt=""
                  fill
                  priority={i === 0}
                  sizes="100vw"
                  className="hidden object-cover md:block"
                />
              ) : null}
            </>
          );
          return (
            <li
              key={b.id}
              aria-label={`Promoción ${i + 1} de ${banners.length}`}
              className="relative aspect-[16/9] w-full shrink-0 snap-center md:aspect-[21/7]"
            >
              {b.enlace ? (
                esEnlaceExterno(b.enlace) ? (
                  <a href={b.enlace} target="_blank" rel="noopener noreferrer" className="block size-full">
                    {imagen}
                    <span className="sr-only">Ver promoción {i + 1}</span>
                  </a>
                ) : (
                  <Link href={b.enlace} className="block size-full">
                    {imagen}
                    <span className="sr-only">Ver promoción {i + 1}</span>
                  </Link>
                )
              ) : (
                imagen
              )}
            </li>
          );
        })}
      </ul>

      {banners.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Promoción anterior"
            onClick={() => ir(actual - 1)}
            className="absolute top-1/2 left-2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow hover:bg-background md:flex"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Promoción siguiente"
            onClick={() => ir(actual + 1)}
            className="absolute top-1/2 right-2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow hover:bg-background md:flex"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                aria-label={`Ir a la promoción ${i + 1}`}
                aria-current={i === actual}
                onClick={() => ir(i)}
                className="flex size-6 items-center justify-center"
              >
                <span
                  className={cn(
                    "block h-2 rounded-full transition-all",
                    i === actual ? "w-6 bg-white" : "w-2 bg-white/60",
                  )}
                />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
