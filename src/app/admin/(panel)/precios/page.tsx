import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CuadriculaPrecios } from "@/components/admin/CuadriculaPrecios";
import { FiltrosPrecios } from "@/components/admin/FiltrosPrecios";
import { Paginacion } from "@/components/admin/Paginacion";
import { requerirSeccion } from "@/lib/auth";
import { idsConHijas, opcionesCategoria } from "@/lib/catalogo/categorias";
import {
  aFilaPrecio,
  POR_PAGINA_PRECIOS,
} from "@/lib/catalogo/cuadricula-precios";
import {
  leerFiltros,
  normalizarBusqueda,
  rangoPagina,
  urlLista,
} from "@/lib/catalogo/filtros-productos";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Precios" };

type Params = PageProps<"/admin/precios">["searchParams"];

export default function PaginaPrecios({
  searchParams,
}: PageProps<"/admin/precios">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}
    >
      <ContenidoPrecios searchParams={searchParams} />
    </Suspense>
  );
}

async function ContenidoPrecios({ searchParams }: { searchParams: Params }) {
  await requerirSeccion("precios");
  const filtros = leerFiltros(await searchParams);

  const supabase = await createClient();
  const [{ data: cats }, { data: marcas }] = await Promise.all([
    supabase.from("categorias").select("id, nombre, parent_id, orden"),
    supabase.from("marcas").select("id, nombre").order("nombre"),
  ]);
  const categorias = cats ?? [];

  let consulta = supabase.from("v_precios_admin").select("*", { count: "exact" });
  // Cada palabra debe aparecer (en cualquier orden): "arroz diana" encuentra "Arroz Premium Diana".
  for (const palabra of filtros.q.split(/\s+/).filter(Boolean)) {
    consulta = consulta.ilike("texto_busqueda", `%${normalizarBusqueda(palabra)}%`);
  }
  if (filtros.categoria) {
    consulta = consulta.in("categoria_id", idsConHijas(categorias, filtros.categoria));
  }
  if (filtros.marca) consulta = consulta.eq("marca_id", filtros.marca);
  if (filtros.sinPrecio) consulta = consulta.eq("sin_precio", true);
  consulta = consulta
    .order("producto_nombre")
    .order("producto_id")
    .order("orden")
    .order("id");

  const desde = (filtros.pagina - 1) * POR_PAGINA_PRECIOS;
  const {
    data,
    count,
    error: errorLectura,
  } = await consulta.range(desde, desde + POR_PAGINA_PRECIOS - 1);

  const total = count ?? 0;
  const pagina = rangoPagina(filtros.pagina, total, POR_PAGINA_PRECIOS);
  if (!errorLectura && (data?.length ?? 0) === 0 && total > 0 && filtros.pagina > 1) {
    redirect(urlLista("/admin/precios", filtros, { pagina: pagina.actual }));
  }

  // Costos (privados, RN-14): tabla aparte. Esta pantalla es solo de admin y editor.
  const ids = (data ?? []).flatMap((v) => (v.id === null ? [] : [v.id]));
  const { data: costosBD } =
    ids.length > 0
      ? await supabase.from("variante_costos").select("variante_id, costo").in("variante_id", ids)
      : { data: [] };
  const costoDe = new Map((costosBD ?? []).map((c) => [c.variante_id, c.costo]));
  const filas = (data ?? []).flatMap((v) => aFilaPrecio(v, costoDe.get(v.id ?? -1) ?? null) ?? []);
  const hayFiltros =
    filtros.q !== "" || filtros.categoria !== null || filtros.marca !== null || filtros.sinPrecio;

  return (
    <div className="mx-auto grid max-w-7xl gap-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Precios</h1>
        <p className="text-muted-foreground">
          {total} {total === 1 ? "presentación" : "presentaciones"}
          {hayFiltros ? " con estos filtros" : ""}. Escribe los precios y el costo
          y guarda todo junto; con Enter bajas a la fila siguiente. La ganancia se
          calcula sola. Un producto sin precio no se ve en la tienda.
        </p>
      </header>

      <FiltrosPrecios
        filtros={filtros}
        categorias={opcionesCategoria(categorias)}
        marcas={marcas ?? []}
      />

      {errorLectura ? (
        <p className="rounded-xl border border-destructive p-4 text-sm text-destructive">
          No pudimos cargar los precios. Inténtalo de nuevo.
        </p>
      ) : filas.length === 0 ? (
        <p className="rounded-xl border bg-background p-6 text-center text-sm text-muted-foreground">
          {hayFiltros
            ? "Ninguna presentación coincide con estos filtros."
            : "Aún no hay productos. Impórtalos desde «Importar»."}
        </p>
      ) : (
        <CuadriculaPrecios
          // Al cambiar de página o de filtros se descartan las ediciones (el navegador avisa antes).
          key={`${pagina.actual}-${urlLista("", filtros)}`}
          filas={filas}
        />
      )}

      <Paginacion
        actual={pagina.actual}
        totalPaginas={pagina.totalPaginas}
        urlDe={(p) => urlLista("/admin/precios", filtros, { pagina: p })}
      />
    </div>
  );
}
