"use client";

import Image from "next/image";
import { useState } from "react";
import { Logo } from "@/components/tienda/Logo";
import { cn } from "@/lib/utils";

type Imagen = { url: string; miniatura: string | null };

/**
 * Galería del detalle (RF-06): imagen grande y miniaturas para cambiarla. Sin
 * imágenes se muestra el logo como reemplazo.
 */
export function GaleriaProducto({
  imagenes,
  nombre,
}: {
  imagenes: Imagen[];
  nombre: string;
}) {
  const [actual, setActual] = useState(0);
  const imagen = imagenes[actual];

  return (
    // max-w-lg: en pantallas grandes la foto no se estira hasta ocupar media página.
    <div className="mx-auto grid w-full max-w-lg gap-3">
      <div className={cn("relative aspect-square overflow-hidden rounded-xl border", imagen ? "bg-white" : "bg-muted")}>
        {imagen ? (
          <Image
            key={imagen.url}
            src={imagen.url}
            alt={`${nombre}${imagenes.length > 1 ? `, imagen ${actual + 1} de ${imagenes.length}` : ""}`}
            fill
            priority={actual === 0}
            sizes="(min-width: 1024px) 32rem, (min-width: 512px) 32rem, 100vw"
            className="object-contain p-4 sm:p-6"
          />
        ) : (
          <span className="flex size-full items-center justify-center">
            <Logo className="w-1/4 opacity-30 grayscale" sizes="160px" />
          </span>
        )}
      </div>

      {imagenes.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto" aria-label="Imágenes del producto">
          {imagenes.map((img, i) => (
            <li key={img.url}>
              <button
                type="button"
                onClick={() => setActual(i)}
                aria-label={`Ver imagen ${i + 1}`}
                aria-current={i === actual}
                className={cn(
                  "relative block size-16 overflow-hidden rounded-lg border-2 bg-white sm:size-20",
                  i === actual ? "border-ev-azul" : "border-border hover:border-ev-plata",
                )}
              >
                <Image
                  src={img.miniatura ?? img.url}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-contain p-1"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
