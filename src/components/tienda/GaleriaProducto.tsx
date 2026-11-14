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
    <div className="grid gap-3">
      <div className="relative aspect-square overflow-hidden rounded-xl border bg-muted">
        {imagen ? (
          <Image
            key={imagen.url}
            src={imagen.url}
            alt={`${nombre}${imagenes.length > 1 ? `, imagen ${actual + 1} de ${imagenes.length}` : ""}`}
            fill
            priority={actual === 0}
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="object-contain"
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
                  "relative block size-16 overflow-hidden rounded-lg border-2 bg-muted sm:size-20",
                  i === actual ? "border-ev-azul" : "border-transparent hover:border-ev-plata",
                )}
              >
                <Image
                  src={img.miniatura ?? img.url}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
