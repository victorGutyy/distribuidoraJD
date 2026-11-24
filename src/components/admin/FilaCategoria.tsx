import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import {
  alternarCategoria,
  eliminarCategoria,
  moverCategoria,
} from "@/app/admin/(panel)/categorias/actions";
import { BotonConfirmarAccion } from "@/components/admin/BotonConfirmarAccion";
import { BotonEliminar } from "@/components/admin/BotonEliminar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  categoria: { id: number; nombre: string; slug: string; activa: boolean };
  esPrimera: boolean;
  esUltima: boolean;
  /** true = es una subcategoría (se muestra con sangría). */
  anidada?: boolean;
  tieneHijas?: boolean;
};

/**
 * Una fila de la lista de categorías. Es un Server Component: cada botón es un
 * <form> que llama a una Server Action, así que funciona sin JavaScript en el
 * navegador y el servidor comprueba el permiso en cada acción.
 */
export function FilaCategoria({
  categoria,
  esPrimera,
  esUltima,
  anidada = false,
  tieneHijas = false,
}: Props) {
  const { id, nombre, slug, activa } = categoria;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-background px-3 py-2",
        anidada && "ml-6 border-dashed",
      )}
    >
      <div className="min-w-40 flex-1">
        <p className="font-medium">{nombre}</p>
        <p className="text-xs text-muted-foreground">/{slug}</p>
      </div>

      <Badge variant={activa ? "outline" : "secondary"}>
        {activa ? "Activa" : "Inactiva"}
      </Badge>

      <div className="flex flex-wrap items-center gap-2">
        <form action={moverCategoria} className="flex gap-1">
          <input type="hidden" name="id" value={id} />
          <Button
            type="submit"
            name="direccion"
            value="arriba"
            variant="outline"
            size="icon"
            disabled={esPrimera}
            aria-label={`Subir ${nombre}`}
          >
            <ArrowUp aria-hidden />
          </Button>
          <Button
            type="submit"
            name="direccion"
            value="abajo"
            variant="outline"
            size="icon"
            disabled={esUltima}
            aria-label={`Bajar ${nombre}`}
          >
            <ArrowDown aria-hidden />
          </Button>
        </form>

        <Link
          href={`/admin/categorias?editar=${id}`}
          aria-label={`Editar ${nombre}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "min-h-9",
          )}
        >
          Editar
        </Link>

        {activa ? (
          <BotonConfirmarAccion
            accion={alternarCategoria}
            id={id}
            textoBoton="Desactivar"
            etiquetaAria={`Desactivar ${nombre}`}
            titulo={`¿Desactivar «${nombre}»?`}
            descripcion="Se ocultará de la tienda junto con sus subcategorías y todos los productos que tenga adentro. No se borra nada: puedes volver a activarla cuando quieras."
            textoConfirmar="Sí, desactivar"
          />
        ) : (
          <form action={alternarCategoria}>
            <input type="hidden" name="id" value={id} />
            <Button type="submit" variant="outline" size="sm" className="min-h-9">
              Activar
            </Button>
          </form>
        )}

        <BotonEliminar
          accion={eliminarCategoria}
          id={id}
          nombre={nombre}
          descripcion={
            tieneHijas
              ? "Tiene subcategorías, así que no se podrá eliminar hasta que las muevas o elimines. Si solo quieres ocultarla, desactívala."
              : "Solo se puede eliminar si no tiene productos. Si solo quieres ocultarla de la tienda, desactívala."
          }
        />
      </div>
    </div>
  );
}
