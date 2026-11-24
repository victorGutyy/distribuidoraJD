import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { urlSitio } from "@/lib/sitio";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Con metadataBase, las rutas relativas (canonical, imágenes) se vuelven direcciones completas.
  metadataBase: new URL(urlSitio()),
  title: "EV Distribuidora",
  description:
    "Catálogo de EV Distribuidora: arma tu pedido por mayor y envíalo por WhatsApp.",
  applicationName: "EV Distribuidora",
  openGraph: {
    siteName: "EV Distribuidora",
    locale: "es_CO",
    type: "website",
    // Imagen por defecto al compartir por WhatsApp (los productos traen la suya).
    images: [{ url: "/logo-ev.webp", alt: "EV Distribuidora" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CO" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
