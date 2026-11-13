import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FormularioRestablecer } from "@/components/admin/FormularioRestablecer";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Contraseña nueva" };

export default function PaginaRestablecer() {
  return (
    <Suspense fallback={<p className="text-center text-sm">Cargando…</p>}>
      <ContenidoRestablecer />
    </Suspense>
  );
}

async function ContenidoRestablecer() {
  // Solo se llega aquí con la sesión que crea el enlace del correo (callback).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login?motivo=enlace");

  return <FormularioRestablecer />;
}
