import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requerirSeccion } from "@/lib/auth";
import { ETIQUETA_ROL, SECCIONES, menuParaRol } from "@/lib/permisos";

export const metadata: Metadata = { title: "Inicio" };

// Inicio provisional de F1. Las tarjetas reales del dashboard (RF-21) llegan en F6.
export default function PaginaInicio({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}
    >
      <ContenidoInicio searchParams={searchParams} />
    </Suspense>
  );
}

async function ContenidoInicio({
  searchParams,
}: {
  searchParams: PageProps<"/admin">["searchParams"];
}) {
  const perfil = await requerirSeccion("dashboard");
  const params = await searchParams;
  const sinPermiso = params.motivo === "permiso";
  const pendientes = menuParaRol(perfil.rol).filter((i) => !i.disponible);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Hola, {perfil.nombre}
        </h1>
        <p className="text-muted-foreground">
          Entraste como <strong>{ETIQUETA_ROL[perfil.rol]}</strong>.
        </p>
      </div>

      {sinPermiso ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          No tienes permiso para entrar a esa sección.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>El panel se está construyendo por fases</CardTitle>
          <CardDescription>
            Tu cuenta y tus permisos ya funcionan. Estas secciones se irán
            activando:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm">
            {pendientes.map((item) => (
              <li
                key={item.seccion}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <span className="font-medium">{item.etiqueta}</span>
                <span className="text-muted-foreground">
                  Fase {SECCIONES[item.seccion].fase}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
