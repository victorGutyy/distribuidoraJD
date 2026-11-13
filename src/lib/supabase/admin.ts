import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getSupabasePublicEnv, getSupabaseServiceRoleKey } from "./env";

/**
 * Cliente de Supabase con la SERVICE ROLE KEY.
 *
 * ⚠️ Esta clave OMITE todas las políticas RLS: es como ser "dueño" de la base
 * de datos. Reglas (CLAUDE.md §3.5):
 *  - Solo se importa desde código de servidor (Server Actions, Route Handlers).
 *  - Jamás desde un componente con "use client".
 *  - Nunca se imprime ni se envía al navegador.
 *  - Úsalo solo cuando RLS no alcance (p. ej. crear un pedido, RF-10) y siempre
 *    validando antes los datos con Zod y comprobando el rol del usuario.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "createAdminClient() se llamó desde el navegador. Solo puede usarse en el servidor.",
    );
  }

  const { url } = getSupabasePublicEnv();
  return createSupabaseClient<Database>(url, getSupabaseServiceRoleKey(), {
    // En el servidor no hay sesión que guardar ni refrescar.
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
