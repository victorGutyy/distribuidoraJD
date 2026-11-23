import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { calcularGanancia, formatPorcentaje } from "@/lib/costos";
import { formatCOP } from "@/lib/formato";
import { cn } from "@/lib/utils";

type Props = {
  ventaItems: number;
  costoItems: number;
  gananciaItems: number;
  itemsSinCosto: number;
  cancelado: boolean;
};

/**
 * Ganancia de un pedido (RF-32, solo admin y editor). Usa el costo que tenía cada producto
 * al hacerse el pedido (RN-15), mide solo los productos (sin el envío) y avisa si alguna
 * línea no tenía costo y por eso la cifra es parcial.
 */
export function GananciaPedido({ ventaItems, costoItems, gananciaItems, itemsSinCosto, cancelado }: Props) {
  // El margen se calcula sobre las líneas que SÍ tienen costo (si no, saldría engañoso).
  const g = calcularGanancia(gananciaItems + costoItems, costoItems);
  const hayCosto = costoItems > 0 || gananciaItems !== 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ganancia</CardTitle>
        <CardDescription>Solo la ve la administración.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {hayCosto ? (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
            <dt>Venta de productos</dt>
            <dd className="text-right tabular-nums">{formatCOP(ventaItems)}</dd>
            <dt>Costo</dt>
            <dd className="text-right tabular-nums">{formatCOP(costoItems)}</dd>
            <dt className="pt-1 text-base font-bold">Ganancia</dt>
            <dd
              className={cn(
                "pt-1 text-right text-base font-bold tabular-nums",
                gananciaItems < 0 && "text-destructive",
              )}
            >
              {formatCOP(gananciaItems)}
              {g ? <span className="block text-xs font-medium">{formatPorcentaje(g.margenPct)}</span> : null}
            </dd>
          </dl>
        ) : (
          <p className="text-muted-foreground">
            Ningún producto de este pedido tenía costo cargado cuando se hizo.
          </p>
        )}
        {itemsSinCosto > 0 && hayCosto ? (
          <p className="rounded-lg bg-ev-dorado/15 px-3 py-2 text-xs">
            {itemsSinCosto} {itemsSinCosto === 1 ? "producto no tenía" : "productos no tenían"} costo: la
            ganancia es parcial.
          </p>
        ) : null}
        {cancelado ? (
          <p className="text-xs text-muted-foreground">Pedido cancelado: esta ganancia no se concreta.</p>
        ) : null}
        <p className="text-xs text-muted-foreground">No incluye el envío.</p>
      </CardContent>
    </Card>
  );
}
