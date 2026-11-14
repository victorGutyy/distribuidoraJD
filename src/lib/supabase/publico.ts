import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getSupabasePublicEnv } from "./env";

/**
 * Cliente de Supabase SIN sesión, para leer datos públicos del catálogo.
 *
 * Usa la clave pública (anon), así que RLS solo deja ver lo que cualquier
 * visitante puede ver (RN-01). No toca cookies: por eso se puede usar dentro de
 * funciones con "use cache", donde Next prohíbe leerlas.
 */
export function createPublicClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
