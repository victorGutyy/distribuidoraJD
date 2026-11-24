import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Paginacion } from "@/components/admin/Paginacion";
import { BotonImprimir } from "@/components/admin/pedidos/BotonImprimir";
import { FiltrosPedidosForm } from "@/components/admin/pedidos/FiltrosPedidosForm";
import { InsigniaEstado } from "@/components/admin/pedidos/InsigniaEstado";
import { TablaPedidos, textoZona, type FilaPedido } from "@/components/admin/pedidos/TablaPedidos";
import { requerirSeccion } from "@/lib/auth";
import { ahoraEnBogota, sumarDias } from "@/lib/entregas";
import {
  agruparPorSector,
  leerFiltrosPedidos,
  POR_PAGINA_PEDIDOS,
  textoParaBuscar,
  urlPedidos,
} from "@/lib/filtros-pedidos";
import { formatCOP, formatFechaDia } from "@/lib/formato";
import { ESTADOS_ABIERTOS, esEstadoPedido } from "@/lib/pedidos";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pedidos" };

type Params = PageProps<"/admin/pedidos">["searchParams"];

export default function PaginaPedidos({ searchParams }: PageProps<"/admin/pedidos">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
      <ContenidoPedidos searchParams={searchParams} />
    </Suspense>
  );
}

async function ContenidoPedidos({ searchParams }: { searchParams: Params }) {
  await requerirSeccion("pedidos");
  const filtros = leerFiltrosPedidos(await searchParams);
  const supabase = await createClient();
  const ruta = filtros.vista === "ruta";

  const { data: sectoresBD } = await supabase
    .from("sectores")
    .select("id, nombre, municipios(nombre)")
    .order("nombre");
  const sectores = (sectoresBD ?? []).map((s) => ({
    id: s.id,
    nombre: s.nombre,
    municipio: (s.municipios as unknown as { nombre: string } | null)?.nombre ?? "",
  }));

  // Por ruta: la fecha por defecto es MAÑANA (HU-04: "los pedidos de mañana").
  const entregaRuta = filtros.entrega ?? sumarDias(ahoraEnBogota(new Date()).fecha, 1);

  let consulta = supabase.from("v_pedidos_admin").select("*", { count: "exact" });
  if (ruta) {
    consulta = consulta.eq("fecha_entrega_estimada", entregaRuta).neq("estado", "cancelado");
    if (filtros.sector) consulta = consulta.eq("sector_id", filtros.sector);
    consulta = consulta.order("sector_nombre", { nullsFirst: false }).order("numero").limit(500);
  } else {
    if (filtros.q) consulta = consulta.ilike("texto_busqueda", `%${textoParaBuscar(filtros.q)}%`);
    if (filtros.estado) consulta = consulta.eq("estado", filtros.estado);
    if (filtros.entrega) consulta = consulta.eq("fecha_entrega_estimada", filtros.entrega);
    if (filtros.sector) consulta = consulta.eq("sector_id", filtros.sector);
    // Las fechas "hecho desde/hasta" son días de Bogotá (UTC-5).
    if (filtros.desde) consulta = consulta.gte("created_at", `${filtros.desde}T00:00:00-05:00`);
    if (filtros.hasta) consulta = consulta.lt("created_at", `${sumarDias(filtros.hasta, 1)}T00:00:00-05:00`);
    consulta = consulta.order("created_at", { ascending: false }).order("id", { ascending: false });
    const desde = (filtros.pagina - 1) * POR_PAGINA_PEDIDOS;
    consulta = consulta.range(desde, desde + POR_PAGINA_PEDIDOS - 1);
  }
  const { data, count, error } = await consulta;
  const pedidos = (data ?? []) as FilaPedido[];

  // Pedidos de días anteriores que siguen sin resolverse: si no, desaparecen de la ruta y se olvidan (P-01).
  let atrasados: FilaPedido[] = [];
  if (ruta && !error) {
    let q = supabase
      .from("v_pedidos_admin")
      .select("*")
      .lt("fecha_entrega_estimada", ahoraEnBogota(new Date()).fecha)
      .in("estado", [...ESTADOS_ABIERTOS])
      .order("fecha_entrega_estimada")
      .order("numero")
      .limit(100);
    if (filtros.sector) q = q.eq("sector_id", filtros.sector);
    const { data: viejos } = await q;
    atrasados = (viejos ?? []) as FilaPedido[];
  }
  const total = count ?? pedidos.length;

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA_PEDIDOS));
  if (!ruta && !error && pedidos.length === 0 && total > 0 && filtros.pagina > 1) {
    redirect(urlPedidos(filtros, { pagina: totalPaginas }));
  }

  const pestana = (activa: boolean) =>
    cn(
      "inline-flex h-11 items-center rounded-lg border px-4 text-sm font-medium",
      activa ? "border-ev-azul bg-ev-azul text-white" : "bg-background hover:bg-muted",
    );

  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-muted-foreground">
            {ruta
              ? `Pedidos para entregar el ${formatFechaDia(entregaRuta)}, agrupados por sector.`
              : `${total} ${total === 1 ? "pedido" : "pedidos"}.`}
          </p>
        </div>
        <nav className="flex gap-2" aria-label="Vista de pedidos">
          <Link href="/admin/pedidos" className={pestana(!ruta)} aria-current={!ruta ? "page" : undefined}>
            Lista
          </Link>
          <Link href="/admin/pedidos?vista=ruta" className={pestana(ruta)} aria-current={ruta ? "page" : undefined}>
            Por ruta
          </Link>
        </nav>
      </header>

      <FiltrosPedidosForm filtros={{ ...filtros, entrega: ruta ? entregaRuta : filtros.entrega }} sectores={sectores} />

      {error ? (
        <p role="alert" className="rounded-xl border border-destructive p-4 text-sm text-destructive">
          No pudimos cargar los pedidos. Inténtalo de nuevo.
        </p>
      ) : ruta ? (
        <>
          {atrasados.length > 0 ? <PedidosAtrasados pedidos={atrasados} /> : null}
          {pedidos.length === 0 ? (
            <p className="rounded-xl border bg-background p-6 text-center text-sm text-muted-foreground">
              No hay pedidos para entregar ese día.
            </p>
          ) : (
            <VistaRuta pedidos={pedidos} />
          )}
        </>
      ) : pedidos.length === 0 ? (
        <p className="rounded-xl border bg-background p-6 text-center text-sm text-muted-foreground">
          Ningún pedido coincide con estos filtros.
        </p>
      ) : (
        <>
          <TablaPedidos pedidos={pedidos} />
          <Paginacion
            actual={Math.min(filtros.pagina, totalPaginas)}
            totalPaginas={totalPaginas}
            urlDe={(p) => urlPedidos(filtros, { pagina: p })}
          />
        </>
      )}
    </div>
  );
}

/** Bloque rojo con los pedidos cuya fecha ya pasó y siguen abiertos: hay que entregarlos o reprogramarlos. */
function PedidosAtrasados({ pedidos }: { pedidos: FilaPedido[] }) {
  return (
    <section aria-labelledby="atrasados" className="rounded-xl border border-destructive bg-destructive/5">
      <h2 id="atrasados" className="border-b border-destructive/30 px-4 py-3 text-base font-bold text-destructive">
        Atrasados ({pedidos.length}): su fecha ya pasó y siguen abiertos
      </h2>
      <ul className="divide-y divide-destructive/20">
        {pedidos.map((p) => (
          <li key={p.id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[8rem_1fr_auto_auto] sm:items-center sm:gap-4">
            <Link href={`/admin/pedidos/${p.id}`} className="font-semibold text-ev-azul hover:underline">
              {p.numero}
            </Link>
            <span>
              <b>{p.cliente_nombre}</b>
              <span className="block text-xs text-muted-foreground">
                Era para el {formatFechaDia(p.fecha_entrega_estimada)} · {p.recoge_en_bodega ? "Recoge en bodega" : textoZona(p)}
              </span>
            </span>
            <span className="tabular-nums">{formatCOP(p.total ?? 0)}</span>
            {p.estado && esEstadoPedido(p.estado) ? <InsigniaEstado estado={p.estado} /> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Pedidos de un día de reparto agrupados por sector, para alistarlos (HU-04). */
function VistaRuta({ pedidos }: { pedidos: FilaPedido[] }) {
  const grupos = agruparPorSector(
    pedidos.map((p) => ({ ...p, sector_nombre: p.recoge_en_bodega ? null : p.sector_nombre })),
  );
  const unidades = pedidos.reduce((s, p) => s + (p.n_unidades ?? 0), 0);
  const dinero = pedidos.reduce((s, p) => s + (p.total ?? 0), 0);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-4">
        <p className="text-sm">
          <b>{pedidos.length}</b> {pedidos.length === 1 ? "pedido" : "pedidos"} · <b>{unidades}</b> unidades ·{" "}
          <b>{formatCOP(dinero)}</b> por cobrar
        </p>
        <BotonImprimir texto="Imprimir la ruta" />
      </div>

      {grupos.map((g) => (
        <section key={g.titulo} aria-labelledby={`g-${g.titulo}`} className="rounded-xl border bg-background">
          <h2 id={`g-${g.titulo}`} className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 text-base font-bold">
            <span>{g.titulo}</span>
            <span className="text-sm font-normal text-muted-foreground">
              {g.pedidos.length} {g.pedidos.length === 1 ? "pedido" : "pedidos"} ·{" "}
              {g.pedidos.reduce((s, p) => s + (p.n_unidades ?? 0), 0)} unidades
            </span>
          </h2>
          <ul className="divide-y">
            {g.pedidos.map((p) => (
              <li key={p.id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[8rem_1fr_auto_auto] sm:items-center sm:gap-4">
                <Link href={`/admin/pedidos/${p.id}`} className="font-semibold text-ev-azul hover:underline">
                  {p.numero}
                </Link>
                <span>
                  <b>{p.cliente_nombre}</b>
                  {p.nombre_negocio ? ` · ${p.nombre_negocio}` : ""}
                  <span className="block text-xs text-muted-foreground">
                    {[p.celular, p.direccion_entrega ?? textoZona(p)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="tabular-nums">{formatCOP(p.total ?? 0)}</span>
                {p.estado && esEstadoPedido(p.estado) ? <InsigniaEstado estado={p.estado} /> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
