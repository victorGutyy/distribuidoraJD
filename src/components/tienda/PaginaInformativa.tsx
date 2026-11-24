import type { ReactNode } from "react";

/** Marco común de las páginas de texto (términos, política, preguntas, contacto). */
export function PaginaInformativa({
  titulo,
  provisional = false,
  children,
}: {
  titulo: string;
  /** Muestra el aviso de «texto pendiente de revisión legal». */
  provisional?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">{titulo}</h1>
      {provisional ? (
        <p className="mb-4 rounded-lg border border-ev-dorado bg-ev-dorado/10 p-3 text-sm">
          Texto provisional: pendiente de revisión legal antes de abrir la tienda al público.
        </p>
      ) : null}
      <div className="grid gap-4 text-sm leading-relaxed">{children}</div>
    </main>
  );
}
