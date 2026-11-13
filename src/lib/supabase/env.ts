/**
 * Lectura centralizada de las variables de entorno de Supabase.
 *
 * Si falta una, lanzamos un error en español que dice cuál es, en vez del
 * mensaje críptico que daría Supabase ("Invalid URL").
 *
 * IMPORTANTE: las variables NEXT_PUBLIC_* deben leerse escribiendo el nombre
 * completo (process.env.NEXT_PUBLIC_...). Next.js las reemplaza en el momento
 * de compilar; si se leyeran con process.env[nombre] no llegarían al navegador.
 */

export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local",
    );
  }
  return { url, anonKey };
}

/** Solo para código de servidor. Nunca importar desde un componente cliente. */
export function getSupabaseServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en .env.local");
  }
  return key;
}
