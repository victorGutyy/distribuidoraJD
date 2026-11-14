import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SubidorFotosLote } from "@/components/admin/importar/SubidorFotosLote";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requerirSeccion } from "@/lib/auth";

export const metadata: Metadata = { title: "Fotos en lote" };

export default function PaginaFotosLote() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
      <ContenidoFotos />
    </Suspense>
  );
}

async function ContenidoFotos() {
  await requerirSeccion("importar");
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <header>
        <p className="text-sm text-muted-foreground">
          <Link href="/admin/importar" className="hover:underline">
            Importar
          </Link>{" "}
          › Fotos en lote
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Fotos en lote</h1>
        <p className="text-muted-foreground">
          Sube muchas fotos de una vez: cada una se asigna al producto por el SKU que lleva en el nombre del archivo.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Cómo nombrar las fotos</CardTitle>
          <CardDescription>El nombre del archivo es el SKU del producto.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm">
          <p>
            <code className="rounded bg-muted px-1">EVC-00001.jpg</code> → la foto principal del producto EVC-00001.
          </p>
          <p>
            <code className="rounded bg-muted px-1">EVC-00001_2.jpg</code> → su segunda foto (la galería), hasta 10.
          </p>
          <p className="text-muted-foreground">
            Sirven JPG, PNG o WebP. Las fotos se optimizan solas (WebP, máximo 1200 px) y los productos que ya tienen foto
            se saltan, así que puedes repetir la subida sin duplicar nada.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subir</CardTitle>
          <CardDescription>Elige las fotos o una carpeta completa.</CardDescription>
        </CardHeader>
        <CardContent>
          <SubidorFotosLote />
        </CardContent>
      </Card>
    </div>
  );
}
