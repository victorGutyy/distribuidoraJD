"use client";

import { Check, Copy, KeyRound } from "lucide-react";
import { useState } from "react";
import { generarEnlaceUsuario } from "@/app/admin/(panel)/usuarios/actions";
import { Button } from "@/components/ui/button";

/** Muestra un enlace de acceso con un botón para copiarlo. */
export function CajaEnlace({ enlace }: { enlace: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="grid gap-2 rounded-xl border border-ev-dorado bg-ev-dorado/10 p-3">
      <input
        readOnly
        value={enlace}
        aria-label="Enlace para crear la contraseña"
        onFocus={(e) => e.currentTarget.select()}
        className="h-11 w-full rounded-lg border bg-background px-3 text-xs"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10 gap-2"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(enlace);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            } catch {
              /* el navegador no dejó copiar: se puede seleccionar el texto a mano */
            }
          }}
        >
          {copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copiado ? "¡Copiado!" : "Copiar enlace"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Sirve una sola vez y vence en poco tiempo. Quien lo abra podrá crear la contraseña de esa cuenta: envíalo solo a la persona.
        </p>
      </div>
    </div>
  );
}

/** Botón de la lista: genera un enlace nuevo para crear o cambiar la contraseña de un usuario. */
export function BotonEnlaceAcceso({ id, nombre }: { id: string; nombre: string }) {
  const [cargando, setCargando] = useState(false);
  const [enlace, setEnlace] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-9 gap-1.5"
        disabled={cargando}
        aria-label={`Generar enlace de acceso para ${nombre}`}
        onClick={async () => {
          setCargando(true);
          setError(null);
          const r = await generarEnlaceUsuario(id);
          setCargando(false);
          if (r.ok) setEnlace(r.enlace);
          else setError(r.error);
        }}
      >
        <KeyRound aria-hidden="true" />
        {cargando ? "Generando…" : "Generar enlace"}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {enlace ? <CajaEnlace enlace={enlace} /> : null}
    </div>
  );
}
