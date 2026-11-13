import { Logo } from "@/components/tienda/Logo";
import { Button } from "@/components/ui/button";

// Inicio provisional de F0. El inicio real (RF-01) se construye en la fase F4.
export default function Inicio() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <Logo
        priority
        className="w-44 sm:w-56"
        sizes="(min-width: 640px) 224px, 176px"
      />
      <h1 className="max-w-md text-3xl font-bold tracking-tight">
        Estamos preparando el catálogo
      </h1>
      <p className="max-w-md text-muted-foreground">
        Pronto podrás armar tu pedido por mayor desde el celular y enviarlo por
        WhatsApp.
      </p>
      <Button size="lg">Ver catálogo</Button>
    </main>
  );
}
