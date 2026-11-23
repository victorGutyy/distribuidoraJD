import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { InsigniaEstado } from "@/components/admin/pedidos/InsigniaEstado";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requerirSeccion } from "@/lib/auth";
import { formatPorcentaje, calcularGanancia } from "@/lib/costos";
import { ahoraEnBogota } from "@/lib/entregas";
import { formatCOP, formatFechaHora } from "@/lib/formato";
import { inicioDelMes, leerResumenCostos } from "@/lib/inventario";
import { ESTADOS_PENDIENTES, esEstadoPedido } from "@/lib/pedidos";
import { ETIQUETA_ROL, SECCIONES, menuParaRol, puedeVer } from "@/lib/permisos";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Inicio" };

export default function PaginaInicio({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
      <ContenidoInicio searchParams={searchParams} />
    </Suspense>
  );
}

function Tarjeta({
  titulo,
  valor,
  ayuda,
  href,
  destacada = false,
}: {
  titulo: string;
  valor: number | string | null;
  ayuda: string;
  href: string;
  destacada?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "grid gap-1 rounded-xl border bg-background p-4 transition-colors hover:border-ev-azul hover:bg-ev-azul/5",
        destacada && valor ? "border-ev-dorado bg-ev-dorado/10" : "",
      )}
    >
      <span className="text-sm text-muted-foreground">{titulo}</span>
      <span className="text-3xl font-bold tabular-nums">{valor ?? "—"}</span>
      <span className="text-xs text-muted-foreground">{ayuda}</span>
    </Link>
  );
}

/**
 * Inicio del panel (RF-21): pedidos nuevos de hoy, pendientes, productos sin precio y
 * sin imagen, y los últimos 10 pedidos. Cada rol ve lo suyo: el vendedor solo cuenta los
 * pedidos de sus sectores (lo decide RLS) y no ve las tarjetas del catálogo.
 */
async function ContenidoInicio({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const perfil = await requerirSeccion("dashboard");
  const params = await searchParams;
  const sinPermiso = params.motivo === "permiso";
  const supabase = await createClient();

  const hoy = ahoraEnBogota(new Date()).fecha;
  const veCatalogo = puedeVer(perfil.rol, "precios"); // admin y editor
  const veFiltros = puedeVer(perfil.rol, "pedidos");

  const contar = (r: { count: number | null; error: unknown }) => (r.error ? null : (r.count ?? 0));
  const [nuevosHoy, pendientes, sinPrecio, sinImagen, ultimos, costosBD] = await Promise.all([
    supabase
      .from("v_pedidos_admin")
      .select("id", { count: "exact", head: true })
      .gte("created_at", `${hoy}T00:00:00-05:00`),
    supabase
      .from("v_pedidos_admin")
      .select("id", { count: "exact", head: true })
      .in("estado", [...ESTADOS_PENDIENTES]),
    veCatalogo
      ? supabase.from("v_productos_admin").select("id", { count: "exact", head: true }).eq("estado", "borrador")
      : Promise.resolve({ count: null, error: null }),
    veCatalogo
      ? supabase.from("v_productos_admin").select("id", { count: "exact", head: true }).eq("tiene_imagen", false)
      : Promise.resolve({ count: null, error: null }),
    supabase
      .from("v_pedidos_admin")
      .select("id, numero, created_at, cliente_nombre, total, estado")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(10),
    // Ganancia del mes y valor del inventario (RF-32): privados, solo admin y editor.
    veCatalogo
      ? supabase.rpc("resumen_costos", { p_desde: inicioDelMes(hoy) })
      : Promise.resolve({ data: null, error: null }),
  ]);
  const costos = veCatalogo && !costosBD.error ? leerResumenCostos(costosBD.data) : null;
  const margenMes = costos
    ? calcularGanancia(costos.pedidos.ventaConCosto, costos.pedidos.ventaConCosto - costos.pedidos.ganancia)
    : null;

  const pendientesDeConstruir = menuParaRol(perfil.rol).filter((i) => !i.disponible);

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hola, {perfil.nombre}</h1>
        <p className="text-muted-foreground">
          Entraste como <strong>{ETIQUETA_ROL[perfil.rol]}</strong>.
        </p>
      </div>

      {sinPermiso ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          No tienes permiso para entrar a esa sección.
        </p>
      ) : null}

      <section aria-label="Resumen" className={cn("grid gap-3 sm:grid-cols-2", veCatalogo ? "lg:grid-cols-4" : "lg:grid-cols-2")}>
        <Tarjeta
          titulo="Pedidos nuevos de hoy"
          valor={contar(nuevosHoy)}
          ayuda="Hechos desde las 12 de la noche"
          href={`/admin/pedidos?desde=${hoy}&hasta=${hoy}`}
          destacada
        />
        <Tarjeta
          titulo="Pedidos pendientes"
          valor={contar(pendientes)}
          ayuda="Nuevos, confirmados o en preparación"
          href="/admin/pedidos?estado=nuevo"
        />
        {veCatalogo ? (
          <>
            <Tarjeta
              titulo="Productos sin precio"
              valor={contar(sinPrecio)}
              ayuda="No se ven en la tienda"
              href="/admin/precios?sin_precio=1"
            />
            <Tarjeta
              titulo="Productos sin imagen"
              valor={contar(sinImagen)}
              ayuda="Se muestran con el logo"
              href="/admin/productos?sin_imagen=1"
            />
          </>
        ) : null}
      </section>

      {costos ? (
        <section aria-label="Ganancia e inventario" className="grid gap-3 sm:grid-cols-2">
          <Tarjeta
            titulo="Ganancia del mes"
            valor={formatCOP(costos.pedidos.ganancia)}
            ayuda={
              `${costos.pedidos.cantidad} ${costos.pedidos.cantidad === 1 ? "pedido" : "pedidos"}` +
              (margenMes ? ` · margen ${formatPorcentaje(margenMes.margenPct)}` : "") +
              (costos.pedidos.lineasSinCosto > 0 ? ` · ${costos.pedidos.lineasSinCosto} líneas sin costo` : "") +
              " · sin envíos ni cancelados"
            }
            href="/admin/pedidos"
          />
          <Tarjeta
            titulo="Valor del inventario"
            valor={formatCOP(costos.inventario.valor)}
            ayuda={`${costos.inventario.sinStock} sin stock · ${costos.inventario.negativos} negativos`}
            href="/admin/inventario"
          />
        </section>
      ) : null}

      {veFiltros ? (
        <Card>
          <CardHeader className="flex-row items-end justify-between gap-3">
            <div>
              <CardTitle>Últimos pedidos</CardTitle>
              <CardDescription>Los 10 más recientes.</CardDescription>
            </div>
            <Link href="/admin/pedidos" className="text-sm font-medium text-ev-azul hover:underline">
              Ver todos
            </Link>
          </CardHeader>
          <CardContent>
            {!ultimos.data || ultimos.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay pedidos.</p>
            ) : (
              <ul className="divide-y">
                {ultimos.data.map((p) => (
                  <li key={p.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[8rem_1fr_auto_auto] sm:items-center sm:gap-4">
                    <Link href={`/admin/pedidos/${p.id}`} className="font-semibold text-ev-azul hover:underline">
                      {p.numero}
                    </Link>
                    <span>
                      {p.cliente_nombre ?? "—"}
                      <span className="block text-xs text-muted-foreground">{formatFechaHora(p.created_at)}</span>
                    </span>
                    <span className="tabular-nums">{formatCOP(p.total ?? 0)}</span>
                    {p.estado && esEstadoPedido(p.estado) ? <InsigniaEstado estado={p.estado} /> : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {pendientesDeConstruir.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Próximamente</CardTitle>
            <CardDescription>Estas secciones se activarán en las próximas fases.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm">
              {pendientesDeConstruir.map((item) => (
                <li key={item.seccion} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="font-medium">{item.etiqueta}</span>
                  <span className="text-muted-foreground">Fase {SECCIONES[item.seccion].fase}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
