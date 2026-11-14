import Link from "next/link";
import { MarcasFiltro } from "@/components/tienda/MarcasFiltro";
import { Button } from "@/components/ui/button";
import type { NodoCategoria } from "@/lib/tienda/categorias";
import type { Facetas } from "@/lib/tienda/consultas";
import { urlCatalogo, type FiltrosCatalogo } from "@/lib/tienda/filtros-catalogo";
import { cn } from "@/lib/utils";

type Props = {
  filtros: FiltrosCatalogo;
  arbol: NodoCategoria[];
  /** Conteo por categoría (con las hijas ya sumadas en su principal). */
  conteos: ReadonlyMap<number, number>;
  facetas: Facetas;
  /** Evita ids repetidos cuando el panel se dibuja dos veces (escritorio y hoja móvil). */
  idPrefijo: string;
};

const enlace = "flex min-h-11 items-center justify-between gap-2 rounded-lg px-2 text-sm hover:bg-muted";

/**
 * Panel de filtros (RF-05): árbol de categorías (enlaces) y un formulario GET con
 * marcas, rango de precio y casillas. Todo queda en la URL.
 */
export function FiltrosCatalogoPanel({ filtros, arbol, conteos, facetas, idPrefijo }: Props) {
  return (
    <div className="grid gap-6">
      <nav aria-label="Categorías del catálogo">
        <h2 className="mb-1 text-sm font-semibold">Categoría</h2>
        <ul className="grid">
          <li>
            <Link href={urlCatalogo(filtros, { cat: null })} className={cn(enlace, filtros.cat === null && "font-semibold")}>
              Todas
            </Link>
          </li>
          {arbol.map(({ raiz, hijas: todasLasHijas }) => {
            // Las categorías sin productos a la venta no se muestran (salvo la elegida).
            if ((conteos.get(raiz.id) ?? 0) === 0 && filtros.cat !== raiz.slug) return null;
            const hijas = todasLasHijas.filter(
              (h) => (conteos.get(h.id) ?? 0) > 0 || filtros.cat === h.slug,
            );
            const enRama = filtros.cat === raiz.slug || hijas.some((h) => h.slug === filtros.cat);
            return (
              <li key={raiz.id}>
                <Link
                  href={urlCatalogo(filtros, { cat: raiz.slug })}
                  aria-current={filtros.cat === raiz.slug ? "page" : undefined}
                  className={cn(enlace, filtros.cat === raiz.slug && "bg-muted font-semibold")}
                >
                  <span>{raiz.nombre}</span>
                  <span className="text-xs text-muted-foreground">{conteos.get(raiz.id) ?? 0}</span>
                </Link>
                {enRama && hijas.length > 0 ? (
                  <ul className="ml-3 grid border-l pl-2">
                    {hijas.map((h) => (
                      <li key={h.id}>
                        <Link
                          href={urlCatalogo(filtros, { cat: h.slug })}
                          aria-current={filtros.cat === h.slug ? "page" : undefined}
                          className={cn(enlace, filtros.cat === h.slug && "bg-muted font-semibold")}
                        >
                          <span>{h.nombre}</span>
                          <span className="text-xs text-muted-foreground">{conteos.get(h.id) ?? 0}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>

      <form action="/catalogo" method="get" className="grid gap-5">
        {filtros.q ? <input type="hidden" name="q" value={filtros.q} /> : null}
        {filtros.cat ? <input type="hidden" name="cat" value={filtros.cat} /> : null}
        {filtros.orden !== "relevancia" ? <input type="hidden" name="orden" value={filtros.orden} /> : null}

        <MarcasFiltro marcas={facetas.marcas} seleccionadas={filtros.marcas} idPrefijo={idPrefijo} />

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold">Precio</legend>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid min-w-0 gap-1 text-xs text-muted-foreground" htmlFor={`${idPrefijo}-min`}>
              Desde ($)
              <input
                id={`${idPrefijo}-min`}
                name="min"
                type="number"
                inputMode="numeric"
                min={0}
                step={100}
                defaultValue={filtros.min ?? ""}
                className="h-11 w-full min-w-0 rounded-lg border bg-background px-3 text-base text-foreground md:text-sm"
              />
            </label>
            <label className="grid min-w-0 gap-1 text-xs text-muted-foreground" htmlFor={`${idPrefijo}-max`}>
              Hasta ($)
              <input
                id={`${idPrefijo}-max`}
                name="max"
                type="number"
                inputMode="numeric"
                min={0}
                step={100}
                defaultValue={filtros.max ?? ""}
                className="h-11 w-full min-w-0 rounded-lg border bg-background px-3 text-base text-foreground md:text-sm"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="grid">
          <legend className="sr-only">Mostrar solo</legend>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" name="ofertas" value="1" defaultChecked={filtros.ofertas} className="size-5 accent-ev-azul" />
            Solo ofertas
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" name="disponibles" value="1" defaultChecked={filtros.disponibles} className="size-5 accent-ev-azul" />
            Solo disponibles
          </label>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="h-11 flex-1">
            Aplicar filtros
          </Button>
          <Link
            href={urlCatalogo({ ...filtros, cat: null, marcas: [], min: null, max: null, ofertas: false, disponibles: false })}
            className="inline-flex h-11 items-center rounded-lg border px-4 text-sm font-medium hover:bg-muted"
          >
            Limpiar
          </Link>
        </div>
      </form>
    </div>
  );
}
