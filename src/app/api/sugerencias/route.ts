import { NextResponse, type NextRequest } from "next/server";
import { sugerirProductos } from "@/lib/tienda/consultas";

/**
 * Sugerencias del buscador mientras se escribe (RF-04): hasta 6 productos.
 * Es una ruta pública de solo lectura; el texto se limita a 60 caracteres y se
 * exigen al menos 2.
 */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 60);
  if (q.length < 2) return NextResponse.json({ items: [] });

  const items = await sugerirProductos(q);
  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } },
  );
}
