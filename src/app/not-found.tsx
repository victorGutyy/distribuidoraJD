import Link from "next/link";

/** Cualquier dirección que no existe en el sitio (404 general). */
export default function NoEncontradoGeneral() {
  return (
    <main className="mx-auto grid w-full max-w-xl flex-1 content-center justify-items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight">No encontramos esta página</h1>
      <p className="text-muted-foreground">El enlace puede haber cambiado. Puedes volver al inicio o ver el catálogo.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/catalogo" className="inline-flex h-11 items-center rounded-lg bg-ev-azul px-6 text-sm font-semibold text-white">
          Ver el catálogo
        </Link>
        <Link href="/" className="inline-flex h-11 items-center rounded-lg border border-border px-6 text-sm font-semibold">
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
