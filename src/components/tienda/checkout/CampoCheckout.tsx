import type { UseFormRegisterReturn } from "react-hook-form";

type Props = {
  id: string;
  etiqueta: string;
  registro: UseFormRegisterReturn;
  error?: string;
  ayuda?: string;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "tel";
  multilinea?: boolean;
};

const clase =
  "w-full rounded-lg border bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm";

/** Campo del checkout: <label> asociado, ayuda y error enlazados con aria-describedby (CLAUDE.md §6). */
export function CampoCheckout({ id, etiqueta, registro, error, ayuda, autoComplete, inputMode, multilinea }: Props) {
  const describedBy = [error ? `${id}-error` : null, ayuda ? `${id}-ayuda` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {etiqueta}
      </label>
      {multilinea ? (
        <textarea
          id={id}
          rows={3}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={`${clase} py-2`}
          {...registro}
        />
      ) : (
        <input
          id={id}
          type="text"
          autoComplete={autoComplete}
          inputMode={inputMode}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={`${clase} h-11`}
          {...registro}
        />
      )}
      {ayuda ? (
        <p id={`${id}-ayuda`} className="text-sm text-muted-foreground">
          {ayuda}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
