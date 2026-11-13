import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CampoProps = {
  id: string;
  nombre: string;
  etiqueta: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  defaultValue?: string;
  /** Mensajes de error de este campo (el primero se muestra). */
  errores?: string[];
  /** Texto de ayuda bajo el campo. */
  ayuda?: string;
  inputMode?: "text" | "email";
  autoFocus?: boolean;
};

/**
 * Campo de formulario accesible: <label> asociado, error y ayuda enlazados con
 * aria-describedby, y aria-invalid cuando hay error (CLAUDE.md §6).
 */
export function Campo({
  id,
  nombre,
  etiqueta,
  type = "text",
  autoComplete,
  defaultValue,
  errores,
  ayuda,
  inputMode,
  autoFocus,
}: CampoProps) {
  const tieneError = Boolean(errores?.length);
  const idError = `${id}-error`;
  const idAyuda = `${id}-ayuda`;
  const describedBy =
    [tieneError ? idError : null, ayuda ? idAyuda : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input
        id={id}
        name={nombre}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        inputMode={inputMode}
        autoFocus={autoFocus}
        aria-invalid={tieneError || undefined}
        aria-describedby={describedBy}
        required
        className="h-11 text-base md:text-sm"
      />
      {ayuda ? (
        <p id={idAyuda} className="text-sm text-muted-foreground">
          {ayuda}
        </p>
      ) : null}
      {tieneError ? (
        <p id={idError} className="text-sm text-red-700">
          {errores?.[0]}
        </p>
      ) : null}
    </div>
  );
}

/** Aviso de error general de un formulario. */
export function AvisoError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
    >
      {children}
    </p>
  );
}

/** Aviso de éxito o información de un formulario. */
export function AvisoInfo({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground"
    >
      {children}
    </p>
  );
}
