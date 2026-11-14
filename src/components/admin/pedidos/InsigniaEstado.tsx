import { Badge } from "@/components/ui/badge";
import { ETIQUETA_ESTADO, type EstadoPedido } from "@/lib/pedidos";
import { cn } from "@/lib/utils";

const CLASES: Record<EstadoPedido, string> = {
  nuevo: "bg-ev-azul text-white",
  confirmado: "bg-ev-dorado text-ev-negro",
  en_preparacion: "bg-ev-dorado/60 text-ev-negro",
  despachado: "bg-ev-negro text-white",
  entregado: "bg-emerald-700 text-white",
  cancelado: "bg-muted text-muted-foreground line-through",
};

/** Etiqueta de color del estado de un pedido. */
export function InsigniaEstado({ estado }: { estado: EstadoPedido }) {
  return <Badge className={cn("h-6 px-2.5", CLASES[estado])}>{ETIQUETA_ESTADO[estado]}</Badge>;
}
