"use server";

import { redirect } from "next/navigation";
import { requerirSeccion } from "@/lib/auth";
import { obtenerOrigen } from "@/lib/origen";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { erroresPorCampo, textoDe, type EstadoFormulario } from "@/lib/validaciones/comun";
import { editarUsuarioSchema, idUsuarioSchema, invitarSchema } from "@/lib/validaciones/usuarios";

/**
 * Usuarios del panel (RF-31, SOLO admin). Crear la cuenta y generar enlaces usa la clave de
 * servicio (únicamente aquí, en el servidor); cambiar el rol, el estado y los sectores va
 * con la sesión del admin y RLS (solo el admin actualiza perfiles).
 *
 * No se envía un correo de invitación: al crear la cuenta se genera un ENLACE de un solo
 * uso para que la persona cree su contraseña, y el admin se lo entrega (por WhatsApp,
 * por ejemplo). Así no depende de que el correo llegue ni de la configuración de URLs de
 * Supabase. El enlace da acceso a la cuenta: se muestra una sola vez, solo al admin.
 */

const RUTA = "/admin/usuarios";

export type EstadoInvitacion = EstadoFormulario & { enlace?: string; correo?: string };

/** Enlace de un solo uso para crear (o cambiar) la contraseña de ese correo. */
async function enlaceParaCrearContrasena(correo: string): Promise<string | null> {
  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: "recovery", email: correo });
  const hash = data?.properties?.hashed_token;
  if (error || !hash) return null;
  const origen = await obtenerOrigen();
  return `${origen}/admin/auth/confirmar?token_hash=${encodeURIComponent(hash)}&type=recovery`;
}

export async function invitarUsuario(_previo: EstadoInvitacion, formData: FormData): Promise<EstadoInvitacion> {
  await requerirSeccion("usuarios");
  const valores = {
    correo: textoDe(formData, "correo"),
    nombre: textoDe(formData, "nombre"),
    rol: textoDe(formData, "rol"),
  };
  const parsed = invitarSchema.safeParse({
    ...valores,
    sectores: formData.getAll("sectores").filter((s): s is string => typeof s === "string"),
  });
  if (!parsed.success) return { errores: erroresPorCampo(parsed.error), valores };
  const d = parsed.data;

  const admin = createAdminClient();
  const { data: creado, error } = await admin.auth.admin.createUser({
    email: d.correo,
    email_confirm: true,
    user_metadata: { nombre: d.nombre },
  });
  if (error || !creado.user) {
    const repetido = error?.code === "email_exists" || /already|registered/i.test(error?.message ?? "");
    return repetido
      ? { errores: { correo: ["Ya existe una persona con ese correo"] }, valores }
      : { error: "No pudimos crear la cuenta. Inténtalo de nuevo.", valores };
  }

  // El disparador de la base creó su perfil inactivo y sin permisos: aquí se activa con su rol.
  const supabase = await createClient();
  const { data: perfil, error: errorPerfil } = await supabase
    .from("perfiles")
    .update({
      nombre: d.nombre,
      rol: d.rol as "admin" | "editor" | "vendedor",
      activo: true,
      sectores_asignados: d.rol === "vendedor" ? d.sectores : [],
    })
    .eq("id", creado.user.id)
    .select("id");
  if (errorPerfil || !perfil?.length) {
    await admin.auth.admin.deleteUser(creado.user.id); // sin perfil activo la cuenta no sirve: no se deja a medias
    return { error: "No pudimos terminar de crear el usuario. Inténtalo de nuevo.", valores };
  }

  const enlace = await enlaceParaCrearContrasena(d.correo);
  return {
    mensaje: enlace
      ? "Usuario creado. Entrégale este enlace para que cree su contraseña:"
      : "Usuario creado, pero no pudimos generar el enlace. Usa «Generar enlace» en la lista.",
    enlace: enlace ?? undefined,
    correo: d.correo,
  };
}

export type ResultadoEnlace = { ok: true; enlace: string } | { ok: false; error: string };

/** Genera un enlace nuevo para que una persona del equipo cree o cambie su contraseña. */
export async function generarEnlaceUsuario(id: string): Promise<ResultadoEnlace> {
  await requerirSeccion("usuarios");
  const parsed = idUsuarioSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Usuario no válido." };

  const { data, error } = await createAdminClient().auth.admin.getUserById(parsed.data);
  const correo = data?.user?.email;
  if (error || !correo) return { ok: false, error: "No encontramos a ese usuario." };

  const enlace = await enlaceParaCrearContrasena(correo);
  return enlace ? { ok: true, enlace } : { ok: false, error: "No pudimos generar el enlace. Inténtalo de nuevo." };
}

export async function actualizarUsuario(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const yo = await requerirSeccion("usuarios");
  const valores = { nombre: textoDe(formData, "nombre"), rol: textoDe(formData, "rol") };
  const parsed = editarUsuarioSchema.safeParse({
    id: textoDe(formData, "id"),
    ...valores,
    activo: formData.get("activo") === "on",
    sectores: formData.getAll("sectores").filter((s): s is string => typeof s === "string"),
  });
  if (!parsed.success) return { errores: erroresPorCampo(parsed.error), valores };
  const d = parsed.data;

  const supabase = await createClient();
  const esUnoMismo = d.id === yo.id;

  // Nadie puede quitarse a sí mismo el acceso ni el rol de admin (se quedaría fuera del panel).
  const cambios = esUnoMismo
    ? { nombre: d.nombre }
    : {
        nombre: d.nombre,
        rol: d.rol as "admin" | "editor" | "vendedor",
        activo: d.activo,
        sectores_asignados: d.rol === "vendedor" ? d.sectores : [],
      };

  // Siempre debe quedar al menos un administrador activo.
  if (!esUnoMismo && (d.rol !== "admin" || !d.activo)) {
    const { data: otros } = await supabase
      .from("perfiles")
      .select("id")
      .eq("rol", "admin")
      .eq("activo", true)
      .neq("id", d.id);
    if (!otros?.length) {
      return { error: "Debe quedar al menos un administrador activo.", valores };
    }
  }

  const { data, error } = await supabase.from("perfiles").update(cambios).eq("id", d.id).select("id");
  if (error || !data?.length) {
    return {
      error: error?.code === "42501" ? "No tienes permiso para cambiar usuarios." : "No pudimos guardar los cambios.",
      valores,
    };
  }
  redirect(`${RUTA}?ok=usuario-actualizado`);
}
