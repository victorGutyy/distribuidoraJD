import { NextResponse, type NextRequest } from "next/server";
import { esRutaAdminPublica } from "@/lib/permisos";
import { actualizarSesion } from "@/lib/supabase/proxy";

/**
 * Proxy (antes "middleware", renombrado en Next 16): corre ANTES de renderizar
 * cualquier ruta de /admin.
 *
 * 1) Refresca la sesión de Supabase (cookies).
 * 2) Si no hay sesión y la ruta no es de acceso (login, recuperar…), manda al login
 *    recordando a dónde quería ir (?next=).
 *
 * Es una barrera rápida; la comprobación de ROL y de que el perfil esté activo
 * se hace en el servidor (lib/auth.ts), y los datos los protege RLS.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { response, tieneSesion } = await actualizarSesion(request);

  if (!tieneSesion && !esRutaAdminPublica(pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/admin/login";
    login.search = "";
    if (pathname !== "/admin") {
      login.searchParams.set("next", `${pathname}${search}`);
    }
    const redireccion = NextResponse.redirect(login);
    // Conserva las cookies que el refresco de sesión haya puesto.
    response.cookies.getAll().forEach((c) => redireccion.cookies.set(c));
    return redireccion;
  }

  return response;
}

// Solo el panel. La tienda pública no necesita sesión.
export const config = {
  matcher: ["/admin/:path*"],
};
