import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Importador } from "@/components/admin/importar/Importador";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requerirSeccion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Importar" };

export default function PaginaImportar() {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}
    >
      <ContenidoImportar />
    </Suspense>
  );
}

const fechaHora = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

async function ContenidoImportar() {
  await requerirSeccion("importar");
  const supabase = await createClient();
  const { data: historial } = await supabase
    .from("importaciones")
    .select("id, tipo, archivo_nombre, filas_total, creadas, actualizadas, created_at")
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Importar</h1>
        <p className="text-muted-foreground">
          Sube el catálogo o los precios desde Excel o CSV. Siempre verás qué va a
          pasar antes de guardar.
        </p>
      </header>

      <Link
        href="/admin/importar/fotos"
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background p-4 hover:border-ev-azul hover:bg-ev-azul/5"
      >
        <span>
          <span className="block font-semibold">Fotos en lote</span>
          <span className="text-sm text-muted-foreground">Sube muchas fotos de una vez, asignadas a cada producto por su SKU.</span>
        </span>
        <span className="text-sm font-medium text-ev-azul">Abrir →</span>
      </Link>

      <Importador />

      <Card>
        <CardHeader>
          <CardTitle>Últimas importaciones</CardTitle>
          <CardDescription>Quedan registradas para consultarlas después.</CardDescription>
        </CardHeader>
        <CardContent>
          {!historial || historial.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay importaciones.</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {historial.map((h) => (
                <li key={h.id} className="flex flex-wrap justify-between gap-x-4 border-b pb-2 last:border-0">
                  <span>
                    <b>{h.tipo === "precios" ? "Precios" : "Catálogo"}</b> ·{" "}
                    {h.archivo_nombre ?? "sin nombre"}
                  </span>
                  <span className="text-muted-foreground">
                    {h.filas_total} filas · {h.creadas} creadas · {h.actualizadas}{" "}
                    actualizadas · {fechaHora.format(new Date(h.created_at))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
