import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { duplicarProducto } from "@/app/admin/(panel)/productos/actions";
import { AvisoPagina } from "@/components/admin/AvisoPagina";
import { FormularioProducto } from "@/components/admin/FormularioProducto";
import { GaleriaImagenes } from "@/components/admin/GaleriaImagenes";
import { SubidorImagenes } from "@/components/admin/SubidorImagenes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requerirRol } from "@/lib/auth";
import { opcionesCategoria } from "@/lib/catalogo/categorias";
import { valoresDesdeBD } from "@/lib/catalogo/producto-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Editar producto" };

export default function PaginaEditarProducto({
  params,
  searchParams,
}: PageProps<"/admin/productos/[id]">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}
    >
      <ContenidoEditar params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ContenidoEditar({
  params,
  searchParams,
}: {
  params: PageProps<"/admin/productos/[id]">["params"];
  searchParams: PageProps<"/admin/productos/[id]">["searchParams"];
}) {
  await requerirRol(["admin", "editor"]);

  const { id: idTexto } = await params;
  if (!/^\d+$/.test(idTexto)) notFound();
  const id = Number(idTexto);
  const query = await searchParams;
  const ok = typeof query.ok === "string" ? query.ok : undefined;
  const error = typeof query.error === "string" ? query.error : undefined;

  const supabase = await createClient();
  const [
    { data: producto },
    { data: variantes },
    { data: estado },
    { data: categorias },
    { data: marcas },
    { data: imagenes },
  ] = await Promise.all([
    supabase.from("productos").select("*").eq("id", id).maybeSingle(),
    supabase.from("variantes").select("*").eq("producto_id", id),
    supabase
      .from("v_productos_admin")
      .select("estado, visible_en_tienda, n_con_precio")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("categorias").select("id, nombre, parent_id, orden"),
    // Se incluyen también las marcas inactivas si el producto ya usa una.
    supabase.from("marcas").select("id, nombre, activa").order("nombre"),
    supabase
      .from("producto_imagenes")
      .select("id, url, url_miniatura, es_principal")
      .eq("producto_id", id)
      .order("orden")
      .order("id"),
  ]);
  if (!producto) notFound();

  const marcasVisibles = (marcas ?? []).filter(
    (m) => m.activa || m.id === producto.marca_id,
  );

  // Por qué se ve (o no) en la tienda, en lenguaje claro (RN-01).
  const visible = estado?.visible_en_tienda ?? false;
  const motivoOculto = !producto.activo
    ? "Está inactivo."
    : (estado?.n_con_precio ?? 0) === 0
      ? "Ninguna presentación activa tiene precio: está en borrador."
      : "Su categoría (o la categoría principal) está inactiva.";

  return (
    <div className="mx-auto grid max-w-4xl gap-5">
      <header className="grid gap-2">
        <Link
          href="/admin/productos"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          ← Volver a productos
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {producto.nombre}
            </h1>
            <p className="text-xs text-muted-foreground">/{producto.slug}</p>
          </div>
          <form action={duplicarProducto}>
            <input type="hidden" name="id" value={producto.id} />
            <Button type="submit" variant="outline" className="h-11">
              Duplicar producto
            </Button>
          </form>
        </div>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={visible ? "default" : "secondary"}>
            {visible ? "Visible en la tienda" : "No se ve en la tienda"}
          </Badge>
          {!visible ? (
            <span className="text-muted-foreground">{motivoOculto}</span>
          ) : null}
        </p>
      </header>

      <AvisoPagina ok={ok} error={error} />

      <FormularioProducto
        // Al volver de guardar, el formulario se reinicia con los datos nuevos.
        key={`${producto.id}-${producto.updated_at}`}
        valoresIniciales={valoresDesdeBD(producto, variantes ?? [])}
        categorias={opcionesCategoria(categorias ?? [])}
        marcas={marcasVisibles}
      />

      <Card id="imagenes" className="scroll-mt-4">
        <CardHeader>
          <CardTitle>Imágenes ({(imagenes ?? []).length})</CardTitle>
          <CardDescription>
            Las imágenes se guardan al instante; los datos del producto, al
            pulsar «Guardar cambios». La principal es la que se ve en la lista y
            en la tarjeta de la tienda.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <SubidorImagenes
            productoId={producto.id}
            cantidadActual={(imagenes ?? []).length}
          />
          <GaleriaImagenes
            productoId={producto.id}
            nombreProducto={producto.nombre}
            imagenes={imagenes ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
