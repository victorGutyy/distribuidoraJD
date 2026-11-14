import Link from "next/link";
import { InsigniaEstado } from "@/components/admin/pedidos/InsigniaEstado";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCOP, formatFechaDia, formatFechaHora } from "@/lib/formato";
import { esEstadoPedido } from "@/lib/pedidos";
import type { Tables } from "@/types/database.types";

export type FilaPedido = Tables<"v_pedidos_admin">;

/** Zona de entrega en una línea: "Calarcá – Centro" o "Recoge en bodega". */
export function textoZona(p: Pick<FilaPedido, "sector_nombre" | "municipio_nombre" | "recoge_en_bodega">): string {
  if (p.recoge_en_bodega || !p.sector_nombre) return "Recoge en bodega";
  return `${p.municipio_nombre ?? ""} – ${p.sector_nombre}`.replace(/^ – /, "");
}

/** Tabla de pedidos (RF-27): número, fecha, cliente, zona, entrega, total y estado. */
export function TablaPedidos({ pedidos }: { pedidos: FilaPedido[] }) {
  return (
    <div className="rounded-xl border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pedido</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Zona</TableHead>
            <TableHead>Entrega</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pedidos.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <Link href={`/admin/pedidos/${p.id}`} className="font-semibold text-ev-azul hover:underline">
                  {p.numero}
                </Link>
                <div className="text-xs text-muted-foreground">{formatFechaHora(p.created_at)}</div>
              </TableCell>
              <TableCell className="whitespace-normal">
                <div className="font-medium">{p.cliente_nombre ?? "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {[p.nombre_negocio, p.celular].filter(Boolean).join(" · ")}
                </div>
              </TableCell>
              <TableCell className="whitespace-normal text-sm">{textoZona(p as never)}</TableCell>
              <TableCell className="text-sm">{formatFechaDia(p.fecha_entrega_estimada)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatCOP(p.total ?? 0)}</TableCell>
              <TableCell>{p.estado && esEstadoPedido(p.estado) ? <InsigniaEstado estado={p.estado} /> : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
