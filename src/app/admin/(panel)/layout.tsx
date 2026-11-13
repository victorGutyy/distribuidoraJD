import { Suspense } from "react";
import { BarraAdmin } from "@/components/admin/BarraAdmin";
import { requerirPerfil } from "@/lib/auth";
import { menuParaRol } from "@/lib/permisos";

// Con Cache Components, la sesión NO se lee en el nivel superior del layout
// (bloquearía todo): se lee dentro de un componente bajo <Suspense>, y mientras
// tanto se muestra el esqueleto.
export default function PanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<EsqueletoPanel />}>
      <PanelConSesion>{children}</PanelConSesion>
    </Suspense>
  );
}

async function PanelConSesion({ children }: { children: React.ReactNode }) {
  // Segunda barrera (la primera es el proxy): perfil existente y activo.
  const perfil = await requerirPerfil();

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <BarraAdmin
        nombre={perfil.nombre}
        rol={perfil.rol}
        items={menuParaRol(perfil.rol)}
      />
      <div className="min-w-0 flex-1 bg-muted/30 p-4 md:p-8">{children}</div>
    </div>
  );
}

function EsqueletoPanel() {
  return (
    <div className="flex flex-1 flex-col md:flex-row" aria-busy="true">
      <div className="hidden w-64 shrink-0 border-r bg-background md:block" />
      <div className="flex-1 bg-muted/30 p-8">
        <p className="text-sm text-muted-foreground">Cargando el panel…</p>
      </div>
    </div>
  );
}
