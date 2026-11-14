import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Paginacion } from "@/components/admin/Paginacion";
import { FiltrosCatalogoPanel } from "@/components/tienda/FiltrosCatalogo";
import { HojaFiltros } from "@/components/tienda/HojaFiltros";
import { OrdenCatalogoSelect } from "@/components/tienda/OrdenCatalogo";
import { TarjetaProducto } from "@/components/tienda/TarjetaProducto";
import { formatCOP } from "@/lib/formato";
import { armarArbol, conteosAcumulados, resolverCategoria } from "@/lib/tienda/categorias";
import { listarCatalogo, obtenerFacetas } from "@/lib/tienda/consultas";
import { obtenerCategoriasTienda, obtenerConfigTienda } from "@/lib/tienda/datos";
import {
  chipsActivos,
  hayFiltros,
  leerFiltrosCatalogo,
  urlCatalogo,
} from "@/lib/tienda/filtros-catalogo";
import { enlaceWhatsApp } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Catálogo",
  description:
    "Catálogo de EV Distribuidora: víveres, aseo, útiles escolares y más, al por mayor y al detal.",
};

type Params = PageProps<"/catalogo">["searchParams"];

export default function PaginaCatalogo({ searchParams }: PageProps<"/catalogo">) {
  return (
    <Suspense fallback={<EsqueletoCatalogo />}>
      <ContenidoCatalogo searchParams={searchParams} />
    </Suspense>
  );
}

function EsqueletoCatalogo() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </main>
  );
}

async function ContenidoCatalogo({ searchParams }: { searchParams: Params }) {
  const filtros = leerFiltrosCatalogo(await searchParams);
  const [categorias, facetas, config] = await Promise.all([
    obtenerCategoriasTienda(),
    obtenerFacetas(),
    obtenerConfigTienda(),
  ]);
  const resuelta = resolverCategoria(categorias, filtros.cat);
  const resultado = await listarCatalogo(filtros, resuelta.ids);

  const arbol = armarArbol(categorias);
  const conteos = conteosAcumulados(categorias, new Map(Object.entries(facetas.porCategoria).map(([k, v]) => [Number(k), v])));
  const chips = chipsActivos(
    filtros,
    {
      categoria: resuelta.actual?.nombre,
      marcas: new Map(facetas.marcas.map((m) => [m.slug, m.nombre])),
    },
    formatCOP,
  );

  const titulo = filtros.q
    ? `Resultados para «${filtros.q}»`
    : (resuelta.actual?.nombre ?? "Catálogo");
  const panel = (idPrefijo: string) => (
    <FiltrosCatalogoPanel filtros={filtros} arbol={arbol} conteos={conteos} facetas={facetas} idPrefijo={idPrefijo} />
  );

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
      <nav aria-label="Ruta de navegación" className="mb-2 text-xs text-muted-foreground">
        <Link href="/" className="hover:underline">Inicio</Link>
        {" › "}
        <Link href="/catalogo" className="hover:underline">Catálogo</Link>
        {resuelta.raiz && resuelta.raiz.id !== resuelta.actual?.id ? (
          <>
            {" › "}
            <Link href={urlCatalogo(filtros, { cat: resuelta.raiz.slug })} className="hover:underline">
              {resuelta.raiz.nombre}
            </Link>
          </>
        ) : null}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside className="hidden lg:block" aria-label="Filtros">
          {panel("fd")}
        </aside>

        <section aria-labelledby="titulo-catalogo" className="min-w-0">
          <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 id="titulo-catalogo" className="text-2xl font-bold tracking-tight">{titulo}</h1>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {resultado.total} {resultado.total === 1 ? "producto" : "productos"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="lg:hidden">
                <HojaFiltros activos={chips.length}>{panel("fm")}</HojaFiltros>
              </div>
              <OrdenCatalogoSelect filtros={filtros} />
            </div>
          </header>

          {chips.length > 0 ? (
            <ul className="mb-4 flex flex-wrap gap-2" aria-label="Filtros activos">
              {chips.map((c) => (
                <li key={c.clave}>
                  <Link
                    href={c.href}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-muted px-3 text-sm hover:bg-muted/70"
                    aria-label={`Quitar filtro ${c.etiqueta}`}
                  >
                    {c.etiqueta}
                    <span aria-hidden="true">✕</span>
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={urlCatalogo({ ...filtros, cat: null, marcas: [], min: null, max: null, ofertas: false, disponibles: false })}
                  className="inline-flex h-9 items-center px-2 text-sm underline"
                >
                  Limpiar filtros
                </Link>
              </li>
            </ul>
          ) : null}

          {resultado.productos.length === 0 ? (
            <SinResultados q={filtros.q} conFiltros={hayFiltros(filtros)} filtros={filtros} whatsapp={config.whatsapp} />
          ) : (
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
              {resultado.productos.map((p, i) => (
                <li key={p.id} className="flex">
                  <div className="flex-1">
                    <TarjetaProducto producto={p} prioridad={i < 4} />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6">
            <Paginacion
              actual={resultado.pagina}
              totalPaginas={resultado.totalPaginas}
              urlDe={(p) => urlCatalogo(filtros, { pagina: p })}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function SinResultados({
  q,
  conFiltros,
  filtros,
  whatsapp,
}: {
  q: string;
  conFiltros: boolean;
  filtros: ReturnType<typeof leerFiltrosCatalogo>;
  whatsapp: string | null;
}) {
  return (
    <div className="grid justify-items-center gap-3 rounded-xl border bg-background p-8 text-center">
      <p className="text-lg font-semibold">
        {q ? `No encontramos «${q}»` : "No hay productos para mostrar"}
      </p>
      <p className="max-w-md text-sm text-muted-foreground">
        {conFiltros
          ? "Prueba quitando algún filtro."
          : "Revisa la ortografía o prueba con una palabra más corta, por ejemplo la marca o el tipo de producto."}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {conFiltros ? (
          <Link
            href={urlCatalogo({ ...filtros, cat: null, marcas: [], min: null, max: null, ofertas: false, disponibles: false })}
            className="inline-flex h-11 items-center rounded-lg border px-4 text-sm font-medium hover:bg-muted"
          >
            Quitar filtros
          </Link>
        ) : null}
        <Link
          href="/catalogo"
          className="inline-flex h-11 items-center rounded-lg border px-4 text-sm font-medium hover:bg-muted"
        >
          Ver todo el catálogo
        </Link>
        {whatsapp ? (
          <a
            href={enlaceWhatsApp(whatsapp, q ? `Hola, estoy buscando: ${q}` : "Hola, necesito ayuda con un producto")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center rounded-lg bg-ev-azul px-4 text-sm font-semibold text-white"
          >
            Pregúntanos por WhatsApp
          </a>
        ) : null}
      </div>
    </div>
  );
}
