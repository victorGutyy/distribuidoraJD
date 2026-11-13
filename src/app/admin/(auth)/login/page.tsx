import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FormularioLogin } from "@/components/admin/FormularioLogin";
import { obtenerPerfilActual } from "@/lib/auth";
import { rutaAdminSegura } from "@/lib/permisos";

export const metadata: Metadata = { title: "Ingresar" };

type Params = PageProps<"/admin/login">["searchParams"];

// Con Cache Components, leer searchParams y la sesión va dentro de <Suspense>.
export default function PaginaLogin({
  searchParams,
}: PageProps<"/admin/login">) {
  return (
    <Suspense fallback={<p className="text-center text-sm">Cargando…</p>}>
      <ContenidoLogin searchParams={searchParams} />
    </Suspense>
  );
}

async function ContenidoLogin({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const motivo = typeof params.motivo === "string" ? params.motivo : undefined;
  const destino = rutaAdminSegura(next);

  // Si ya hay una sesión con perfil activo, no tiene sentido mostrar el login.
  const perfil = await obtenerPerfilActual();
  if (perfil) redirect(destino);

  return <FormularioLogin next={next ? destino : undefined} motivo={motivo} />;
}
