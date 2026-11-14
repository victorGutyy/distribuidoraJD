import type { Metadata } from "next";
import { Suspense } from "react";
import { AvisoPagina } from "@/components/admin/AvisoPagina";
import {
  FormularioCompras,
  FormularioContacto,
  FormularioEmpresa,
  FormularioEntrega,
} from "@/components/admin/config/FormulariosConfig";
import { requerirSeccion } from "@/lib/auth";
import { valoresConfigFormulario } from "@/lib/config-admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Configuración" };

type Params = PageProps<"/admin/config">["searchParams"];

export default function PaginaConfig({ searchParams }: PageProps<"/admin/config">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
      <ContenidoConfig searchParams={searchParams} />
    </Suspense>
  );
}

async function ContenidoConfig({ searchParams }: { searchParams: Params }) {
  await requerirSeccion("config");
  const params = await searchParams;
  const ok = typeof params.ok === "string" ? params.ok : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;

  const supabase = await createClient();
  const { data, error: errorLectura } = await supabase.from("configuracion").select("clave, valor");
  const v = valoresConfigFormulario(data ?? []);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Lo que cambies aquí se ve en la tienda al instante. Los banners del inicio están en su propia sección.
        </p>
      </header>

      <AvisoPagina ok={ok} error={error} />
      {errorLectura ? <AvisoPagina error="generico" /> : null}

      <FormularioContacto v={v} />
      <FormularioCompras v={v} />
      <FormularioEntrega v={v} />
      <FormularioEmpresa v={v} />
    </div>
  );
}
