import { Logo } from "@/components/tienda/Logo";

// Marco común de las pantallas de acceso: login, recuperar y restablecer.
export default function AuthLayout({ children }: LayoutProps<"/admin">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-10">
      <Logo priority className="w-28" sizes="112px" />
      <div className="w-full max-w-sm">{children}</div>
      <p className="text-xs text-muted-foreground">Panel de Distribuidora JD</p>
    </main>
  );
}
