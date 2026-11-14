import Link from "next/link";

/** Se muestra cuando un producto no existe o todavía no está a la venta (RN-01). */
export default function NoEncontrado() {
  return (
    <main className="mx-auto grid w-full max-w-xl flex-1 content-center justify-items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight">No encontramos esta página</h1>
      <p className="text-muted-foreground">
        El producto ya no está disponible o el enlace cambió. Mira todo lo que tenemos en el catálogo.
      </p>
      <Link
        href="/catalogo"
        className="inline-flex h-11 items-center rounded-lg bg-ev-azul px-6 text-sm font-semibold text-white"
      >
        Ver el catálogo
      </Link>
    </main>
  );
}
