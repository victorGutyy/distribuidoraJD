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

type BotonEliminarProps = {
  /** Server Action que recibe un FormData con el campo `id`. */
  accion: (formData: FormData) => void | Promise<void>;
  id: number;
  /** Nombre del elemento, para el lector de pantalla y el mensaje. */
  nombre: string;
  descripcion: string;
  /** Campos ocultos adicionales para la acción (p. ej. { producto: 12 }). */
  extras?: Record<string, string | number>;
};

/**
 * Botón "Eliminar" que pide confirmación antes de ejecutar la acción.
 * El envío es un <form> normal a una Server Action: la confirmación es solo
 * comodidad; el permiso real se comprueba en el servidor y en RLS.
 */
export function BotonEliminar({
  accion,
  id,
  nombre,
  descripcion,
  extras,
}: BotonEliminarProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        aria-label={`Eliminar ${nombre}`}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "min-h-9",
        )}
      >
        Eliminar
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar «{nombre}»?</AlertDialogTitle>
          <AlertDialogDescription>{descripcion}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <form action={accion}>
            <input type="hidden" name="id" value={id} />
            {Object.entries(extras ?? {}).map(([clave, valor]) => (
              <input key={clave} type="hidden" name={clave} value={valor} />
            ))}
            <AlertDialogAction type="submit" variant="destructive">
              Sí, eliminar
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
