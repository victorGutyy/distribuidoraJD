"use client";

import {
  createColumnHelper,
  rowSelectionFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { Package } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { duplicarProducto } from "@/app/admin/(panel)/productos/actions";
import {
  AccionesMasivas,
  type AvisoMasivo,
} from "@/components/admin/AccionesMasivas";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import type { OpcionCategoria } from "@/lib/catalogo/categorias";
import type { FilaProducto } from "@/lib/catalogo/fila-producto";
import { formatCOP } from "@/lib/formato";
import { cn } from "@/lib/utils";

// TanStack Table v9 solo gestiona aquí la SELECCIÓN de filas. El orden, los filtros
// y la paginación los hace el servidor (por eso viajan en la URL); el marcado
// (HTML) y los estilos son nuestros. `features` y `columns` van fuera del
// componente para que sean estables entre renders.
const features = tableFeatures({ rowSelectionFeature });
const ayudante = createColumnHelper<typeof features, FilaProducto>();
const columns = ayudante.columns([
  ayudante.accessor("nombre", { header: "Producto" }),
]);

type Props = {
  filas: FilaProducto[];
  categorias: OpcionCategoria[];
  /** false = vendedor: solo ve la lista, sin casillas ni acciones. */
  puedeEditar: boolean;
};

const ETIQUETA_ESTADO = {
  borrador: "Borrador",
  activo: "Activo",
  inactivo: "Inactivo",
} as const;

function precioTexto(f: FilaProducto): string {
  if (f.precioMin === null) return "Sin precio";
  if (f.precioMax === null || f.precioMax === f.precioMin) {
    return formatCOP(f.precioMin);
  }
  return `${formatCOP(f.precioMin)} – ${formatCOP(f.precioMax)}`;
}

function Miniatura({ url, nombre }: { url: string | null; nombre: string }) {
  if (!url) {
    return (
      <span
        aria-label="Sin imagen"
        className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
      >
        <Package className="size-5" aria-hidden />
      </span>
    );
  }
  return (
    <Image
      src={url}
      alt={nombre}
      width={48}
      height={48}
      className="size-12 shrink-0 rounded-lg border bg-white object-contain p-0.5"
    />
  );
}

export function TablaProductos({ filas, categorias, puedeEditar }: Props) {
  const table = useTable({
    features,
    columns,
    data: filas,
    getRowId: (fila) => String(fila.id),
  });

  // El aviso vive aquí (y no en la barra) porque la barra desaparece al limpiar la selección.
  const [aviso, setAviso] = useState<AvisoMasivo | null>(null);

  const filasTabla = table.getRowModel().rows;
  const idsSeleccionados = Object.keys(table.state.rowSelection ?? {})
    .filter((id) => table.state.rowSelection?.[id])
    .map(Number);

  return (
    <div className="grid gap-3">
      {aviso ? (
        <p
          role={aviso.tipo === "error" ? "alert" : "status"}
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            aviso.tipo === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "bg-muted",
          )}
        >
          {aviso.texto}
        </p>
      ) : null}

      {puedeEditar && idsSeleccionados.length > 0 ? (
        <AccionesMasivas
          ids={idsSeleccionados}
          categorias={categorias}
          alTerminar={(resultado) => {
            setAviso(resultado);
            if (resultado.tipo === "ok") table.resetRowSelection(true);
          }}
        />
      ) : null}

      <div className="overflow-x-auto rounded-xl border bg-background">
        <table className="w-full min-w-[40rem] text-sm">
          <caption className="sr-only">Lista de productos</caption>
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              {puedeEditar ? (
                <th scope="col" className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todos los productos de esta página"
                    className="size-5 accent-ev-azul"
                    checked={table.getIsAllRowsSelected()}
                    onChange={table.getToggleAllRowsSelectedHandler()}
                  />
                </th>
              ) : null}
              <th scope="col" className="px-3 py-2 font-medium">
                Producto
              </th>
              <th
                scope="col"
                className="hidden px-3 py-2 font-medium md:table-cell"
              >
                Categoría
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Precio
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Estado
              </th>
              {puedeEditar ? (
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Acciones
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {filasTabla.map((row) => {
              const f = row.original;
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b last:border-0",
                    row.getIsSelected() && "bg-ev-azul/5",
                  )}
                >
                  {puedeEditar ? (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar ${f.nombre}`}
                        className="size-5 accent-ev-azul"
                        checked={row.getIsSelected()}
                        onChange={row.getToggleSelectedHandler()}
                      />
                    </td>
                  ) : null}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <Miniatura url={f.imagen} nombre={f.nombre} />
                      <div className="min-w-0">
                        {puedeEditar ? (
                          <Link
                            href={`/admin/productos/${f.id}`}
                            className="font-medium hover:underline"
                          >
                            {f.nombre}
                          </Link>
                        ) : (
                          <span className="font-medium">{f.nombre}</span>
                        )}
                        <p className="truncate text-xs text-muted-foreground">
                          {f.marca ? `${f.marca} · ` : ""}
                          {f.nVariantes}{" "}
                          {f.nVariantes === 1
                            ? "presentación"
                            : "presentaciones"}
                          {f.nConPrecio < f.nVariantes
                            ? ` (${f.nVariantes - f.nConPrecio} sin precio)`
                            : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">
                    {f.categoria}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {precioTexto(f)}
                    {f.hayOferta ? (
                      <Badge className="ml-2" variant="secondary">
                        Oferta
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={f.estado === "activo" ? "outline" : "secondary"}
                    >
                      {ETIQUETA_ESTADO[f.estado]}
                    </Badge>
                    {f.estado === "activo" && !f.visibleEnTienda ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Oculto: categoría inactiva
                      </p>
                    ) : null}
                    {f.estado === "borrador" ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        No se ve en la tienda
                      </p>
                    ) : null}
                  </td>
                  {puedeEditar ? (
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/productos/${f.id}`}
                          aria-label={`Editar ${f.nombre}`}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "min-h-9",
                          )}
                        >
                          Editar
                        </Link>
                        <form action={duplicarProducto}>
                          <input type="hidden" name="id" value={f.id} />
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            className="min-h-9"
                            aria-label={`Duplicar ${f.nombre}`}
                          >
                            Duplicar
                          </Button>
                        </form>
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
