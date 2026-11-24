"use client";

import { PantallaError } from "@/components/comunes/PantallaError";

/** Fallo al cargar una página de la tienda: se conserva el encabezado y el pie. */
export default function ErrorTienda(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <PantallaError {...props} volverHref="/" volverTexto="Ir al inicio" />;
}
