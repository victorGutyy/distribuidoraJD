import type { Metadata } from "next";
import { Suspense } from "react";
import { alternarMunicipio } from "@/app/admin/(panel)/zonas/actions";
import { AvisoPagina } from "@/components/admin/AvisoPagina";
import { FilaSector } from "@/components/admin/FilaSector";
import { FormularioSector } from "@/components/admin/FormularioSector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requerirSeccion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Zonas de entrega" };

type Params = PageProps<"/admin/zonas">["searchParams"];

export default function PaginaZonas({ searchParams }: PageProps<"/admin/zonas">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
      <ContenidoZonas searchParams={searchParams} />
    </Suspense>
  );
}

async function ContenidoZonas({ searchParams }: { searchParams: Params }) {
  await requerirSeccion("zonas");
  const params = await searchParams;
  const ok = typeof params.ok === "string" ? params.ok : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  const editarId = typeof params.editar === "string" ? Number(params.editar) : undefined;

  const supabase = await createClient();
  const [{ data: municipiosBD, error: errorMunicipios }, { data: sectoresBD }] = await Promise.all([
    supabase.from("municipios").select("id, nombre, activo").order("nombre"),
    supabase
      .from("sectores")
      .select("id, municipio_id, nombre, dias_reparto, costo_envio, activo")
      .order("nombre"),
  ]);
  const municipios = municipiosBD ?? [];
  const sectores = sectoresBD ?? [];
  const enEdicion = sectores.find((s) => s.id === editarId);

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Zonas de entrega</h1>
        <p className="text-muted-foreground">
          El cliente elige su municipio y sector al hacer el pedido, y con los días de
          reparto se calcula la fecha de entrega. Sin sectores, solo se puede recoger en
          bodega.
        </p>
      </header>

      <AvisoPagina ok={ok} error={error} />
      {errorMunicipios ? <AvisoPagina error="generico" /> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[24rem_1fr]">
        <FormularioSector
          key={enEdicion?.id ?? "nuevo"}
          municipios={municipios.filter((m) => m.activo || m.id === enEdicion?.municipio_id)}
          sector={enEdicion}
        />

        <div className="grid gap-4">
          {municipios.map((m) => {
            const suyos = sectores.filter((s) => s.municipio_id === m.id);
            return (
              <Card key={m.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle>{m.nombre}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={m.activo ? "outline" : "secondary"}>
                        {m.activo ? "Activo" : "Inactivo"}
                      </Badge>
                      <form action={alternarMunicipio}>
                        <input type="hidden" name="id" value={m.id} />
                        <Button type="submit" variant="outline" size="sm" className="min-h-9">
                          {m.activo ? "Desactivar" : "Activar"}
                        </Button>
                      </form>
                    </div>
                  </div>
                  <CardDescription>
                    {suyos.length === 0
                      ? "Sin sectores todavía."
                      : `${suyos.length} ${suyos.length === 1 ? "sector" : "sectores"}`}
                  </CardDescription>
                </CardHeader>
                {suyos.length > 0 ? (
                  <CardContent>
                    <ul className="grid gap-2">
                      {suyos.map((s) => (
                        <li key={s.id}>
                          <FilaSector sector={s} />
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                ) : null}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
