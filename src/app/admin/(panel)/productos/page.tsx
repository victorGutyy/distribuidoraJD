import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AvisoPagina } from "@/components/admin/AvisoPagina";
import { FiltrosProductosForm } from "@/components/admin/FiltrosProductos";
import { Paginacion } from "@/components/admin/Paginacion";
import { TablaProductos } from "@/components/admin/TablaProductos";
import { buttonVariants } from "@/components/ui/button";
import { requerirSeccion } from "@/lib/auth";
import { idsConHijas, opcionesCategoria } from "@/lib/catalogo/categorias";
import { aFilaProducto } from "@/lib/catalogo/fila-producto";
import {
  leerFiltros,
  normalizarBusqueda,
  POR_PAGINA,
  rangoPagina,
  urlLista,
} from "@/lib/catalogo/filtros-productos";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Productos" };

type Params = PageProps<"/admin/productos">["searchParams"];

export default function PaginaProductos({
  searchParams,
}: PageProps<"/admin/productos">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}
    >
      <ContenidoProductos searchParams={searchParams} />
    </Suspense>
  );
}

async function ContenidoProductos({ searchParams }: { searchParams: Params }) {
  const perfil = await requerirSeccion("productos");
  // El vendedor ve el catálogo pero no lo edita (matriz de permisos §6).
  const puedeEditar = perfil.rol !== "vendedor";

  const params = await searchParams;
  const filtros = leerFiltros(params);
  const ok = typeof params.ok === "string" ? params.ok : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;

  const supabase = await createClient();
  const [{ data: cats }, { data: marcas }] = await Promise.all([
    supabase.from("categorias").select("id, nombre, parent_id, orden"),
    supabase.from("marcas").select("id, nombre").order("nombre"),
  ]);
  const categorias = cats ?? [];

  // --- Consulta a la vista del panel, con los filtros de la URL ---
  let consulta = supabase
    .from("v_productos_admin")
    .select("*", { count: "exact" });
  if (filtros.q) {
    consulta = consulta.ilike(
      "texto_busqueda",
      `%${normalizarBusqueda(filtros.q)}%`,
    );
  }
  if (filtros.categoria) {
    consulta = consulta.in(
      "categoria_id",
      idsConHijas(categorias, filtros.categoria),
    );
  }
  if (filtros.marca) consulta = consulta.eq("marca_id", filtros.marca);
  if (filtros.estado !== "todos")
    consulta = consulta.eq("estado", filtros.estado);
  if (filtros.sinPrecio) consulta = consulta.eq("n_con_precio", 0);
  if (filtros.sinImagen) consulta = consulta.eq("tiene_imagen", false);

  switch (filtros.orden) {
    case "nombre":
      consulta = consulta.order("nombre");
      break;
    case "precio_asc":
      consulta = consulta.order("precio_min", {
        ascending: true,
        nullsFirst: false,
      });
      break;
    case "precio_desc":
      consulta = consulta.order("precio_min", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    default:
      consulta = consulta.order("updated_at", { ascending: false });
  }
  consulta = consulta.order("id");

  const desde = (filtros.pagina - 1) * POR_PAGINA;
  const {
    data,
    count,
    error: errorLectura,
  } = await consulta.range(desde, desde + POR_PAGINA - 1);

  const total = count ?? 0;
  const pagina = rangoPagina(filtros.pagina, total);
  // Una página que ya no existe (p. ej. tras filtrar) se corrige a la última.
  if (
    !errorLectura &&
    (data?.length ?? 0) === 0 &&
    total > 0 &&
    filtros.pagina > 1
  ) {
    redirect(urlLista("/admin/productos", filtros, { pagina: pagina.actual }));
  }

  const filas = (data ?? []).map(aFilaProducto);
  const opciones = opcionesCategoria(categorias);
  const hayFiltros =
    filtros.q !== "" ||
    filtros.categoria !== null ||
    filtros.marca !== null ||
    filtros.estado !== "todos" ||
    filtros.sinPrecio ||
    filtros.sinImagen;

  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Productos</h1>
          <p className="text-muted-foreground">
            {total} {total === 1 ? "producto" : "productos"}
            {hayFiltros ? " con estos filtros" : ""}. Un producto sin precio
            queda en borrador y no se ve en la tienda.
          </p>
        </div>
        {puedeEditar ? (
          <Link
            href="/admin/productos/nuevo"
            className={cn(buttonVariants(), "h-11 px-4")}
          >
            Nuevo producto
          </Link>
        ) : null}
      </header>

      <AvisoPagina ok={ok} error={error} />
      {errorLectura ? <AvisoPagina error="generico" /> : null}

      <FiltrosProductosForm
        filtros={filtros}
        categorias={opciones}
        marcas={marcas ?? []}
      />

      {filas.length === 0 ? (
        <p className="rounded-xl border bg-background p-6 text-center text-sm text-muted-foreground">
          {hayFiltros
            ? "Ningún producto coincide con estos filtros."
            : "Aún no hay productos. Crea el primero con «Nuevo producto»."}
        </p>
      ) : (
        <TablaProductos
          // Al cambiar de página o de filtros se reinicia la selección.
          key={`${filtros.pagina}-${urlLista("", filtros)}`}
          filas={filas}
          categorias={opciones}
          puedeEditar={puedeEditar}
        />
      )}

      <Paginacion
        actual={pagina.actual}
        totalPaginas={pagina.totalPaginas}
        urlDe={(p) => urlLista("/admin/productos", filtros, { pagina: p })}
      />
    </div>
  );
}
