import type { NextConfig } from "next";
import { cabecerasDeSeguridad } from "./src/lib/seguridad";

// Las imágenes de productos viven en Supabase Storage (bucket público "catalogo").
// next/image solo optimiza imágenes de hosts autorizados; se autoriza el de nuestro
// proyecto y únicamente la ruta pública de ese bucket.
const hostSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: hostSupabase
      ? [
          {
            protocol: "https",
            hostname: hostSupabase,
            pathname: "/storage/v1/object/public/catalogo/**",
          },
        ]
      : [],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: cabecerasDeSeguridad({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          produccion: process.env.NODE_ENV === "production",
        }),
      },
      {
        // El panel y las rutas internas no deben aparecer en buscadores ni quedarse en cachés compartidas.
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
