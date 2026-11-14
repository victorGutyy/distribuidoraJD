import type { Metadata } from "next";
import { Suspense } from "react";
import { AvisoPagina } from "@/components/admin/AvisoPagina";
import { FilaCategoria } from "@/components/admin/FilaCategoria";
import { FormularioCategoria } from "@/components/admin/FormularioCategoria";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requerirSeccion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Categorías" };

type Params = PageProps<"/admin/categorias">["searchParams"];

export default function PaginaCategorias({
  searchParams,
}: PageProps<"/admin/categorias">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}
    >
      <ContenidoCategorias searchParams={searchParams} />
    </Suspense>
  );
}

async function ContenidoCategorias({ searchParams }: { searchParams: Params }) {
  await requerirSeccion("categorias");
  const params = await searchParams;
  const ok = typeof params.ok === "string" ? params.ok : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  const editarId =
    typeof params.editar === "string" ? Number(params.editar) : undefined;

  const supabase = await createClient();
  const { data: todas, error: errorLectura } = await supabase
    .from("categorias")
    .select("id, nombre, slug, parent_id, activa, orden")
    .order("orden")
    .order("nombre");

  const categorias = todas ?? [];
  const principales = categorias.filter((c) => c.parent_id === null);
  const hijasDe = (id: number) => categorias.filter((c) => c.parent_id === id);
  const enEdicion = categorias.find((c) => c.id === editarId);

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Categorías</h1>
        <p className="text-muted-foreground">
          Organizan el catálogo en dos niveles: categoría y subcategoría.
        </p>
      </header>

      <AvisoPagina ok={ok} error={error} />
      {errorLectura ? <AvisoPagina error="generico" /> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[22rem_1fr]">
        <FormularioCategoria
          key={enEdicion?.id ?? "nueva"}
          categoria={enEdicion}
          principales={principales}
          tieneHijas={enEdicion ? hijasDe(enEdicion.id).length > 0 : false}
        />

        <Card>
          <CardHeader>
            <CardTitle>Lista de categorías</CardTitle>
            <CardDescription>
              Usa ↑ ↓ para cambiar el orden dentro de cada nivel. Desactivar una
              categoría principal oculta también sus subcategorías.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {principales.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay categorías. Crea la primera con el formulario.
              </p>
            ) : (
              <ul className="grid gap-3">
                {principales.map((cat, i) => {
                  const hijas = hijasDe(cat.id);
                  return (
                    <li key={cat.id} className="grid gap-2">
                      <FilaCategoria
                        categoria={cat}
                        esPrimera={i === 0}
                        esUltima={i === principales.length - 1}
                        tieneHijas={hijas.length > 0}
                      />
                      {hijas.map((hija, j) => (
                        <FilaCategoria
                          key={hija.id}
                          categoria={hija}
                          esPrimera={j === 0}
                          esUltima={j === hijas.length - 1}
                          anidada
                        />
                      ))}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
