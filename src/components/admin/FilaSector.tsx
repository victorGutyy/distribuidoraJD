import Link from "next/link";
import { alternarSector, eliminarSector } from "@/app/admin/(panel)/zonas/actions";
import { BotonEliminar } from "@/components/admin/BotonEliminar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { textoDiasReparto } from "@/lib/entregas";
import { formatCOP } from "@/lib/formato";
import { cn } from "@/lib/utils";

type Props = {
  sector: {
    id: number;
    nombre: string;
    dias_reparto: number[];
    costo_envio: number;
    activo: boolean;
  };
};

/** Una fila de la lista de sectores (Server Component; cada botón es un <form>). */
export function FilaSector({ sector }: Props) {
  const { id, nombre, dias_reparto, costo_envio, activo } = sector;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-background px-3 py-2">
      <div className="min-w-40 flex-1">
        <p className="font-medium">{nombre}</p>
        <p className="text-xs text-muted-foreground">
          {textoDiasReparto(dias_reparto)} · Envío {costo_envio > 0 ? formatCOP(costo_envio) : "sin costo"}
        </p>
      </div>

      <Badge variant={activo ? "outline" : "secondary"}>{activo ? "Activo" : "Inactivo"}</Badge>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/admin/zonas?editar=${id}`}
          aria-label={`Editar ${nombre}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-9")}
        >
          Editar
        </Link>
        <form action={alternarSector}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="outline" size="sm" className="min-h-9">
            {activo ? "Desactivar" : "Activar"}
          </Button>
        </form>
        <BotonEliminar
          accion={eliminarSector}
          id={id}
          nombre={nombre}
          descripcion="Solo se puede eliminar si no tiene pedidos ni clientes. Si solo quieres ocultarlo, desactívalo."
        />
      </div>
    </div>
  );
}
