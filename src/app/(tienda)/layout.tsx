import type { Metadata } from "next";
import { BarraSuperior } from "@/components/tienda/BarraSuperior";
import { BotonWhatsApp } from "@/components/tienda/BotonWhatsApp";
import { EncabezadoTienda } from "@/components/tienda/EncabezadoTienda";
import { PieTienda } from "@/components/tienda/PieTienda";
import { conteosAcumulados } from "@/lib/tienda/categorias";
import { obtenerFacetas } from "@/lib/tienda/consultas";
import { obtenerCategoriasTienda, obtenerConfigTienda } from "@/lib/tienda/datos";

export const metadata: Metadata = {
  title: { default: "EV Distribuidora", template: "%s | EV Distribuidora" },
};

/**
 * Marco común de la tienda pública: barra superior, encabezado, pie y botón de
 * WhatsApp (RF-01, RF-12). La configuración y las categorías vienen de una caché
 * corta (lib/tienda/datos.ts); el contenido de cada página se lee fresco.
 */
export default async function LayoutTienda({ children }: LayoutProps<"/">) {
  const [config, categorias, facetas] = await Promise.all([
    obtenerConfigTienda(),
    obtenerCategoriasTienda(),
    obtenerFacetas(),
  ]);
  const conteos = conteosAcumulados(
    categorias,
    new Map(Object.entries(facetas.porCategoria).map(([k, v]) => [Number(k), v])),
  );

  return (
    <>
      <BarraSuperior mensaje={config.mensajeBarra} />
      <EncabezadoTienda
        categorias={categorias}
        conteos={conteos}
        whatsapp={config.whatsapp}
        mensajeWhatsApp={config.mensajeWhatsApp}
      />
      <div className="flex flex-1 flex-col">{children}</div>
      <PieTienda config={config} />
      <BotonWhatsApp numero={config.whatsapp} mensaje={config.mensajeWhatsApp} />
    </>
  );
}
