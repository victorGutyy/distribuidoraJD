import { Package } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CarruselBanners } from "@/components/tienda/CarruselBanners";
import { Logo } from "@/components/tienda/Logo";
import { TarjetaProducto } from "@/components/tienda/TarjetaProducto";
import { conteosAcumulados } from "@/lib/tienda/categorias";
import { obtenerFacetas, obtenerInicio } from "@/lib/tienda/consultas";
import { obtenerCategoriasTienda } from "@/lib/tienda/datos";
import { imagenPermitida } from "@/lib/tienda/imagenes";
import type { ProductoTarjeta } from "@/lib/tienda/tarjeta";

export const metadata: Metadata = {
  title: { absolute: "EV Distribuidora | Víveres, aseo y más por mayor" },
  description:
    "Arma tu pedido por mayor desde el celular, envíalo por WhatsApp y paga contraentrega. Víveres, útiles escolares, aseo, cuidado personal y más en el Quindío.",
};

export default async function Inicio() {
  const [inicio, categorias, facetas] = await Promise.all([
    obtenerInicio(),
    obtenerCategoriasTienda(),
    obtenerFacetas(),
  ]);
  const conteos = conteosAcumulados(
    categorias,
    new Map(Object.entries(facetas.porCategoria).map(([k, v]) => [Number(k), v])),
  );
  const principales = categorias.filter(
    (c) => c.parent_id === null && (conteos.get(c.id) ?? 0) > 0,
  );
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hayProductos = Object.keys(facetas.porCategoria).length > 0;

  return (
    <main className="flex-1">
      {inicio.banners.length > 0 ? (
        <CarruselBanners banners={inicio.banners} />
      ) : (
        <section className="bg-ev-negro text-white">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-10 text-center md:flex-row md:justify-between md:text-left">
            <div className="grid gap-3">
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                Compra por mayor y ahorra
              </h1>
              <p className="max-w-xl text-white/80">
                Arma tu pedido desde el celular, envíalo por WhatsApp y paga
                contraentrega.
              </p>
              <div>
                <Link
                  href="/catalogo"
                  className="inline-flex h-12 items-center rounded-lg bg-ev-azul px-6 text-base font-semibold text-white hover:bg-ev-azul/90"
                >
                  Ver el catálogo
                </Link>
              </div>
            </div>
            <Logo className="w-28 md:w-40" sizes="160px" />
          </div>
        </section>
      )}

      <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-8">
        {!hayProductos ? (
          <p className="rounded-xl border bg-background p-6 text-center text-muted-foreground">
            Estamos preparando el catálogo. Muy pronto podrás armar tu pedido aquí.
          </p>
        ) : null}

        {principales.length > 0 ? (
          <section aria-labelledby="categorias">
            <h2 id="categorias" className="mb-4 text-xl font-bold tracking-tight">
              Compra por categoría
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {principales.map((c) => {
                const icono = imagenPermitida(c.icono_url, supabaseUrl);
                return (
                  <li key={c.id}>
                    <Link
                      href={`/catalogo?cat=${c.slug}`}
                      className="flex h-full min-h-28 flex-col items-center justify-center gap-2 rounded-xl border bg-background p-4 text-center transition-colors hover:border-ev-azul hover:bg-ev-azul/5"
                    >
                      {icono ? (
                        <Image src={icono} alt="" width={56} height={56} className="size-14 object-contain" />
                      ) : (
                        <Package className="size-10 text-ev-dorado-oscuro" aria-hidden="true" />
                      )}
                      <span className="text-sm font-semibold">{c.nombre}</span>
                      <span className="text-xs text-muted-foreground">
                        {conteos.get(c.id)} {conteos.get(c.id) === 1 ? "producto" : "productos"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <BloqueProductos
          id="ofertas"
          titulo="Ofertas"
          productos={inicio.ofertas}
          verTodo={{ href: "/catalogo?ofertas=1", texto: "Ver todas las ofertas" }}
        />
        <BloqueProductos
          id="nuevos"
          titulo="Nuevos"
          productos={inicio.nuevos}
          verTodo={{ href: "/catalogo?orden=recientes", texto: "Ver los más recientes" }}
        />
      </div>
    </main>
  );
}

function BloqueProductos({
  id,
  titulo,
  productos,
  verTodo,
}: {
  id: string;
  titulo: string;
  productos: ProductoTarjeta[];
  verTodo: { href: string; texto: string };
}) {
  if (productos.length === 0) return null;
  return (
    <section aria-labelledby={id}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 id={id} className="text-xl font-bold tracking-tight">
          {titulo}
        </h2>
        <Link href={verTodo.href} className="text-sm font-medium text-ev-azul hover:underline">
          {verTodo.texto}
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {productos.map((p) => (
          <li key={p.id} className="flex">
            <div className="flex-1">
              <TarjetaProducto producto={p} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
