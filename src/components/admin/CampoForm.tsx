import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type CampoFormProps = {
  id: string;
  etiqueta: string;
  /** Mensaje de error de este campo. */
  error?: string;
  ayuda?: string;
  className?: string;
  /** El control (input, select, textarea) con su `id` y `{...register()}`. */
  children: React.ReactNode;
};

/**
 * Envoltorio de campo para formularios con react-hook-form: <label> asociado,
 * ayuda y error. El control debe recibir `id`, `aria-invalid` y
 * `aria-describedby` (ver `ariaCampo`).
 */
export function CampoForm({
  id,
  etiqueta,
  error,
  ayuda,
  className,
  children,
}: CampoFormProps) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {ayuda && !error ? (
        <p id={`${id}-ayuda`} className="text-xs text-muted-foreground">
          {ayuda}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Atributos de accesibilidad que enlazan un control con su error o ayuda. */
export function ariaCampo(id: string, error?: string, ayuda?: string) {
  return {
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error
      ? `${id}-error`
      : ayuda
        ? `${id}-ayuda`
        : undefined,
  };
}

/** Estilo del <select> nativo (igual que el de CampoSelect). */
export const claseSelect =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-600 md:text-sm";

/** Estilo de los <input> numéricos y de texto dentro de las tarjetas de presentación. */
export const claseInput = "h-11 text-base md:text-sm";
