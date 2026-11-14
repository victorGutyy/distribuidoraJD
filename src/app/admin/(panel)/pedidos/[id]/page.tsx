import { MessageCircle, Printer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccionesPedido } from "@/components/admin/pedidos/AccionesPedido";
import { EditorItemsPedido } from "@/components/admin/pedidos/EditorItemsPedido";
import { InsigniaEstado } from "@/components/admin/pedidos/InsigniaEstado";
import { textoZona } from "@/components/admin/pedidos/TablaPedidos";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requerirSeccion } from "@/lib/auth";
import { formatCOP, formatFechaDia, formatFechaHora } from "@/lib/formato";
import {
  celularParaWhatsApp,
  esEstadoPedido,
  ETIQUETA_ESTADO,
  puedeCambiarEstado,
  puedeEditarItems,
} from "@/lib/pedidos";
import { createClient } from "@/lib/supabase/server";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Detalle del pedido" };

type Props = PageProps<"/admin/pedidos/[id]">;

export default function PaginaPedido({ params }: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
      <ContenidoPedido params={params} />
    </Suspense>
  );
}

async function ContenidoPedido({ params }: { params: Props["params"] }) {
  const perfil = await requerirSeccion("pedidos");
  const { id: idTexto } = await params;
  if (!/^\d{1,9}$/.test(idTexto)) notFound();
  const id = Number(idTexto);

  const supabase = await createClient();
  const [{ data: p }, { data: items }, { data: historial }] = await Promise.all([
    supabase.from("v_pedidos_admin").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("pedido_items")
      .select("id, sku, nombre_producto, presentacion, cantidad, precio_unitario_aplicado, tipo_precio, subtotal")
      .eq("pedido_id", id)
      .order("id"),
    supabase
      .from("pedido_historial")
      .select("id, estado_anterior, estado_nuevo, nota, created_at, usuario_id")
      .eq("pedido_id", id)
      .order("id"),
  ]);
  if (!p || p.id === null || !p.estado || !esEstadoPedido(p.estado)) notFound();
  const estado = p.estado;

  const [{ data: cliente }, { data: perfiles }] = await Promise.all([
    p.cliente_id
      ? supabase.from("clientes").select("documento, referencia").eq("id", p.cliente_id).maybeSingle()
      : Promise.resolve({ data: null }),
    // Solo el admin puede leer los perfiles de otras personas (para mostrar quién hizo cada cambio).
    perfil.rol === "admin"
      ? supabase.from("perfiles").select("id, nombre")
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
  ]);
  const nombreDe = new Map((perfiles ?? []).map((x) => [x.id, x.nombre]));

  const puedeEstado = puedeCambiarEstado(perfil.rol, p.sector_id, perfil.sectoresAsignados);
  const puedeEditar = puedeEditarItems(perfil.rol, estado);
  const celular = p.celular ? celularParaWhatsApp(p.celular) : null;
  const mensajeWhatsApp = `Hola ${p.cliente_nombre ?? ""}, te escribimos de EV Distribuidora sobre tu pedido ${p.numero}.`;

  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <nav aria-label="Ruta de navegación" className="text-sm text-muted-foreground">
        <Link href="/admin/pedidos" className="hover:underline">
          Pedidos
        </Link>{" "}
        › {p.numero}
      </nav>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight">
            {p.numero} <InsigniaEstado estado={estado} />
          </h1>
          <p className="text-sm text-muted-foreground">Hecho el {formatFechaHora(p.created_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {celular ? (
            <a
              href={enlaceWhatsApp(celular, mensajeWhatsApp)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline" }), "h-11 gap-2 px-4")}
            >
              <MessageCircle aria-hidden="true" /> Escribir al cliente
            </a>
          ) : null}
          <Link href={`/admin/imprimir/${id}`} target="_blank" className={cn(buttonVariants({ variant: "outline" }), "h-11 gap-2 px-4")}>
            <Printer aria-hidden="true" /> Orden de alistamiento
          </Link>
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="grid gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Productos</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <EditorItemsPedido pedidoId={id} items={items ?? []} puedeEditar={puedeEditar} />
              <dl className="ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                <dt>Subtotal</dt>
                <dd className="text-right tabular-nums">{formatCOP(p.subtotal ?? 0)}</dd>
                {(p.descuento_mayor ?? 0) > 0 ? (
                  <>
                    <dt className="text-ev-azul">Ahorro por mayor</dt>
                    <dd className="text-right text-ev-azul tabular-nums">− {formatCOP(p.descuento_mayor ?? 0)}</dd>
                  </>
                ) : null}
                <dt>Envío</dt>
                <dd className="text-right tabular-nums">{(p.costo_envio ?? 0) > 0 ? formatCOP(p.costo_envio ?? 0) : "Sin costo"}</dd>
                <dt className="pt-1 text-base font-bold">Total contraentrega</dt>
                <dd className="pt-1 text-right text-base font-bold tabular-nums">{formatCOP(p.total ?? 0)}</dd>
              </dl>
            </CardContent>
          </Card>

          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Cliente</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-1 text-sm">
                <p className="font-semibold">{p.cliente_nombre ?? "—"}</p>
                {p.nombre_negocio ? <p>{p.nombre_negocio}</p> : null}
                <p>Celular: {p.celular ?? "—"}</p>
                {cliente?.documento ? <p>Cédula o NIT: {cliente.documento}</p> : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Entrega</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-1 text-sm">
                <p className="font-semibold">{formatFechaDia(p.fecha_entrega_estimada)}</p>
                <p>{textoZona(p as never)}</p>
                {p.direccion_entrega ? <p>{p.direccion_entrega}</p> : null}
                {cliente?.referencia ? <p className="text-muted-foreground">Referencia: {cliente.referencia}</p> : null}
              </CardContent>
            </Card>
          </div>

          {p.notas ? (
            <Card>
              <CardHeader>
                <CardTitle>Notas del cliente</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-line">{p.notas}</CardContent>
            </Card>
          ) : null}
        </div>

        <div className="grid gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Estado del pedido</CardTitle>
            </CardHeader>
            <CardContent>
              <AccionesPedido pedidoId={id} estado={estado} puede={puedeEstado} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historial</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="grid gap-3 text-sm">
                {(historial ?? []).map((h) => (
                  <li key={h.id} className="grid gap-0.5 border-l-2 border-ev-dorado pl-3">
                    <span className="font-medium">
                      {h.estado_anterior === h.estado_nuevo
                        ? "Edición del pedido"
                        : h.estado_anterior
                          ? `${ETIQUETA_ESTADO[h.estado_anterior]} → ${ETIQUETA_ESTADO[h.estado_nuevo]}`
                          : ETIQUETA_ESTADO[h.estado_nuevo]}
                    </span>
                    {h.nota ? <span>{h.nota}</span> : null}
                    <span className="text-xs text-muted-foreground">
                      {formatFechaHora(h.created_at)}
                      {h.usuario_id ? ` · ${nombreDe.get(h.usuario_id) ?? "Equipo EV"}` : " · Tienda"}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
