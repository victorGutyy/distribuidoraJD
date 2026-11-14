"use server";

import { redirect } from "next/navigation";
import { requerirSeccion } from "@/lib/auth";
import { codigoDeError } from "@/lib/avisos";
import { slugLibre } from "@/lib/catalogo/slugs";
import { reordenar } from "@/lib/orden";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import { categoriaSchema, idDeFormulario } from "@/lib/validaciones/catalogo";
import {
  erroresPorCampo,
  textoDe,
  type EstadoFormulario,
} from "@/lib/validaciones/comun";

const RUTA = "/admin/categorias";

/** Escapa % _ \ para usarlos como texto literal dentro de un ILIKE. */
const escaparLike = (texto: string) => texto.replace(/[\\%_]/g, "\\$&");

/** Lee el id de un formulario; si no es válido, vuelve a la lista con un error. */
function idObligatorio(formData: FormData): number {
  const parsed = idDeFormulario.safeParse(textoDe(formData, "id"));
  if (!parsed.success) redirect(`${RUTA}?error=generico`);
  return parsed.data;
}

/** Crea o edita una categoría (si el formulario trae `id`, edita). */
export async function guardarCategoria(
  _estadoPrevio: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await requerirSeccion("categorias");

  const valores = {
    nombre: textoDe(formData, "nombre"),
    parent_id: textoDe(formData, "parent_id"),
  };
  const parsed = categoriaSchema.safeParse({
    ...valores,
    activa: formData.get("activa") === "on",
  });
  if (!parsed.success) {
    return { errores: erroresPorCampo(parsed.error), valores };
  }
  const { nombre, parent_id, activa } = parsed.data;

  const idTexto = textoDe(formData, "id");
  const editandoId = idTexto ? idObligatorio(formData) : null;
  const supabase = await createClient();

  // --- Reglas de las 2 niveles (RF-22). La base también las exige con un
  //     disparador, pero aquí damos un mensaje claro en el campo correcto.
  if (parent_id !== null) {
    if (editandoId === parent_id) {
      return {
        errores: {
          parent_id: ["Una categoría no puede ser subcategoría de sí misma"],
        },
        valores,
      };
    }
    const { data: padre } = await supabase
      .from("categorias")
      .select("id, parent_id")
      .eq("id", parent_id)
      .maybeSingle();
    if (!padre) {
      return {
        errores: { parent_id: ["Esa categoría ya no existe"] },
        valores,
      };
    }
    if (padre.parent_id !== null) {
      return {
        errores: {
          parent_id: [
            "Solo hay 2 niveles: elige una categoría principal, no una subcategoría",
          ],
        },
        valores,
      };
    }
    if (editandoId !== null) {
      const { count } = await supabase
        .from("categorias")
        .select("id", { count: "exact", head: true })
        .eq("parent_id", editandoId);
      if (count) {
        return {
          errores: {
            parent_id: [
              "Esta categoría tiene subcategorías, así que no puede volverse subcategoría",
            ],
          },
          valores,
        };
      }
    }
  }

  // --- Nombre repetido dentro del mismo nivel (sin importar mayúsculas).
  let repetidas = supabase
    .from("categorias")
    .select("id")
    .ilike("nombre", escaparLike(nombre));
  repetidas =
    parent_id === null
      ? repetidas.is("parent_id", null)
      : repetidas.eq("parent_id", parent_id);
  if (editandoId !== null) repetidas = repetidas.neq("id", editandoId);
  const { data: yaExiste } = await repetidas.limit(1);
  if (yaExiste?.length) {
    return {
      errores: {
        nombre: ["Ya hay una categoría con ese nombre en este nivel"],
      },
      valores,
    };
  }

  if (editandoId !== null) {
    // El slug (la URL) NO cambia al renombrar: así no se rompen enlaces ya compartidos.
    const { error } = await supabase
      .from("categorias")
      .update({ nombre, parent_id, activa })
      .eq("id", editandoId);
    if (error) {
      return {
        error:
          error.code === "P0001"
            ? error.message
            : "No pudimos guardar los cambios. Inténtalo de nuevo.",
        valores,
      };
    }
    redirect(`${RUTA}?ok=categoria-actualizada`);
  }

  // --- Crear: se coloca al final de su nivel.
  let ultima = supabase
    .from("categorias")
    .select("orden")
    .order("orden", { ascending: false })
    .limit(1);
  ultima =
    parent_id === null
      ? ultima.is("parent_id", null)
      : ultima.eq("parent_id", parent_id);
  const { data: filaFinal } = await ultima;
  const orden = (filaFinal?.[0]?.orden ?? 0) + 1;

  let intento = 0;
  while (true) {
    const slug = await slugLibre(supabase, "categorias", slugify(nombre));
    const { error } = await supabase
      .from("categorias")
      .insert({ nombre, slug, parent_id, activa, orden });
    if (!error) break;
    // Choque de slug con otra persona que creó lo mismo a la vez: se reintenta una vez.
    if (error.code === "23505" && intento++ < 1) continue;
    return {
      error:
        error.code === "P0001"
          ? error.message
          : error.code === "42501"
            ? "No tienes permiso para crear categorías."
            : "No pudimos crear la categoría. Inténtalo de nuevo.",
      valores,
    };
  }
  redirect(`${RUTA}?ok=categoria-creada`);
}

/** Activa o desactiva una categoría. Al desactivar, sus productos salen de la tienda. */
export async function alternarCategoria(formData: FormData): Promise<void> {
  await requerirSeccion("categorias");
  const id = idObligatorio(formData);
  const supabase = await createClient();

  const { data: actual } = await supabase
    .from("categorias")
    .select("activa")
    .eq("id", id)
    .maybeSingle();
  if (!actual) redirect(`${RUTA}?error=permiso`);

  const { data, error } = await supabase
    .from("categorias")
    .update({ activa: !actual.activa })
    .eq("id", id)
    .select("id");
  if (error) redirect(`${RUTA}?error=${codigoDeError(error)}`);
  if (!data?.length) redirect(`${RUTA}?error=permiso`);

  redirect(
    `${RUTA}?ok=${actual.activa ? "categoria-desactivada" : "categoria-activada"}`,
  );
}

/** Sube o baja una categoría dentro de su nivel (botones ↑ ↓). */
export async function moverCategoria(formData: FormData): Promise<void> {
  await requerirSeccion("categorias");
  const id = idObligatorio(formData);
  const direccion = textoDe(formData, "direccion");
  if (direccion !== "arriba" && direccion !== "abajo") redirect(RUTA);

  const supabase = await createClient();
  const { data: cat } = await supabase
    .from("categorias")
    .select("id, parent_id")
    .eq("id", id)
    .maybeSingle();
  if (!cat) redirect(`${RUTA}?error=permiso`);

  let hermanas = supabase.from("categorias").select("id, orden");
  hermanas =
    cat.parent_id === null
      ? hermanas.is("parent_id", null)
      : hermanas.eq("parent_id", cat.parent_id);
  const { data: lista } = await hermanas;

  const cambios = reordenar(lista ?? [], id, direccion);
  for (const cambio of cambios) {
    const { error } = await supabase
      .from("categorias")
      .update({ orden: cambio.orden })
      .eq("id", cambio.id);
    if (error) redirect(`${RUTA}?error=${codigoDeError(error)}`);
  }
  redirect(RUTA);
}

/**
 * Elimina una categoría SOLO si está vacía (sin productos ni subcategorías):
 * la base lo impide con una llave foránea y aquí se traduce a un aviso claro.
 */
export async function eliminarCategoria(formData: FormData): Promise<void> {
  await requerirSeccion("categorias");
  const id = idObligatorio(formData);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categorias")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) redirect(`${RUTA}?error=${codigoDeError(error)}`);
  if (!data?.length) redirect(`${RUTA}?error=permiso`);

  redirect(`${RUTA}?ok=categoria-eliminada`);
}
