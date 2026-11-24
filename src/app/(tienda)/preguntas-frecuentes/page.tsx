import type { Metadata } from "next";
import { PaginaInformativa } from "@/components/tienda/PaginaInformativa";
import { formatCOP } from "@/lib/formato";
import { obtenerConfigTienda } from "@/lib/tienda/datos";

export const metadata: Metadata = {
  title: "Preguntas frecuentes",
  alternates: { canonical: "/preguntas-frecuentes" },
};

export default async function PreguntasFrecuentes() {
  const config = await obtenerConfigTienda();
  const preguntas: { q: string; a: string }[] = [
    {
      q: "¿Cómo hago un pedido?",
      a: "Agrega los productos al carrito, ve a «Finalizar pedido», llena tus datos y elige tu municipio y sector. Al terminar se abre WhatsApp con tu pedido listo para enviarnos.",
    },
    {
      q: "¿Cómo se paga?",
      a: "Contraentrega: pagas cuando recibes tu pedido. No necesitas pagar nada en línea.",
    },
    {
      q: "¿Cuál es el pedido mínimo?",
      a:
        config.pedidoMinimo > 0
          ? `El pedido mínimo es de ${formatCOP(config.pedidoMinimo)}.`
          : "Por ahora no hay un pedido mínimo.",
    },
    {
      q: "¿Cuándo me llega mi pedido?",
      a: `Repartimos por rutas, según el municipio y el sector. Al elegir tu sector ves la fecha estimada de entrega. Los pedidos que haces antes de las ${config.horaCorte} del día anterior a tu ruta entran en esa fecha; los demás pasan a la siguiente.`,
    },
    {
      q: "¿Cómo funciona el precio por mayor?",
      a: "Algunos productos tienen un precio especial por mayor. El carrito te muestra el precio que aplica y cuánto te falta para alcanzarlo.",
    },
    {
      q: "¿Puedo cambiar o cancelar mi pedido?",
      a: "Sí, escríbenos por WhatsApp lo antes posible. Si el pedido aún no ha salido a reparto lo ajustamos sin problema.",
    },
    {
      q: "¿Qué pasa si falta un producto?",
      a: "Te avisamos antes de la entrega para ofrecerte otra presentación o retirarlo del pedido; solo pagas lo que recibes.",
    },
  ];
  return (
    <PaginaInformativa titulo="Preguntas frecuentes">
      {preguntas.map((p) => (
        <section key={p.q}>
          <h2 className="font-semibold">{p.q}</h2>
          <p className="mt-1 text-muted-foreground">{p.a}</p>
        </section>
      ))}
    </PaginaInformativa>
  );
}
