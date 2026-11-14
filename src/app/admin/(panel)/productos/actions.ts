"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requerirRol } from "@/lib/auth";
import { slugLibre } from "@/lib/catalogo/slugs";
import { armarPayload, valoresDesdeBD } from "@/lib/catalogo/producto-form";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import { idDeFormulario } from "@/lib/validaciones/catalogo";
import { erroresPorRuta, textoDe } from "@/lib/validaciones/comun";
import {
  productoSchema,
  type ProductoFormValues,
} from "@/lib/validaciones/producto";
import { invalidarTienda } from "@/lib/tienda/invalidar";

/** Solo admin y editor escriben en el catálogo; el vendedor únicamente mira. */
const ROLES_ESCRITURA = ["admin", "editor"] as const;

export type ResultadoGuardado = {
  /** Error general (no atribuible a un campo concreto). */
  error?: string;
  /** Errores por ruta de campo, p. ej. "variantes.0.precio_mayor". */
  errores?: Record<string, string>;
};

type ErrorSupabase = { code?: string; message: string };

/** Traduce un error de la función guardar_producto a un mensaje para la persona. */
function mensajeDeGuardado(error: ErrorSupabase): string {
  if (error.message.includes("variantes_sku_key")) {
    return "Ya existe otra presentación con ese SKU. Cámbialo o déjalo vacío para que se genere solo.";
  }
  switch (error.code) {
    case "42501":
      return "No tienes permiso para guardar productos.";
    case "23503":
      // Mensajes propios de la función (p. ej. "…ya tiene pedidos") o llave foránea.
      return error.message.includes("pedidos")
        ? error.message
        : "La categoría o la marca elegida ya no existe. Recarga la página.";
    case "23514":
      return "Algún dato de las presentaciones no es válido. Revisa los precios y las cantidades.";
    case "P0001":
    case "P0002":
      return error.message;
    default:
      return "No pudimos guardar el producto. Inténtalo de nuevo.";
  }
}

/**
 * Crea o edita un producto con todas sus presentaciones, en una sola
 * transacción (función SQL guardar_producto). Si todo sale bien, redirige a la
 * pantalla de edición del producto; si no, devuelve los errores.
 */
export async function guardarProducto(
  entrada: ProductoFormValues,
): Promise<ResultadoGuardado> {
  await requerirRol(ROLES_ESCRITURA);

  // El navegador ya validó, pero aquí se valida DE NUEVO: nunca se confía en él.
  const parsed = productoSchema.safeParse(entrada);
  if (!parsed.success) {
    return { errores: erroresPorRuta(parsed.error) };
  }
  const producto = parsed.data;
  const supabase = await createClient();
  const esNuevo = producto.id === "";

  let idGuardado: number | null = null;
  let intento = 0;
  while (idGuardado === null) {
    // El slug (la URL) solo se calcula al crear; al editar no cambia.
    const slug = esNuevo
      ? await slugLibre(supabase, "productos", slugify(producto.nombre))
      : undefined;
    const { data, error } = await supabase.rpc(
      "guardar_producto",
      armarPayload(producto, slug),
    );
    if (!error) {
      idGuardado = data;
      break;
    }
    // Dos personas crearon el mismo nombre a la vez: se reintenta una vez con otro slug.
    if (
      esNuevo &&
      error.code === "23505" &&
      error.message.includes("productos_slug_key") &&
      intento++ < 1
    ) {
      continue;
    }
    return { error: mensajeDeGuardado(error) };
  }

  invalidarTienda();
  redirect(`/admin/productos/${idGuardado}?ok=producto-guardado`);
}

/**
 * Duplica un producto con todas sus presentaciones (RF-24). La copia queda
 * INACTIVA y con SKUs nuevos, para no publicar nada por accidente.
 */
export async function duplicarProducto(formData: FormData): Promise<void> {
  await requerirRol(ROLES_ESCRITURA);
  const parsedId = idDeFormulario.safeParse(textoDe(formData, "id"));
  if (!parsedId.success) redirect("/admin/productos?error=generico");
  const id = parsedId.data;

  const supabase = await createClient();
  const [{ data: original }, { data: variantes }] = await Promise.all([
    supabase.from("productos").select("*").eq("id", id).maybeSingle(),
    supabase.from("variantes").select("*").eq("producto_id", id),
  ]);
  if (!original || !variantes?.length) {
    redirect("/admin/productos?error=permiso");
  }

  const valores = valoresDesdeBD(original, variantes);
  valores.id = "";
  valores.nombre = `${original.nombre} (copia)`.slice(0, 120);
  valores.activo = false;
  valores.variantes = valores.variantes.map((v) => ({ ...v, id: "", sku: "" }));

  const parsed = productoSchema.safeParse(valores);
  if (!parsed.success) redirect("/admin/productos?error=generico");

  const slug = await slugLibre(
    supabase,
    "productos",
    slugify(parsed.data.nombre),
  );
  const { data: nuevoId, error } = await supabase.rpc(
    "guardar_producto",
    armarPayload(parsed.data, slug),
  );
  if (error || nuevoId === null) redirect("/admin/productos?error=generico");

  invalidarTienda();
  redirect(`/admin/productos/${nuevoId}?ok=producto-duplicado`);
}

const accionMasivaSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(200),
  accion: z.enum(["activar", "desactivar", "categoria"]),
  categoriaId: z.number().int().positive().nullable(),
});
export type AccionMasivaInput = z.input<typeof accionMasivaSchema>;

export type ResultadoMasivo = { ok?: string; error?: string };

/** Activa, desactiva o cambia de categoría a varios productos a la vez. */
export async function aplicarAccionMasiva(
  entrada: AccionMasivaInput,
): Promise<ResultadoMasivo> {
  await requerirRol(ROLES_ESCRITURA);
  const parsed = accionMasivaSchema.safeParse(entrada);
  if (!parsed.success) return { error: "No se pudo leer la selección." };
  const { ids, accion, categoriaId } = parsed.data;

  const supabase = await createClient();

  let cambios: { activo: boolean } | { categoria_id: number };
  if (accion === "categoria") {
    if (categoriaId === null)
      return { error: "Elige la categoría de destino." };
    cambios = { categoria_id: categoriaId };
  } else {
    cambios = { activo: accion === "activar" };
  }

  const { data, error } = await supabase
    .from("productos")
    .update(cambios)
    .in("id", ids)
    .select("id");
  if (error)
    return { error: "No pudimos aplicar el cambio. Inténtalo de nuevo." };

  const n = data?.length ?? 0;
  if (n === 0)
    return { error: "No tienes permiso o los productos ya no existen." };

  invalidarTienda();
  const verbo =
    accion === "activar"
      ? "activados"
      : accion === "desactivar"
        ? "desactivados"
        : "movidos de categoría";
  return { ok: `${n} ${n === 1 ? "producto" : "productos"} ${verbo}.` };
}
