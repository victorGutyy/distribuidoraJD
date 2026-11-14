import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ConfirmacionPedido } from "@/components/tienda/checkout/ConfirmacionPedido";

export const metadata: Metadata = {
  title: "Pedido recibido",
  robots: { index: false, follow: false },
};

export default function PaginaPedido({ params }: PageProps<"/pedido/[numero]">) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <Suspense fallback={<p className="text-center text-muted-foreground">Cargando tu pedido…</p>}>
        <Contenido params={params} />
      </Suspense>
    </main>
  );
}

async function Contenido({ params }: { params: PageProps<"/pedido/[numero]">["params"] }) {
  const { numero } = await params;
  // Solo se aceptan números con la forma EV-000123.
  if (!/^EV-\d{6}$/.test(numero)) notFound();
  return <ConfirmacionPedido numero={numero} />;
}
