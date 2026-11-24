"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  /** Server Action que recibe un FormData con el campo `id`. */
  accion: (formData: FormData) => void | Promise<void>;
  id: number;
  /** Texto del botón que abre la confirmación (p. ej. «Desactivar»). */
  textoBoton: string;
  titulo: string;
  descripcion: string;
  /** Texto del botón que confirma (p. ej. «Sí, desactivar»). */
  textoConfirmar: string;
  etiquetaAria?: string;
  extras?: Record<string, string | number>;
};

/**
 * Pide confirmación antes de una acción de gran alcance que NO borra datos pero cambia lo que ve
 * el público (p. ej. desactivar una categoría oculta todos sus productos). Igual que BotonEliminar:
 * es un <form> a una Server Action; el permiso real se comprueba en el servidor.
 */
export function BotonConfirmarAccion({
  accion,
  id,
  textoBoton,
  titulo,
  descripcion,
  textoConfirmar,
  etiquetaAria,
  extras,
}: Props) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        aria-label={etiquetaAria}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-9")}
      >
        {textoBoton}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descripcion}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <form action={accion}>
            <input type="hidden" name="id" value={id} />
            {Object.entries(extras ?? {}).map(([clave, valor]) => (
              <input key={clave} type="hidden" name={clave} value={valor} />
            ))}
            <AlertDialogAction type="submit">{textoConfirmar}</AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
