import type { Metadata } from "next";
import { Suspense } from "react";
import { AvisoPagina } from "@/components/admin/AvisoPagina";
import { FilaBanner } from "@/components/admin/banners/FilaBanner";
import { SubidorBanner } from "@/components/admin/banners/SubidorBanner";
import { requerirSeccion } from "@/lib/auth";
import { LIMITES_BANNER } from "@/lib/catalogo/imagenes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Banners" };

type Params = PageProps<"/admin/banners">["searchParams"];

export default function PaginaBanners({ searchParams }: PageProps<"/admin/banners">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
      <ContenidoBanners searchParams={searchParams} />
    </Suspense>
  );
}

async function ContenidoBanners({ searchParams }: { searchParams: Params }) {
  await requerirSeccion("banners");
  const params = await searchParams;
  const ok = typeof params.ok === "string" ? params.ok : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;

  const supabase = await createClient();
  const { data, error: errorLectura } = await supabase
    .from("banners")
    .select("id, imagen_url, imagen_movil_url, enlace, activo")
    .order("orden")
    .order("id");
  const banners = data ?? [];

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Banners</h1>
        <p className="text-muted-foreground">
          Las imágenes del carrusel del inicio de la tienda (de 1 a {LIMITES_BANNER.maxBanners}). Sin banners activos, el
          inicio muestra un encabezado con el logo.
        </p>
      </header>

      <AvisoPagina ok={ok} error={error} />
      {errorLectura ? <AvisoPagina error="generico" /> : null}

      <SubidorBanner lleno={banners.length >= LIMITES_BANNER.maxBanners} />

      {banners.length === 0 ? (
        <p className="rounded-xl border bg-background p-6 text-center text-sm text-muted-foreground">Aún no hay banners.</p>
      ) : (
        <ul className="grid gap-3">
          {banners.map((b, i) => (
            <li key={b.id}>
              <FilaBanner banner={b} posicion={i + 1} total={banners.length} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
