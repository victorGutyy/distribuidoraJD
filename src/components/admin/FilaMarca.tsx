import Link from "next/link";
import {
  alternarMarca,
  eliminarMarca,
} from "@/app/admin/(panel)/marcas/actions";
import { BotonEliminar } from "@/components/admin/BotonEliminar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  marca: { id: number; nombre: string; slug: string; activa: boolean };
};

/** Una fila de la lista de marcas (Server Component; cada botón es un <form>). */
export function FilaMarca({ marca }: Props) {
  const { id, nombre, slug, activa } = marca;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-background px-3 py-2">
      <div className="min-w-40 flex-1">
        <p className="font-medium">{nombre}</p>
        <p className="text-xs text-muted-foreground">/{slug}</p>
      </div>

      <Badge variant={activa ? "outline" : "secondary"}>
        {activa ? "Activa" : "Inactiva"}
      </Badge>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/admin/marcas?editar=${id}`}
          aria-label={`Editar ${nombre}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "min-h-9",
          )}
        >
          Editar
        </Link>

        <form action={alternarMarca}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="outline" size="sm" className="min-h-9">
            {activa ? "Desactivar" : "Activar"}
          </Button>
        </form>

        <BotonEliminar
          accion={eliminarMarca}
          id={id}
          nombre={nombre}
          descripcion="Solo se puede eliminar si ningún producto la usa. Si solo quieres ocultarla, desactívala."
        />
      </div>
    </div>
  );
}
