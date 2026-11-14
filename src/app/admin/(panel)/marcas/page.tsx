import type { Metadata } from "next";
import { Suspense } from "react";
import { AvisoPagina } from "@/components/admin/AvisoPagina";
import { FilaMarca } from "@/components/admin/FilaMarca";
import { FormularioMarca } from "@/components/admin/FormularioMarca";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requerirSeccion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Marcas" };

type Params = PageProps<"/admin/marcas">["searchParams"];

export default function PaginaMarcas({
  searchParams,
}: PageProps<"/admin/marcas">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}
    >
      <ContenidoMarcas searchParams={searchParams} />
    </Suspense>
  );
}

async function ContenidoMarcas({ searchParams }: { searchParams: Params }) {
  await requerirSeccion("marcas");
  const params = await searchParams;
  const ok = typeof params.ok === "string" ? params.ok : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  const editarId =
    typeof params.editar === "string" ? Number(params.editar) : undefined;

  const supabase = await createClient();
  const { data, error: errorLectura } = await supabase
    .from("marcas")
    .select("id, nombre, slug, activa")
    .order("nombre");

  const marcas = data ?? [];
  const enEdicion = marcas.find((m) => m.id === editarId);

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Marcas</h1>
        <p className="text-muted-foreground">
          Los productos pueden pertenecer a una marca; los clientes la usan para
          filtrar.
        </p>
      </header>

      <AvisoPagina ok={ok} error={error} />
      {errorLectura ? <AvisoPagina error="generico" /> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[22rem_1fr]">
        <FormularioMarca key={enEdicion?.id ?? "nueva"} marca={enEdicion} />

        <Card>
          <CardHeader>
            <CardTitle>Lista de marcas ({marcas.length})</CardTitle>
            <CardDescription>Ordenadas de la A a la Z.</CardDescription>
          </CardHeader>
          <CardContent>
            {marcas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay marcas. Crea la primera con el formulario.
              </p>
            ) : (
              <ul className="grid gap-2">
                {marcas.map((marca) => (
                  <li key={marca.id}>
                    <FilaMarca marca={marca} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
