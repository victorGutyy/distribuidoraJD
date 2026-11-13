import type { Metadata } from "next";
import { FormularioRecuperar } from "@/components/admin/FormularioRecuperar";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function PaginaRecuperar() {
  return <FormularioRecuperar />;
}
