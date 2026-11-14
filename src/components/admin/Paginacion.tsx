import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  actual: number;
  totalPaginas: number;
  /** URL de una página dada (conserva los filtros). */
  urlDe: (pagina: number) => string;
};

const base = cn(buttonVariants({ variant: "outline" }), "h-11 px-4");

/** Anterior / Siguiente con el número de página. No se dibuja si hay una sola. */
export function Paginacion({ actual, totalPaginas, urlDe }: Props) {
  if (totalPaginas <= 1) return null;
  return (
    <nav
      aria-label="Paginación"
      className="flex items-center justify-between gap-3"
    >
      {actual > 1 ? (
        <Link href={urlDe(actual - 1)} className={base} rel="prev">
          ← Anterior
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className={cn(base, "pointer-events-none opacity-50")}
        >
          ← Anterior
        </span>
      )}
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Página {actual} de {totalPaginas}
      </p>
      {actual < totalPaginas ? (
        <Link href={urlDe(actual + 1)} className={base} rel="next">
          Siguiente →
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className={cn(base, "pointer-events-none opacity-50")}
        >
          Siguiente →
        </span>
      )}
    </nav>
  );
}
