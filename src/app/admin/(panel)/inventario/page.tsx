import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Paginacion } from "@/components/admin/Paginacion";
import { FiltrosInventario } from "@/components/admin/inventario/FiltrosInventario";
import { TablaInventario } from "@/components/admin/inventario/TablaInventario";
import { requerirSeccion } from "@/lib/auth";
import { normalizarBusqueda, rangoPagina } from "@/lib/catalogo/filtros-productos";
import { formatStock, STOCK_BAJO } from "@/lib/costos";
import { ahoraEnBogota } from "@/lib/entregas";
import { formatCOP } from "@/lib/formato";
import {
  inicioDelMes,
  leerFiltrosInventario,
  leerResumenCostos,
  POR_PAGINA_INVENTARIO,
  urlInventario,
} from "@/lib/inventario";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Inventario" };

type Params = PageProps<"/admin/inventario">["searchParams"];

export default function PaginaInventario({ searchParams }: PageProps<"/admin/inventario">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
      <ContenidoInventario searchParams={searchParams} />
    </Suspense>
  );
}

function Dato({ titulo, valor, ayuda }: { titulo: string; valor: string; ayuda: string }) {
  return (
    <div className="grid gap-1 rounded-xl border bg-background p-4">
      <span className="text-sm text-muted-foreground">{titulo}</span>
      <span className="text-2xl font-bold tabular-nums">{valor}</span>
      <span className="text-xs text-muted-foreground">{ayuda}</span>
    </div>
  );
}

async function ContenidoInventario({ searchParams }: { searchParams: Params }) {
  await requerirSeccion("inventario");
  const filtros = leerFiltrosInventario(await searchParams);
  const supabase = await createClient();
  const hoy = ahoraEnBogota(new Date()).fecha;

  let consulta = supabase.from("v_inventario_admin").select("*", { count: "exact" });
  // Cada palabra debe aparecer (en cualquier orden y sin importar las tildes).
  for (const palabra of filtros.q.split(/\s+/).filter(Boolean)) {
    consulta = consulta.ilike("texto_busqueda", `%${normalizarBusqueda(palabra)}%`);
  }
  switch (filtros.estado) {
    case "sin_stock":
      consulta = consulta.eq("stock", 0);
      break;
    case "poco":
      consulta = consulta.gt("stock", 0).lte("stock", STOCK_BAJO);
      break;
    case "negativo":
      consulta = consulta.lt("stock", 0);
      break;
    case "sin_costo":
      consulta = consulta.is("costo", null);
      break;
    case "sin_dato":
      consulta = consulta.is("stock", null);
      break;
  }
  consulta = consulta.order("producto_nombre").order("variante_id");

  const desde = (filtros.pagina - 1) * POR_PAGINA_INVENTARIO;
  const [{ data, count, error }, resumenBD] = await Promise.all([
    consulta.range(desde, desde + POR_PAGINA_INVENTARIO - 1),
    supabase.rpc("resumen_costos", { p_desde: inicioDelMes(hoy) }),
  ]);

  const total = count ?? 0;
  const pagina = rangoPagina(filtros.pagina, total, POR_PAGINA_INVENTARIO);
  if (!error && (data?.length ?? 0) === 0 && total > 0 && filtros.pagina > 1) {
    redirect(urlInventario(filtros, { pagina: pagina.actual }));
  }
  const resumen = resumenBD.error ? null : leerResumenCostos(resumenBD.data);
  const hayFiltros = filtros.q !== "" || filtros.estado !== "todos";

  return (
    <div className="mx-auto grid max-w-7xl gap-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Inventario</h1>
        <p className="text-muted-foreground">
          Existencias, costos y ganancia por presentación. Son datos privados: solo los ve la
          administración. Las existencias son informativas (no se descuentan solas con los
          pedidos); se actualizan importando el archivo de precios con la columna{" "}
          <b>stock</b> desde{" "}
          <Link href="/admin/importar" className="font-medium text-ev-azul hover:underline">
            Importar
          </Link>
          .
        </p>
      </header>

      {resumen ? (
        <section aria-label="Resumen del inventario" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Dato
            titulo="Valor del inventario"
            valor={formatCOP(resumen.inventario.valor)}
            ayuda="Existencias × costo (solo con costo conocido)"
          />
          <Dato
            titulo="Con existencias"
            valor={formatStock(resumen.inventario.conStock)}
            ayuda="Presentaciones con más de 0"
          />
          <Dato
            titulo="Sin stock"
            valor={formatStock(resumen.inventario.sinStock)}
            ayuda="Presentaciones en 0"
          />
          <Dato
            titulo="Stock negativo"
            valor={formatStock(resumen.inventario.negativos)}
            ayuda="Revisar con contabilidad"
          />
          <Dato
            titulo="Sin costo"
            valor={formatStock(resumen.inventario.sinCosto)}
            ayuda="No se puede calcular su ganancia"
          />
        </section>
      ) : (
        <p className="rounded-xl border border-destructive p-4 text-sm text-destructive">
          No pudimos calcular el resumen. Inténtalo de nuevo.
        </p>
      )}

      <FiltrosInventario filtros={filtros} />

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {total} {total === 1 ? "presentación" : "presentaciones"}
        {hayFiltros ? " con estos filtros" : ""}.
      </p>

      {error ? (
        <p className="rounded-xl border border-destructive p-4 text-sm text-destructive">
          No pudimos cargar el inventario. Inténtalo de nuevo.
        </p>
      ) : (data?.length ?? 0) === 0 ? (
        <p className="rounded-xl border bg-background p-6 text-center text-sm text-muted-foreground">
          {hayFiltros
            ? "Ninguna presentación coincide con estos filtros."
            : "Aún no hay productos. Impórtalos desde «Importar»."}
        </p>
      ) : (
        <TablaInventario filas={data ?? []} />
      )}

      <Paginacion
        actual={pagina.actual}
        totalPaginas={pagina.totalPaginas}
        urlDe={(p) => urlInventario(filtros, { pagina: p })}
      />
    </div>
  );
}
