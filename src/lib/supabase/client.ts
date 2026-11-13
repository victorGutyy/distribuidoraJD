import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";
import { getSupabasePublicEnv } from "./env";

/**
 * Cliente de Supabase para el NAVEGADOR (componentes con "use client").
 * Usa la clave pública (anon): lo que pueda hacer lo decide RLS en la base de datos.
 */
export function createClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  return createBrowserClient<Database>(url, anonKey);
}
