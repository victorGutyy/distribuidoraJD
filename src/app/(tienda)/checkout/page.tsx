import type { Metadata } from "next";
import { FormularioCheckout } from "@/components/tienda/checkout/FormularioCheckout";
import { ResumenCheckout } from "@/components/tienda/checkout/ResumenCheckout";

export const metadata: Metadata = {
  title: "Finalizar pedido",
  robots: { index: false },
};

export default function PaginaCheckout() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Finalizar pedido</h1>
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="order-2 lg:order-1">
          <FormularioCheckout />
        </div>
        <div className="order-1 lg:sticky lg:top-24 lg:order-2">
          <ResumenCheckout />
        </div>
      </div>
    </main>
  );
}
