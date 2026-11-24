import Link from "next/link";

/** Registro del panel que no existe (producto, pedido, etc. borrado o con enlace equivocado). */
export default function NoEncontradoPanel() {
  return (
    <main className="mx-auto grid w-full max-w-xl content-center justify-items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight">No encontramos lo que buscas</h1>
      <p className="text-muted-foreground">El registro no existe o el enlace cambió.</p>
      <Link
        href="/admin"
        className="inline-flex h-11 items-center rounded-lg bg-ev-azul px-6 text-sm font-semibold text-white"
      >
        Volver al panel
      </Link>
    </main>
  );
}
