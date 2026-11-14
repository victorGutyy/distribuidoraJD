"use server";

import { redirect } from "next/navigation";
import { esRol, rutaAdminSegura } from "@/lib/permisos";
import { obtenerOrigen } from "@/lib/origen";
import { createClient } from "@/lib/supabase/server";
import {
  loginSchema,
  recuperarSchema,
  restablecerSchema,
} from "@/lib/validaciones/auth";
import {
  erroresPorCampo,
  textoDe,
  type EstadoFormulario,
} from "@/lib/validaciones/comun";

// Server Actions: se ejecutan en el servidor aunque se llamen desde un formulario.
// Siempre validamos con Zod aquí; la validación del navegador es solo comodidad.

export async function iniciarSesion(
  _estadoPrevio: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const valores = { correo: textoDe(formData, "correo") };

  const parsed = loginSchema.safeParse({
    correo: valores.correo,
    contrasena: textoDe(formData, "contrasena"),
    next: textoDe(formData, "next") || undefined,
  });
  if (!parsed.success) {
    return { errores: erroresPorCampo(parsed.error), valores };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.correo,
    password: parsed.data.contrasena,
  });

  // Mensaje genérico a propósito: no revelamos si el correo existe.
  if (error || !data.user) {
    return { error: "Correo o contraseña incorrectos.", valores };
  }

  // Tener cuenta en Auth no basta: el perfil debe existir y estar activo (RF-31).
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("activo, rol")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!perfil || !perfil.activo || !esRol(perfil.rol)) {
    await supabase.auth.signOut();
    return {
      error:
        "Tu cuenta todavía no está activa. Pídele al administrador que la active.",
      valores,
    };
  }

  // redirect() lanza una excepción especial: debe quedar fuera de try/catch.
  redirect(rutaAdminSegura(parsed.data.next));
}

export async function solicitarRecuperacion(
  _estadoPrevio: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const valores = { correo: textoDe(formData, "correo") };

  const parsed = recuperarSchema.safeParse(valores);
  if (!parsed.success) {
    return { errores: erroresPorCampo(parsed.error), valores };
  }

  const supabase = await createClient();
  const origen = await obtenerOrigen();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.correo,
    // El enlace del correo trae un ?code= que el callback cambia por una sesión.
    // Supabase solo acepta URLs de su lista de "Redirect URLs".
    { redirectTo: `${origen}/admin/auth/callback?next=/admin/restablecer` },
  );

  if (error?.status === 429 || error?.code === "over_email_send_rate_limit") {
    return {
      error:
        "Hiciste varios intentos seguidos. Espera unos minutos y vuelve a probar.",
      valores,
    };
  }
  if (error) {
    // Se registra en el servidor, pero al usuario se le da la misma respuesta
    // que si todo hubiera salido bien (no revelar qué correos existen).
    console.error(
      "[recuperar] Supabase respondió:",
      error.code ?? error.message,
    );
  }

  return {
    mensaje:
      "Si ese correo está registrado, te enviamos un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.",
    valores,
  };
}

export async function restablecerContrasena(
  _estadoPrevio: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const parsed = restablecerSchema.safeParse({
    contrasena: textoDe(formData, "contrasena"),
    confirmar: textoDe(formData, "confirmar"),
  });
  if (!parsed.success) {
    return { errores: erroresPorCampo(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: "El enlace venció. Pide uno nuevo desde «Olvidé mi contraseña».",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.contrasena,
  });
  if (error) {
    if (error.code === "same_password") {
      return { error: "Elige una contraseña distinta a la anterior." };
    }
    if (error.code === "weak_password") {
      return {
        error:
          "Esa contraseña es muy fácil de adivinar. Prueba con una más larga o más variada.",
      };
    }
    return { error: "No pudimos cambiar la contraseña. Inténtalo de nuevo." };
  }

  // El layout del panel comprueba que el perfil esté activo.
  redirect("/admin");
}
