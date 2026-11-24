import type { MetadataRoute } from "next";
import { urlSitio } from "@/lib/sitio";

/** Los buscadores pueden ver la tienda; el panel, el carrito, el pago y las rutas internas no. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/carrito", "/checkout", "/pedido"] }],
    sitemap: `${urlSitio()}/sitemap.xml`,
  };
}
