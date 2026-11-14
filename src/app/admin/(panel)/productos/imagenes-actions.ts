"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requerirRol } from "@/lib/auth";
import {
  BUCKET,
  esUuid,
  LIMITES,
  rutaDesdeUrl,
  rutasDeImagen,
  urlPublica,
} from "@/lib/catalogo/imagenes";
import { reordenar } from "@/lib/orden";
import { createClient } from "@/lib/supabase/server";
import { idDeFormulario } from "@/lib/validaciones/catalogo";
import { textoDe } from "@/lib/validaciones/comun";

const ROLES_ESCRITURA = ["admin", "editor"] as const;

const urlSupabase = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/** Vuelve a la pantalla del producto, a la sección de imágenes. */
const volver = (productoId: number, aviso: string) =>
  `/admin/productos/${productoId}?ok=${aviso}#imagenes`;

const registroSchema = z.object({
  productoId: z.number().int().positive(),
  ids: z.array(z.string().refine(esUuid)).min(1).max(LIMITES.maxPorProducto),
});

export type ResultadoRegistro = { ok?: true; error?: string };

/**
 * Registra en la base las imágenes que el navegador YA subió a Storage.
 * Solo recibe identificadores (UUID): las rutas y URLs las arma el servidor y se
 * verifica que los dos archivos (principal y miniatura) existan de verdad.
 */
export async function registrarImagenes(
  productoId: number,
  ids: string[],
): Promise<ResultadoRegistro> {
  await requerirRol(ROLES_ESCRITURA);
  const parsed = registroSchema.safeParse({ productoId, ids });
  if (!parsed.success) return { error: "No se pudo leer la subida." };

  const supabase = await createClient();
  const rutasSubidas = parsed.data.ids.flatMap((id) => {
    const r = rutasDeImagen(parsed.data.productoId, id);
    return [r.grande, r.miniatura];
  });
  const limpiar = () => supabase.storage.from(BUCKET).remove(rutasSubidas);

  const { data: existentes, error: errorLectura } = await supabase
    .from("producto_imagenes")
    .select("orden, es_principal")
    .eq("producto_id", parsed.data.productoId);
  if (errorLectura) {
    await limpiar();
    return { error: "No pudimos leer las imágenes del producto." };
  }
  if (
    (existentes?.length ?? 0) + parsed.data.ids.length >
    LIMITES.maxPorProducto
  ) {
    await limpiar();
    return { error: `Máximo ${LIMITES.maxPorProducto} imágenes por producto.` };
  }

  // Los archivos tienen que estar realmente en el bucket.
  const { data: archivos } = await supabase.storage
    .from(BUCKET)
    .list(`productos/${parsed.data.productoId}`, { limit: 200 });
  const nombres = new Set((archivos ?? []).map((a) => a.name));
  const faltan = parsed.data.ids.some(
    (id) => !nombres.has(`${id}.webp`) || !nombres.has(`${id}-m.webp`),
  );
  if (faltan) return { error: "La subida no se completó. Inténtalo de nuevo." };

  const hayPrincipal = (existentes ?? []).some((i) => i.es_principal);
  const maxOrden = Math.max(0, ...(existentes ?? []).map((i) => i.orden));
  const filas = parsed.data.ids.map((id, i) => {
    const r = rutasDeImagen(parsed.data.productoId, id);
    return {
      producto_id: parsed.data.productoId,
      url: urlPublica(urlSupabase(), r.grande),
      url_miniatura: urlPublica(urlSupabase(), r.miniatura),
      orden: maxOrden + i + 1,
      // La primera imagen de un producto es la principal.
      es_principal: !hayPrincipal && i === 0,
    };
  });

  const { error } = await supabase.from("producto_imagenes").insert(filas);
  if (error) {
    await limpiar();
    return {
      error:
        error.code === "42501"
          ? "No tienes permiso para agregar imágenes."
          : "No pudimos guardar las imágenes. Inténtalo de nuevo.",
    };
  }
  return { ok: true };
}

/** Lee `id` y `producto` del formulario o vuelve a la lista con un error. */
function idsDeFormulario(formData: FormData) {
  const imagen = idDeFormulario.safeParse(textoDe(formData, "id"));
  const producto = idDeFormulario.safeParse(textoDe(formData, "producto"));
  if (!imagen.success || !producto.success) {
    redirect("/admin/productos?error=generico");
  }
  return { imagenId: imagen.data, productoId: producto.data };
}

/** Marca una imagen como la principal del producto (la de la tarjeta y la lista). */
export async function marcarImagenPrincipal(formData: FormData): Promise<void> {
  await requerirRol(ROLES_ESCRITURA);
  const { imagenId, productoId } = idsDeFormulario(formData);
  const supabase = await createClient();

  // Debe ser una imagen de ESTE producto.
  const { data: imagen } = await supabase
    .from("producto_imagenes")
    .select("id")
    .eq("id", imagenId)
    .eq("producto_id", productoId)
    .maybeSingle();
  if (!imagen)
    redirect(`/admin/productos/${productoId}?error=permiso#imagenes`);

  // Solo puede haber una principal (índice único): primero se quita la actual.
  const { error: e1 } = await supabase
    .from("producto_imagenes")
    .update({ es_principal: false })
    .eq("producto_id", productoId)
    .eq("es_principal", true);
  const { error: e2 } = await supabase
    .from("producto_imagenes")
    .update({ es_principal: true })
    .eq("id", imagenId);
  if (e1 || e2)
    redirect(`/admin/productos/${productoId}?error=generico#imagenes`);

  redirect(volver(productoId, "imagen-principal"));
}

/** Sube o baja una imagen en el orden de la galería (botones ↑ ↓). */
export async function moverImagen(formData: FormData): Promise<void> {
  await requerirRol(ROLES_ESCRITURA);
  const { imagenId, productoId } = idsDeFormulario(formData);
  const direccion = textoDe(formData, "direccion");
  if (direccion !== "arriba" && direccion !== "abajo") {
    redirect(`/admin/productos/${productoId}#imagenes`);
  }

  const supabase = await createClient();
  const { data: lista } = await supabase
    .from("producto_imagenes")
    .select("id, orden")
    .eq("producto_id", productoId);

  for (const cambio of reordenar(lista ?? [], imagenId, direccion)) {
    const { error } = await supabase
      .from("producto_imagenes")
      .update({ orden: cambio.orden })
      .eq("id", cambio.id);
    if (error)
      redirect(`/admin/productos/${productoId}?error=generico#imagenes`);
  }
  redirect(`/admin/productos/${productoId}#imagenes`);
}

/** Elimina una imagen (fila y archivos). Si era la principal, la siguiente pasa a serlo. */
export async function eliminarImagen(formData: FormData): Promise<void> {
  await requerirRol(ROLES_ESCRITURA);
  const { imagenId, productoId } = idsDeFormulario(formData);
  const supabase = await createClient();

  const { data: imagen } = await supabase
    .from("producto_imagenes")
    .select("id, url, url_miniatura, es_principal")
    .eq("id", imagenId)
    .eq("producto_id", productoId)
    .maybeSingle();
  if (!imagen)
    redirect(`/admin/productos/${productoId}?error=permiso#imagenes`);

  const { data: borradas, error } = await supabase
    .from("producto_imagenes")
    .delete()
    .eq("id", imagenId)
    .select("id");
  if (error || !borradas?.length) {
    redirect(`/admin/productos/${productoId}?error=permiso#imagenes`);
  }

  // Se borran los archivos del bucket. `rutaDesdeUrl` solo acepta rutas de NUESTRO
  // bucket, así que nunca se borra algo ajeno. Si falla, queda un archivo huérfano
  // (sin efecto visible) y no se bloquea la operación.
  const rutas = [imagen.url, imagen.url_miniatura]
    .filter((u): u is string => Boolean(u))
    .map((u) => rutaDesdeUrl(urlSupabase(), u))
    .filter((r): r is string => r !== null);
  if (rutas.length > 0) await supabase.storage.from(BUCKET).remove(rutas);

  if (imagen.es_principal) {
    const { data: siguiente } = await supabase
      .from("producto_imagenes")
      .select("id")
      .eq("producto_id", productoId)
      .order("orden")
      .order("id")
      .limit(1);
    if (siguiente?.[0]) {
      await supabase
        .from("producto_imagenes")
        .update({ es_principal: true })
        .eq("id", siguiente[0].id);
    }
  }
  redirect(volver(productoId, "imagen-eliminada"));
}
