"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requerirSeccion } from "@/lib/auth";
import { BUCKET, esUuid, LIMITES_BANNER, rutaDesdeUrl, rutasDeBanner, urlPublica } from "@/lib/catalogo/imagenes";
import { createClient } from "@/lib/supabase/server";
import { enlaceSeguro } from "@/lib/tienda/imagenes";
import { invalidarTienda } from "@/lib/tienda/invalidar";
import { idDeFormulario } from "@/lib/validaciones/catalogo";
import { textoDe } from "@/lib/validaciones/comun";

/**
 * Banners del inicio (RF-30; admin y editor). Las imágenes las sube el navegador al
 * bucket "catalogo" (carpeta banners/) con la sesión de quien las sube; esta acción solo
 * registra el banner después de comprobar que los archivos existen.
 */

const RUTA = "/admin/banners";

export type ResultadoBanner = { ok: true } | { ok: false; error: string };

const registroSchema = z.object({
  uuid: z.string().refine(esUuid, "Identificador no válido"),
  conMovil: z.boolean(),
  enlace: z.string().trim().max(300, "El enlace es muy largo"),
});

export async function registrarBanner(entrada: z.input<typeof registroSchema>): Promise<ResultadoBanner> {
  await requerirSeccion("banners");
  const parsed = registroSchema.safeParse(entrada);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const { uuid, conMovil, enlace } = parsed.data;

  let enlaceFinal: string | null = null;
  if (enlace !== "") {
    enlaceFinal = enlaceSeguro(enlace);
    if (!enlaceFinal) return { ok: false, error: "El enlace debe ser una ruta de la tienda (/catalogo) o empezar por https://" };
  }
  const urlSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!urlSupabase) return { ok: false, error: "Falta configurar la dirección de Supabase." };

  const supabase = await createClient();
  const { count } = await supabase.from("banners").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= LIMITES_BANNER.maxBanners) {
    return { ok: false, error: `Máximo ${LIMITES_BANNER.maxBanners} banners. Elimina uno para agregar otro.` };
  }

  // Los archivos deben existir de verdad (nadie registra una URL inventada).
  const rutas = rutasDeBanner(uuid);
  const { data: archivos, error: errorListado } = await supabase.storage.from(BUCKET).list("banners", { search: uuid });
  const nombres = new Set((archivos ?? []).map((a) => a.name));
  if (errorListado || !nombres.has(`${uuid}.webp`) || (conMovil && !nombres.has(`${uuid}-m.webp`))) {
    return { ok: false, error: "La subida no se completó. Inténtalo de nuevo." };
  }

  const { data: ultimo } = await supabase.from("banners").select("orden").order("orden", { ascending: false }).limit(1);
  const { error } = await supabase.from("banners").insert({
    imagen_url: urlPublica(urlSupabase, rutas.escritorio),
    imagen_movil_url: conMovil ? urlPublica(urlSupabase, rutas.movil) : null,
    enlace: enlaceFinal,
    orden: (ultimo?.[0]?.orden ?? 0) + 1,
    activo: true,
  });
  if (error) {
    return { ok: false, error: error.code === "42501" ? "No tienes permiso para crear banners." : "No pudimos guardar el banner." };
  }
  invalidarTienda();
  return { ok: true };
}

function idObligatorio(formData: FormData): number {
  const parsed = idDeFormulario.safeParse(textoDe(formData, "id"));
  if (!parsed.success) redirect(`${RUTA}?error=generico`);
  return parsed.data;
}

/** Cambia el enlace y si el banner está activo. */
export async function actualizarBanner(formData: FormData): Promise<void> {
  await requerirSeccion("banners");
  invalidarTienda();
  const id = idObligatorio(formData);
  const texto = textoDe(formData, "enlace").trim();
  const enlace = texto === "" ? null : enlaceSeguro(texto);
  if (texto !== "" && !enlace) redirect(`${RUTA}?error=enlace-invalido`);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("banners")
    .update({ enlace, activo: formData.get("activo") === "on" })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) redirect(`${RUTA}?error=${error?.code === "42501" || !data?.length ? "permiso" : "generico"}`);
  redirect(`${RUTA}?ok=banner-actualizado`);
}

/** Sube o baja un banner un puesto (intercambia su orden con el vecino). */
export async function moverBanner(formData: FormData): Promise<void> {
  await requerirSeccion("banners");
  invalidarTienda();
  const id = idObligatorio(formData);
  const sube = textoDe(formData, "direccion") === "subir";
  const supabase = await createClient();

  const { data: todos } = await supabase.from("banners").select("id, orden").order("orden").order("id");
  const lista = todos ?? [];
  const i = lista.findIndex((b) => b.id === id);
  const j = sube ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= lista.length) redirect(RUTA);

  // Los órdenes se reasignan 1..n para que nunca queden repetidos.
  const nuevo = lista.map((b) => b.id);
  [nuevo[i], nuevo[j]] = [nuevo[j], nuevo[i]];
  for (const [posicion, bannerId] of nuevo.entries()) {
    const { error } = await supabase.from("banners").update({ orden: posicion + 1 }).eq("id", bannerId);
    if (error) redirect(`${RUTA}?error=generico`);
  }
  redirect(RUTA);
}

/** Elimina el banner y sus imágenes del bucket. */
export async function eliminarBanner(formData: FormData): Promise<void> {
  await requerirSeccion("banners");
  invalidarTienda();
  const id = idObligatorio(formData);
  const supabase = await createClient();

  const { data: banner } = await supabase.from("banners").select("imagen_url, imagen_movil_url").eq("id", id).maybeSingle();
  if (!banner) redirect(`${RUTA}?error=permiso`);
  const { data, error } = await supabase.from("banners").delete().eq("id", id).select("id");
  if (error || !data?.length) redirect(`${RUTA}?error=permiso`);

  // Con la fila ya borrada, se limpian los archivos (si falla, solo queda un archivo suelto).
  const urlSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (urlSupabase) {
    const rutas = [banner.imagen_url, banner.imagen_movil_url]
      .flatMap((u) => (u ? [rutaDesdeUrl(urlSupabase, u)] : []))
      .filter((r): r is string => r !== null);
    if (rutas.length > 0) await supabase.storage.from(BUCKET).remove(rutas);
  }
  redirect(`${RUTA}?ok=banner-eliminado`);
}
