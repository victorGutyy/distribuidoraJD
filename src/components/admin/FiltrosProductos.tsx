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

function Etiqueta({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <label htmlFor={id} className="text-sm leading-none font-medium">
      {children}
    </label>
  );
}

/**
 * Filtros de la lista de productos. Es un <form method="get">: al enviarlo, los
 * filtros quedan en la URL (se puede compartir el enlace) y no hace falta JavaScript.
 */
export function FiltrosProductosForm({ filtros, categorias, marcas }: Props) {
  return (
    <form
      method="get"
      action="/admin/productos"
      className="grid gap-3 rounded-xl border bg-background p-4"
    >
      <div className="grid gap-1.5">
        <Etiqueta id="f-q">Buscar por nombre, marca o SKU</Etiqueta>
        <Input
          id="f-q"
          name="q"
          type="search"
          defaultValue={filtros.q}
          placeholder="Ej. lentejas, doña lupe, EV-00001"
          className="h-11 text-base md:text-sm"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-1.5">
          <Etiqueta id="f-categoria">Categoría</Etiqueta>
          <select
            id="f-categoria"
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
          <Etiqueta id="f-marca">Marca</Etiqueta>
          <select
            id="f-marca"
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
        <div className="grid gap-1.5">
          <Etiqueta id="f-estado">Estado</Etiqueta>
          <select
            id="f-estado"
            name="estado"
            defaultValue={filtros.estado}
            className={claseSelect}
          >
            <option value="todos">Todos</option>
            <option value="borrador">Borrador (sin precio)</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Etiqueta id="f-orden">Ordenar por</Etiqueta>
          <select
            id="f-orden"
            name="orden"
            defaultValue={filtros.orden}
            className={claseSelect}
          >
            <option value="recientes">Más recientes</option>
            <option value="nombre">Nombre (A-Z)</option>
            <option value="precio_asc">Precio: menor a mayor</option>
            <option value="precio_desc">Precio: mayor a menor</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            name="sin_precio"
            value="1"
            defaultChecked={filtros.sinPrecio}
            className="size-5 accent-ev-azul"
          />
          Solo sin precio
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            name="sin_imagen"
            value="1"
            defaultChecked={filtros.sinImagen}
            className="size-5 accent-ev-azul"
          />
          Solo sin imagen
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-11">
          Filtrar
        </Button>
        <Link
          href="/admin/productos"
          className="inline-flex h-11 items-center rounded-lg border px-4 text-sm font-medium hover:bg-muted"
        >
          Limpiar filtros
        </Link>
      </div>
    </form>
  );
}
