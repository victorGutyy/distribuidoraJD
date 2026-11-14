import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GaleriaProducto } from "@/components/tienda/GaleriaProducto";
import { SelectorPresentacion } from "@/components/tienda/SelectorPresentacion";
import { TarjetaProducto } from "@/components/tienda/TarjetaProducto";
import { obtenerProducto } from "@/lib/tienda/consultas";
import {
  aPresentacion,
  descripcionMeta,
  jsonLdProducto,
  type PresentacionVista,
} from "@/lib/tienda/producto";

type Props = PageProps<"/producto/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const producto = await obtenerProducto(slug);
  if (!producto) return { title: "Producto no encontrado" };

  const descripcion = descripcionMeta(producto.nombre, producto.marca?.nombre ?? null, producto.descripcion);
  const imagen = producto.imagenes[0]?.url;
  return {
    title: producto.marca ? `${producto.nombre} · ${producto.marca.nombre}` : producto.nombre,
    description: descripcion,
    alternates: { canonical: `/producto/${producto.slug}` },
    openGraph: {
      title: producto.nombre,
      description: descripcion,
      type: "website",
      ...(imagen ? { images: [{ url: imagen }] } : {}),
    },
  };
}

export default function PaginaProducto({ params }: Props) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="aspect-square animate-pulse rounded-xl bg-muted" />
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
          </div>
        </main>
      }
    >
      <ContenidoProducto params={params} />
    </Suspense>
  );
}

async function ContenidoProducto({ params }: { params: Props["params"] }) {
  const { slug } = await params;
  const producto = await obtenerProducto(slug);
  if (!producto) notFound();

  const presentaciones = producto.variantes.flatMap((v) => aPresentacion(v) ?? []);
  if (presentaciones.length === 0) notFound();
  const primera: PresentacionVista = presentaciones[0];
  const descripcion = descripcionMeta(producto.nombre, producto.marca?.nombre ?? null, producto.descripcion);

  const jsonLd = jsonLdProducto({
    nombre: producto.nombre,
    descripcion,
    marca: producto.marca?.nombre ?? null,
    sku: primera.sku,
    imagenes: producto.imagenes.map((i) => i.url),
    precio: primera.precioOferta ?? primera.precioUnidad,
    disponible: presentaciones.some((p) => p.disponible),
    url: `/producto/${producto.slug}`,
  });

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      {/* El "<" se escapa para que el texto de un producto no pueda cerrar la etiqueta <script>. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <nav aria-label="Ruta de navegación" className="mb-4 text-xs text-muted-foreground">
        <Link href="/" className="hover:underline">Inicio</Link>
        {" › "}
        <Link href="/catalogo" className="hover:underline">Catálogo</Link>
        {producto.categoria.slug ? (
          <>
            {" › "}
            <Link href={`/catalogo?cat=${producto.categoria.slug}`} className="hover:underline">
              {producto.categoria.nombre}
            </Link>
          </>
        ) : null}
      </nav>

      <div className="grid gap-8 md:grid-cols-2 md:gap-10">
        <GaleriaProducto imagenes={producto.imagenes} nombre={producto.nombre} />

        <div className="grid content-start gap-5">
          <header className="grid gap-1">
            {producto.marca ? (
              <Link
                href={`/catalogo?marca=${producto.marca.slug}`}
                className="text-sm font-medium text-ev-azul hover:underline"
              >
                {producto.marca.nombre}
              </Link>
            ) : null}
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{producto.nombre}</h1>
            {producto.esNuevo ? (
              <p className="w-fit rounded-md bg-ev-azul px-2 py-0.5 text-xs font-bold text-white">Nuevo</p>
            ) : null}
          </header>

          <SelectorPresentacion
            presentaciones={presentaciones}
            producto={{
              nombre: producto.nombre,
              slug: producto.slug,
              imagen: producto.imagenes[0]?.miniatura ?? producto.imagenes[0]?.url ?? null,
            }}
          />

          {producto.descripcion ? (
            <section aria-labelledby="descripcion" className="grid gap-1">
              <h2 id="descripcion" className="text-sm font-semibold">Descripción</h2>
              <p className="text-sm whitespace-pre-line text-muted-foreground">{producto.descripcion}</p>
            </section>
          ) : null}
        </div>
      </div>

      {producto.relacionados.length > 0 ? (
        <section aria-labelledby="relacionados" className="mt-12">
          <h2 id="relacionados" className="mb-4 text-xl font-bold tracking-tight">
            Productos relacionados
          </h2>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {producto.relacionados.map((p) => (
              <li key={p.id} className="flex">
                <div className="flex-1">
                  <TarjetaProducto producto={p} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
