import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino del enlace del correo de recuperación.
 *
 * Supabase redirige aquí con un ?code=... de un solo uso. Lo cambiamos por una
 * sesión (queda en las cookies) y mandamos al usuario a crear su contraseña.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  // Lista cerrada de destinos: así este endpoint no sirve para redirigir a otros sitios.
  const destino =
    searchParams.get("next") === "/admin/restablecer"
      ? "/admin/restablecer"
      : "/admin";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destino, origin));
  }

  return NextResponse.redirect(new URL("/admin/login?motivo=enlace", origin));
}
