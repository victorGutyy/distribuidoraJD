import type { Metadata } from "next";
import { ContenidoCarrito } from "@/components/tienda/carrito/ContenidoCarrito";

export const metadata: Metadata = {
  title: "Tu carrito",
  robots: { index: false },
};

export default function PaginaCarrito() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Tu carrito</h1>
      <ContenidoCarrito />
    </main>
  );
}
