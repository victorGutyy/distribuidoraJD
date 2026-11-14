import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FormularioProducto } from "@/components/admin/FormularioProducto";
import { requerirRol } from "@/lib/auth";
import { opcionesCategoria } from "@/lib/catalogo/categorias";
import { productoVacio } from "@/lib/catalogo/producto-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nuevo producto" };

export default function PaginaNuevoProducto() {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}
    >
      <ContenidoNuevoProducto />
    </Suspense>
  );
}

async function ContenidoNuevoProducto() {
  // Solo admin y editor crean productos; el vendedor vuelve al inicio del panel.
  await requerirRol(["admin", "editor"]);

  const supabase = await createClient();
  const [{ data: categorias }, { data: marcas }] = await Promise.all([
    supabase.from("categorias").select("id, nombre, parent_id, orden"),
    supabase
      .from("marcas")
      .select("id, nombre")
      .eq("activa", true)
      .order("nombre"),
  ]);
  const opciones = opcionesCategoria(categorias ?? []);

  return (
    <div className="mx-auto grid max-w-4xl gap-5">
      <header>
        <Link
          href="/admin/productos"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          ← Volver a productos
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Nuevo producto
        </h1>
      </header>

      {opciones.length === 0 ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          Primero crea al menos una categoría en{" "}
          <Link href="/admin/categorias" className="underline">
            Categorías
          </Link>
          .
        </p>
      ) : (
        <FormularioProducto
          valoresIniciales={productoVacio()}
          categorias={opciones}
          marcas={marcas ?? []}
        />
      )}
    </div>
  );
}
