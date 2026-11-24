import { createServerClient } from "@supabase/ssr";
import { endurecerCookie, esProduccion } from "@/lib/supabase/cookies";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";
import { getSupabasePublicEnv } from "./env";

/**
 * Cliente de Supabase para el SERVIDOR (Server Components, Server Actions y
 * Route Handlers). Lee y escribe la sesión del usuario en las cookies.
 * Sigue usando la clave pública: RLS aplica según quién haya iniciado sesión.
 *
 * En Next.js 16 `cookies()` es asíncrona, por eso esta función es `async`.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabasePublicEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, endurecerCookie(options, esProduccion())),
          );
        } catch {
          // Un Server Component no puede escribir cookies. Se ignora: en F1
          // el proxy de Next refrescará la sesión antes de llegar aquí.
        }
      },
    },
  });
}
