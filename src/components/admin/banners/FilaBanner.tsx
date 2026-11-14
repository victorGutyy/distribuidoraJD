import { ArrowDown, ArrowUp } from "lucide-react";
import Image from "next/image";
import { actualizarBanner, eliminarBanner, moverBanner } from "@/app/admin/(panel)/banners/actions";
import { BotonEliminar } from "@/components/admin/BotonEliminar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = {
  banner: { id: number; imagen_url: string; imagen_movil_url: string | null; enlace: string | null; activo: boolean };
  posicion: number;
  total: number;
};

/** Un banner de la lista: vista previa, enlace, activo, orden y eliminar (cada botón es un <form>). */
export function FilaBanner({ banner, posicion, total }: Props) {
  const { id, imagen_url, imagen_movil_url, enlace, activo } = banner;
  return (
    <div className="grid gap-3 rounded-xl border bg-background p-3 md:grid-cols-[16rem_1fr]">
      <div className="grid gap-2">
        <div className="relative aspect-[21/8] overflow-hidden rounded-lg bg-muted">
          <Image src={imagen_url} alt={`Banner ${posicion}, vista para escritorio`} fill sizes="256px" className="object-cover" />
        </div>
        {imagen_movil_url ? (
          <div className="relative aspect-[16/9] w-24 overflow-hidden rounded-lg bg-muted">
            <Image src={imagen_movil_url} alt={`Banner ${posicion}, vista para celular`} fill sizes="96px" className="object-cover" />
          </div>
        ) : null}
      </div>

      <div className="grid content-start gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Banner {posicion}</span>
          <Badge variant={activo ? "outline" : "secondary"}>{activo ? "Activo" : "Inactivo"}</Badge>
          <div className="ml-auto flex gap-1">
            {(["subir", "bajar"] as const).map((dir) => (
              <form key={dir} action={moverBanner}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="direccion" value={dir} />
                <Button
                  type="submit"
                  variant="outline"
                  size="icon"
                  className="size-9"
                  disabled={dir === "subir" ? posicion === 1 : posicion === total}
                  aria-label={dir === "subir" ? `Subir el banner ${posicion}` : `Bajar el banner ${posicion}`}
                >
                  {dir === "subir" ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}
                </Button>
              </form>
            ))}
          </div>
        </div>

        <form action={actualizarBanner} className="grid gap-2">
          <input type="hidden" name="id" value={id} />
          <label htmlFor={`enlace-${id}`} className="text-sm font-medium">
            Enlace
          </label>
          <input
            id={`enlace-${id}`}
            name="enlace"
            type="text"
            defaultValue={enlace ?? ""}
            placeholder="/catalogo?ofertas=1"
            className="h-11 rounded-lg border bg-background px-3 text-base md:text-sm"
          />
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
            <input type="checkbox" name="activo" defaultChecked={activo} className="size-5 accent-ev-azul" />
            Activo (se muestra en el inicio)
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="outline" className="h-11">
              Guardar cambios
            </Button>
            <BotonEliminar
              accion={eliminarBanner}
              id={id}
              nombre={`el banner ${posicion}`}
              descripcion="Se elimina el banner y sus imágenes. Si solo quieres ocultarlo un tiempo, desmarca «Activo»."
            />
          </div>
        </form>
      </div>
    </div>
  );
}
