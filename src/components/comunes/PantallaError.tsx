"use client";

import Link from "next/link";
import { useEffect } from "react";

type Props = {
  error: Error & { digest?: string };
  retry: () => void;
  /** Enlace secundario (inicio de la tienda o del panel). */
  volverHref: string;
  volverTexto: string;
  titulo?: string;
};

/**
 * Pantalla de error con la marca y botón «Reintentar».
 * Nunca muestra `error.message` (puede traer detalles internos); solo el código `digest`,
 * que sirve para buscar el fallo en los registros del servidor.
 */
export function PantallaError({ error, retry, volverHref, volverTexto, titulo = "Algo salió mal" }: Props) {
  useEffect(() => {
    console.error("[pantalla de error]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <main className="mx-auto grid w-full max-w-xl flex-1 content-center justify-items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
      <p className="text-muted-foreground">
        No pudimos cargar esta página. Suele ser algo momentáneo: intenta de nuevo en unos segundos.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex h-11 items-center rounded-lg bg-ev-azul px-6 text-sm font-semibold text-white"
        >
          Reintentar
        </button>
        <Link
          href={volverHref}
          className="inline-flex h-11 items-center rounded-lg border border-border px-6 text-sm font-semibold"
        >
          {volverTexto}
        </Link>
      </div>
      {error.digest && <p className="text-xs text-muted-foreground">Código: {error.digest}</p>}
    </main>
  );
}
