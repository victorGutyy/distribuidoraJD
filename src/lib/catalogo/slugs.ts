import "server-only";
import { slugUnico } from "@/lib/slug";
import type { createClient } from "@/lib/supabase/server";

type Cliente = Awaited<ReturnType<typeof createClient>>;

/**
 * Busca en la base un slug que no esté ocupado en la tabla indicada
 * ("granos", "granos-2", "granos-3"…). Solo para código de servidor.
 *
 * Es una consulta y luego un INSERT, así que dos personas creando lo mismo en el
 * mismo segundo podrían chocar: la restricción UNIQUE de la base lo detiene y el
 * llamador reintenta una vez.
 */
export async function slugLibre(
  supabase: Cliente,
  tabla: "categorias" | "marcas" | "productos",
  base: string,
): Promise<string> {
  const raiz = base || "sin-nombre";
  // La base solo contiene [a-z0-9-], así que no necesita escapes en el patrón.
  const { data } = await supabase
    .from(tabla)
    .select("slug")
    .like("slug", `${raiz}%`)
    .limit(500);
  return slugUnico(raiz, new Set((data ?? []).map((fila) => fila.slug)));
}
