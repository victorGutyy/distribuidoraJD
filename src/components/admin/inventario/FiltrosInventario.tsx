import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  ETIQUETA_FILTRO,
  FILTROS_ESTADO,
  type FiltrosInventario as Filtros,
} from "@/lib/inventario";
import { cn } from "@/lib/utils";

const claseCampo =
  "h-11 w-full rounded-lg border bg-background px-3 text-base md:text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none";

/**
 * Buscador y filtro de estado del inventario. Es un formulario GET normal (sin JavaScript):
 * al enviarlo, la URL lleva los filtros y la página se vuelve a pedir al servidor.
 */
export function FiltrosInventario({ filtros }: { filtros: Filtros }) {
  const hayFiltros = filtros.q !== "" || filtros.estado !== "todos";
  return (
    <form
      method="get"
      action="/admin/inventario"
      className="grid gap-3 rounded-xl border bg-background p-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end"
    >
      <label className="grid gap-1 text-sm font-medium">
        Buscar
        <input
          type="search"
          name="q"
          defaultValue={filtros.q}
          placeholder="Nombre, marca, SKU o presentación"
          autoComplete="off"
          className={claseCampo}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Estado
        <select name="estado" defaultValue={filtros.estado} className={claseCampo}>
          {FILTROS_ESTADO.map((e) => (
            <option key={e} value={e}>
              {ETIQUETA_FILTRO[e]}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <Button type="submit" className="h-11">
          Filtrar
        </Button>
        {hayFiltros ? (
          <Link
            href="/admin/inventario"
            className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}
          >
            Limpiar
          </Link>
        ) : null}
      </div>
    </form>
  );
}

