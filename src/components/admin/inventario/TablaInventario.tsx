import Link from "next/link";
import {
  estadoMargen,
  estadoStock,
  ETIQUETA_ESTADO_STOCK,
  formatPorcentaje,
  formatStock,
  type EstadoMargen,
  type EstadoStock,
} from "@/lib/costos";
import { formatCOP, formatFechaHora } from "@/lib/formato";
import type { Tables } from "@/types/database.types";
import { cn } from "@/lib/utils";

type Fila = Tables<"v_inventario_admin">;

const CLASE_STOCK: Record<EstadoStock, string> = {
  sin_dato: "bg-muted text-muted-foreground",
  negativo: "bg-destructive/10 text-destructive",
  agotado: "bg-destructive/10 text-destructive",
  bajo: "bg-ev-dorado/20 text-ev-dorado-oscuro",
  ok: "bg-ev-azul/10 text-ev-azul",
};

const CLASE_MARGEN: Record<EstadoMargen, string> = {
  sin_dato: "text-muted-foreground",
  perdida: "font-semibold text-destructive",
  bajo: "font-medium text-ev-dorado-oscuro",
  ok: "",
};

/** Existencias, costo, ganancia y valor de cada presentación (solo lectura). */
export function TablaInventario({ filas }: { filas: Fila[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-background">
      <table className="w-full min-w-[56rem] text-sm">
        <caption className="sr-only">Inventario por presentación</caption>
        <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Producto</th>
            <th scope="col" className="px-3 py-2 font-medium">Existencias</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Costo</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Precio</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Ganancia</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {filas.map((f) => {
            const estado = estadoStock(f.stock);
            const margen = estadoMargen(f.precio_unidad, f.costo);
            return (
              <tr key={f.variante_id} className={cn(f.activo === false && "opacity-60")}>
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/productos/${f.producto_id}`}
                    className="font-medium text-ev-azul hover:underline"
                  >
                    {f.producto_nombre}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {[f.presentacion, f.marca_nombre, f.sku].filter(Boolean).join(" · ")}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="min-w-12 tabular-nums">
                      {f.stock === null ? "—" : formatStock(f.stock)}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", CLASE_STOCK[estado])}>
                      {ETIQUETA_ESTADO_STOCK[estado]}
                    </span>
                  </span>
                  {f.stock_actualizado_at ? (
                    <span className="block text-xs text-muted-foreground">
                      Actualizado {formatFechaHora(f.stock_actualizado_at)}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {f.costo === null ? <span className="text-muted-foreground">Sin costo</span> : formatCOP(f.costo)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {f.precio_unidad === null ? <span className="text-muted-foreground">Sin precio</span> : formatCOP(f.precio_unidad)}
                </td>
                <td className={cn("px-3 py-2 text-right tabular-nums", CLASE_MARGEN[margen])}>
                  {f.ganancia_unitaria === null || f.margen_pct === null ? (
                    "—"
                  ) : (
                    <>
                      {formatCOP(f.ganancia_unitaria)}
                      <span className="block text-xs">
                        {formatPorcentaje(f.margen_pct)}
                        {margen === "perdida" ? " · bajo el costo" : ""}
                      </span>
                    </>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {f.valor_inventario === null ? "—" : formatCOP(f.valor_inventario)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
