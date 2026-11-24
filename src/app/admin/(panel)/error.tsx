"use client";

import { PantallaError } from "@/components/comunes/PantallaError";

/** Fallo al cargar una pantalla del panel: se conserva el menú lateral. */
export default function ErrorPanel(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <PantallaError {...props} volverHref="/admin" volverTexto="Volver al panel" />;
}
