import { ArrowDown, ArrowUp, Star } from "lucide-react";
import Image from "next/image";
import {
  eliminarImagen,
  marcarImagenPrincipal,
  moverImagen,
} from "@/app/admin/(panel)/productos/imagenes-actions";
import { BotonEliminar } from "@/components/admin/BotonEliminar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ImagenProducto = {
  id: number;
  url: string;
  url_miniatura: string | null;
  es_principal: boolean;
};

type Props = {
  productoId: number;
  nombreProducto: string;
  /** Ya ordenadas (la principal primero no es necesario: se marca con una insignia). */
  imagenes: ImagenProducto[];
};

/**
 * Galería de las imágenes del producto. Es un Server Component: cada botón es un
 * <form> que llama a una Server Action, así que funciona sin JavaScript y el
 * servidor comprueba el permiso en cada acción.
 */
export function GaleriaImagenes({
  productoId,
  nombreProducto,
  imagenes,
}: Props) {
  if (imagenes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        Este producto aún no tiene imágenes. La primera que subas será la
        principal.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {imagenes.map((img, i) => (
        <li
          key={img.id}
          className={cn(
            "grid content-start gap-2 rounded-xl border bg-background p-2",
            img.es_principal && "border-ev-azul ring-2 ring-ev-azul/30",
          )}
        >
          <div className="relative aspect-square overflow-hidden rounded-lg border bg-white">
            <Image
              src={img.url_miniatura ?? img.url}
              alt={`${nombreProducto}, imagen ${i + 1}`}
              fill
              sizes="(min-width: 1024px) 200px, (min-width: 640px) 30vw, 45vw"
              className="object-contain p-1.5"
            />
            {img.es_principal ? (
              <Badge className="absolute top-1.5 left-1.5 gap-1">
                <Star aria-hidden className="size-3" />
                Principal
              </Badge>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <form action={moverImagen} className="flex gap-1">
              <input type="hidden" name="id" value={img.id} />
              <input type="hidden" name="producto" value={productoId} />
              <Button
                type="submit"
                name="direccion"
                value="arriba"
                variant="outline"
                size="icon"
                disabled={i === 0}
                aria-label={`Subir la imagen ${i + 1}`}
              >
                <ArrowUp aria-hidden />
              </Button>
              <Button
                type="submit"
                name="direccion"
                value="abajo"
                variant="outline"
                size="icon"
                disabled={i === imagenes.length - 1}
                aria-label={`Bajar la imagen ${i + 1}`}
              >
                <ArrowDown aria-hidden />
              </Button>
            </form>

            {!img.es_principal ? (
              <form action={marcarImagenPrincipal}>
                <input type="hidden" name="id" value={img.id} />
                <input type="hidden" name="producto" value={productoId} />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="min-h-9"
                  aria-label={`Marcar la imagen ${i + 1} como principal`}
                >
                  Principal
                </Button>
              </form>
            ) : null}

            <BotonEliminar
              accion={eliminarImagen}
              id={img.id}
              extras={{ producto: productoId }}
              nombre={`imagen ${i + 1}`}
              descripcion={
                img.es_principal
                  ? "Es la imagen principal: si la eliminas, la siguiente pasará a serlo."
                  : "Se borra la imagen y su miniatura. No se puede deshacer."
              }
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
