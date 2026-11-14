import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BotonImprimir } from "@/components/admin/pedidos/BotonImprimir";
import { textoZona } from "@/components/admin/pedidos/TablaPedidos";
import { requerirSeccion } from "@/lib/auth";
import { formatFechaDia, formatFechaHora } from "@/lib/formato";
import { ETIQUETA_ESTADO, esEstadoPedido } from "@/lib/pedidos";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Orden de alistamiento" };

type Props = PageProps<"/admin/imprimir/[id]">;

export default function PaginaImprimir({ params }: Props) {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

/**
 * Orden de alistamiento para el bodeguero (RF-27, deseable): cantidades y casillas para
 * marcar, sin precios. Está fuera del menú del panel a propósito, para que al imprimir
 * (o guardar como PDF) solo salga la hoja.
 */
async function Contenido({ params }: { params: Props["params"] }) {
  await requerirSeccion("pedidos");
  const { id: idTexto } = await params;
  if (!/^\d{1,9}$/.test(idTexto)) notFound();
  const id = Number(idTexto);

  const supabase = await createClient();
  const [{ data: p }, { data: items }] = await Promise.all([
    supabase.from("v_pedidos_admin").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("pedido_items")
      .select("id, sku, nombre_producto, presentacion, cantidad")
      .eq("pedido_id", id)
      .order("nombre_producto"),
  ]);
  if (!p || !p.estado || !esEstadoPedido(p.estado)) notFound();
  const unidades = (items ?? []).reduce((s, i) => s + i.cantidad, 0);

  return (
    <main className="mx-auto max-w-3xl bg-white p-6 text-black">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Orden de alistamiento {p.numero}</h1>
          <p className="text-sm">
            Estado: {ETIQUETA_ESTADO[p.estado]} · Hecho el {formatFechaHora(p.created_at)}
          </p>
        </div>
        <BotonImprimir />
      </div>

      <section className="mb-4 grid gap-1 rounded border border-black p-3 text-sm">
        <p>
          <b>Entrega:</b> {formatFechaDia(p.fecha_entrega_estimada)} · {textoZona(p as never)}
        </p>
        <p>
          <b>Cliente:</b> {p.cliente_nombre}
          {p.nombre_negocio ? ` · ${p.nombre_negocio}` : ""} · {p.celular}
        </p>
        {p.direccion_entrega ? (
          <p>
            <b>Dirección:</b> {p.direccion_entrega}
          </p>
        ) : null}
        {p.notas ? (
          <p>
            <b>Notas:</b> {p.notas}
          </p>
        ) : null}
      </section>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="w-10 py-2">✔</th>
            <th className="py-2">Producto</th>
            <th className="py-2">SKU</th>
            <th className="py-2 text-right">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {(items ?? []).map((i) => (
            <tr key={i.id} className="border-b border-black/40">
              <td className="py-2">
                <span className="inline-block size-5 border-2 border-black align-middle" aria-hidden="true" />
              </td>
              <td className="py-2">
                <b>{i.nombre_producto}</b>
                {i.presentacion ? ` · ${i.presentacion}` : ""}
              </td>
              <td className="py-2 text-xs">{i.sku}</td>
              <td className="py-2 text-right text-lg font-bold tabular-nums">{i.cantidad}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-right text-sm">
        {items?.length ?? 0} productos · <b>{unidades}</b> unidades
      </p>
    </main>
  );
}
