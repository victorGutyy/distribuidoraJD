"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Abre el diálogo de impresión del navegador (también sirve para guardar como PDF). */
export function BotonImprimir({ texto = "Imprimir" }: { texto?: string }) {
  return (
    <Button type="button" variant="outline" className="h-11 gap-2 print:hidden" onClick={() => window.print()}>
      <Printer aria-hidden="true" />
      {texto}
    </Button>
  );
}
