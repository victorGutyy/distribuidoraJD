import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";
import { getSupabasePublicEnv } from "./env";

/**
 * Refresca la sesión de Supabase en cada petición (se usa desde src/proxy.ts).
 *
 * El token de acceso dura poco; mientras haya un token de refresco válido, aquí
 * se renueva y se reescriben las cookies en la petición y en la respuesta.
 *
 * Devuelve si hay una sesión con firma válida. Es solo una primera barrera
 * "optimista": NO comprueba el rol. La autorización real está en lib/auth.ts
 * y en RLS.
 */
export async function actualizarSesion(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabasePublicEnv();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getClaims() valida la firma del JWT; no confiamos solo en que exista la cookie.
  const { data } = await supabase.auth.getClaims();

  return { response, tieneSesion: Boolean(data?.claims) };
}
