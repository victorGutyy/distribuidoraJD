"use client";

import { PantallaError } from "@/components/comunes/PantallaError";

/** Red de seguridad: errores fuera de las tiendas/paneles (p. ej. el marco de la tienda no pudo leer la base). */
export default function ErrorGeneral(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <PantallaError {...props} volverHref="/" volverTexto="Ir al inicio" />;
}
