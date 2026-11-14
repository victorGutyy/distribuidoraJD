import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino del enlace para crear (o cambiar) la contraseña que un administrador le
 * entrega a una persona del equipo (sección Usuarios).
 *
 * Trae un token de un solo uso (?token_hash=…&type=recovery). Se cambia por una sesión
 * EN ESTE NAVEGADOR y se manda a crear la contraseña. Es distinto del enlace del
 * correo de recuperación (/admin/auth/callback): aquel necesita que quien lo pidió
 * sea quien lo abre, y este lo abre otra persona.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");

  if (tokenHash && searchParams.get("type") === "recovery") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL("/admin/restablecer", origin));
  }
  return NextResponse.redirect(new URL("/admin/login?motivo=enlace", origin));
}
