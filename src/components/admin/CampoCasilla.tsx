type CampoCasillaProps = {
  id: string;
  nombre: string;
  etiqueta: string;
  defaultChecked?: boolean;
  ayuda?: string;
};

/** Casilla de verificación con área táctil de 44 px y texto que también la activa. */
export function CampoCasilla({
  id,
  nombre,
  etiqueta,
  defaultChecked,
  ayuda,
}: CampoCasillaProps) {
  const idAyuda = `${id}-ayuda`;
  return (
    <div>
      <label
        htmlFor={id}
        className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium"
      >
        <input
          id={id}
          name={nombre}
          type="checkbox"
          defaultChecked={defaultChecked}
          aria-describedby={ayuda ? idAyuda : undefined}
          className="size-5 accent-ev-azul"
        />
        {etiqueta}
      </label>
      {ayuda ? (
        <p id={idAyuda} className="pl-8 text-sm text-muted-foreground">
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}
