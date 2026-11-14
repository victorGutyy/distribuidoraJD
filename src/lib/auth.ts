import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { esRol, puedeVer, type Rol, type Seccion } from "@/lib/permisos";
import { createClient } from "@/lib/supabase/server";

/**
 * Autenticación y autorización en el SERVIDOR (patrón "Data Access Layer").
 *
 * El proxy solo comprueba que haya sesión. Aquí se comprueba QUIÉN eres y QUÉ
 * puedes hacer, y se llama desde cada página y Server Action del panel:
 *   const perfil = await requerirSeccion("productos");
 * Nunca confíes en lo que diga el navegador sobre el rol.
 */

export type PerfilActual = {
  id: string;
  correo: string | null;
  nombre: string;
  rol: Rol;
  sectoresAsignados: number[];
};

/**
 * Perfil del usuario con sesión, o null si no hay sesión, no tiene perfil o su
 * perfil está inactivo. `cache()` evita repetir la consulta dentro de la misma
 * petición (el layout y la página la usan a la vez).
 */
export const obtenerPerfilActual = cache(
  async (): Promise<PerfilActual | null> => {
    // Leer la sesión mira la hora (Date.now) para saber si el token venció. Con
    // Cache Components + partialPrefetching, Next preprocesa las rutas con las
    // cookies ya disponibles y marca la hora como "valor inestable". connection()
    // declara que esto se calcula en CADA visita, no al preparar la ruta.
    await connection();
    const supabase = await createClient();

    // getUser() pregunta al servidor de Auth: detecta sesiones revocadas.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    // RLS: un usuario solo puede leer SU fila de perfiles.
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre, rol, activo, sectores_asignados")
      .eq("id", user.id)
      .maybeSingle();

    if (!perfil || !perfil.activo || !esRol(perfil.rol)) return null;

    return {
      id: user.id,
      correo: user.email ?? null,
      nombre: perfil.nombre,
      rol: perfil.rol,
      sectoresAsignados: perfil.sectores_asignados,
    };
  },
);

/** Exige un perfil activo; si no, manda al login. */
export async function requerirPerfil(): Promise<PerfilActual> {
  const perfil = await obtenerPerfilActual();
  if (!perfil) redirect("/admin/login?motivo=sin-acceso");
  return perfil;
}

/** Exige uno de estos roles; si no, vuelve al inicio del panel. */
export async function requerirRol(
  roles: readonly Rol[],
): Promise<PerfilActual> {
  const perfil = await requerirPerfil();
  if (!roles.includes(perfil.rol)) redirect("/admin?motivo=permiso");
  return perfil;
}

/** Exige que el rol pueda entrar a esa sección (según lib/permisos.ts). */
export async function requerirSeccion(seccion: Seccion): Promise<PerfilActual> {
  const perfil = await requerirPerfil();
  if (!puedeVer(perfil.rol, seccion)) redirect("/admin?motivo=permiso");
  return perfil;
}
