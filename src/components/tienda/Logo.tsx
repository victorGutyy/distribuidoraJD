import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoProps = {
  /** Clases para controlar el tamaño en pantalla, p. ej. "w-32" (alto automático). */
  className?: string;
  /** true solo si el logo está en la parte visible al cargar (mejora el LCP). */
  priority?: boolean;
  /** Ancho real en pantalla según el breakpoint; evita descargar una imagen más grande de la cuenta. */
  sizes?: string;
};

/**
 * Logo de EV Distribuidora. El archivo (public/logo-ev.webp) es un círculo de
 * 512 × 512 px con fondo transparente; width/height reservan el espacio para
 * que la página no "salte" al cargar. El tamaño real en pantalla lo decide
 * `className`.
 */
export function Logo({ className, priority = false, sizes }: LogoProps) {
  return (
    <Image
      src="/logo-ev.webp"
      alt="EV Distribuidora"
      width={512}
      height={512}
      priority={priority}
      sizes={sizes}
      className={cn("h-auto w-32", className)}
    />
  );
}
