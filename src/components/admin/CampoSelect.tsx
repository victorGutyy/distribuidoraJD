type Opcion = { valor: string; etiqueta: string };

type CampoSelectProps = {
  id: string;
  nombre: string;
  etiqueta: string;
  opciones: Opcion[];
  defaultValue?: string;
  errores?: string[];
  ayuda?: string;
  disabled?: boolean;
};

/**
 * Lista desplegable usando el <select> nativo: en el celular abre el selector
 * del sistema (más cómodo que un menú propio) y funciona en un formulario
 * sin JavaScript. <label> asociado y error enlazado con aria-describedby.
 */
export function CampoSelect({
  id,
  nombre,
  etiqueta,
  opciones,
  defaultValue,
  errores,
  ayuda,
  disabled,
}: CampoSelectProps) {
  const tieneError = Boolean(errores?.length);
  const idError = `${id}-error`;
  const idAyuda = `${id}-ayuda`;
  const describedBy =
    [tieneError ? idError : null, ayuda ? idAyuda : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm leading-none font-medium">
        {etiqueta}
      </label>
      <select
        id={id}
        name={nombre}
        defaultValue={defaultValue}
        disabled={disabled}
        aria-invalid={tieneError || undefined}
        aria-describedby={describedBy}
        className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-600 md:text-sm"
      >
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
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
