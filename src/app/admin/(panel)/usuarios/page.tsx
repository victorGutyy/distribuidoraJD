import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AvisoPagina } from "@/components/admin/AvisoPagina";
import { BotonEnlaceAcceso } from "@/components/admin/usuarios/EnlaceAcceso";
import { FormularioEditarUsuario, FormularioInvitar } from "@/components/admin/usuarios/FormulariosUsuario";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requerirSeccion } from "@/lib/auth";
import { ETIQUETA_ROL } from "@/lib/permisos";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Usuarios" };

type Params = PageProps<"/admin/usuarios">["searchParams"];

export default function PaginaUsuarios({ searchParams }: PageProps<"/admin/usuarios">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
      <ContenidoUsuarios searchParams={searchParams} />
    </Suspense>
  );
}

async function ContenidoUsuarios({ searchParams }: { searchParams: Params }) {
  const yo = await requerirSeccion("usuarios");
  const params = await searchParams;
  const ok = typeof params.ok === "string" ? params.ok : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  const editarId = typeof params.editar === "string" ? params.editar : undefined;

  const supabase = await createClient();
  const [{ data: perfiles, error: errorLectura }, { data: sectoresBD }, cuentas] = await Promise.all([
    supabase.from("perfiles").select("id, nombre, rol, activo, sectores_asignados, created_at").order("created_at"),
    supabase.from("sectores").select("id, nombre, municipios(nombre)").order("nombre"),
    // Los correos viven en Supabase Auth: solo se leen con la clave de servicio, aquí en el servidor.
    createAdminClient().auth.admin.listUsers({ page: 1, perPage: 200 }),
  ]);
  const correoDe = new Map((cuentas.data?.users ?? []).map((u) => [u.id, u.email ?? null]));
  const sectores = (sectoresBD ?? []).map((s) => ({
    id: s.id,
    nombre: s.nombre,
    municipio: (s.municipios as unknown as { nombre: string } | null)?.nombre ?? "",
  }));
  const usuarios = (perfiles ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    correo: correoDe.get(p.id) ?? null,
    rol: p.rol,
    activo: p.activo,
    sectores: p.sectores_asignados,
  }));
  const enEdicion = usuarios.find((u) => u.id === editarId);

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Usuarios del panel</h1>
        <p className="text-muted-foreground">Quién puede entrar al panel y qué puede hacer. Solo los administradores ven esta sección.</p>
      </header>

      <AvisoPagina ok={ok} error={error} />
      {errorLectura ? <AvisoPagina error="generico" /> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[24rem_1fr]">
        {enEdicion ? (
          <FormularioEditarUsuario key={enEdicion.id} usuario={enEdicion} sectores={sectores} esUnoMismo={enEdicion.id === yo.id} />
        ) : (
          <FormularioInvitar sectores={sectores} />
        )}

        <Card>
          <CardHeader>
            <CardTitle>Equipo ({usuarios.length})</CardTitle>
            <CardDescription>Con «Generar enlace» una persona crea o cambia su contraseña sin correo.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2">
              {usuarios.map((u) => (
                <li key={u.id} className="grid gap-2 rounded-lg border bg-background px-3 py-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="min-w-40 flex-1">
                      <p className="font-medium">
                        {u.nombre}
                        {u.id === yo.id ? <span className="text-muted-foreground"> (tú)</span> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">{u.correo ?? "Sin correo"}</p>
                    </div>
                    <Badge variant="outline">{ETIQUETA_ROL[u.rol]}</Badge>
                    <Badge variant={u.activo ? "outline" : "secondary"}>{u.activo ? "Activo" : "Inactivo"}</Badge>
                    <Link
                      href={`/admin/usuarios?editar=${u.id}`}
                      aria-label={`Editar a ${u.nombre}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-9")}
                    >
                      Editar
                    </Link>
                    <BotonEnlaceAcceso id={u.id} nombre={u.nombre} />
                  </div>
                  {u.rol === "vendedor" ? (
                    <p className="text-xs text-muted-foreground">
                      Sectores:{" "}
                      {u.sectores.length === 0
                        ? "ninguno todavía (no verá pedidos)"
                        : u.sectores.map((id) => sectores.find((s) => s.id === id)?.nombre ?? `#${id}`).join(", ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
