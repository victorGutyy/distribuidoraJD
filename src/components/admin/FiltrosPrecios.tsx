import Link from "next/link";
import { claseSelect } from "@/components/admin/CampoForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OpcionCategoria } from "@/lib/catalogo/categorias";
import type { FiltrosProductos } from "@/lib/catalogo/filtros-productos";

type Props = {
  filtros: FiltrosProductos;
  categorias: OpcionCategoria[];
  marcas: { id: number; nombre: string }[];
};

/**
 * Filtros del editor de precios. Es un <form method="get">: los filtros quedan en
 * la URL (se puede compartir el enlace) y funciona aunque no cargue JavaScript.
 */
export function FiltrosPrecios({ filtros, categorias, marcas }: Props) {
  return (
    <form
      method="get"
      action="/admin/precios"
      className="grid gap-3 rounded-xl border bg-background p-4"
    >
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <div className="grid gap-1.5">
          <label htmlFor="p-q" className="text-sm leading-none font-medium">
            Buscar por nombre, marca, presentación o SKU
          </label>
          <Input
            id="p-q"
            name="q"
            type="search"
            defaultValue={filtros.q}
            placeholder="Ej. arroz, diana, 500 g"
            className="h-11 text-base md:text-sm"
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="p-categoria" className="text-sm leading-none font-medium">
            Categoría
          </label>
          <select
            id="p-categoria"
            name="categoria"
            defaultValue={filtros.categoria ?? ""}
            className={claseSelect}
          >
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="p-marca" className="text-sm leading-none font-medium">
            Marca
          </label>
          <select
            id="p-marca"
            name="marca"
            defaultValue={filtros.marca ?? ""}
            className={claseSelect}
          >
            <option value="">Todas</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          name="sin_precio"
          value="1"
          defaultChecked={filtros.sinPrecio}
          className="size-5 accent-ev-azul"
        />
        Solo presentaciones sin precio
      </label>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-11">
          Filtrar
        </Button>
        <Link
          href="/admin/precios"
          className="inline-flex h-11 items-center rounded-lg border px-4 text-sm font-medium hover:bg-muted"
        >
          Limpiar filtros
        </Link>
      </div>
    </form>
  );
}
