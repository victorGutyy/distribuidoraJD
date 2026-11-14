"use server";

import { redirect } from "next/navigation";
import { requerirSeccion } from "@/lib/auth";
import { codigoDeError } from "@/lib/avisos";
import { slugLibre } from "@/lib/catalogo/slugs";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import { idDeFormulario, marcaSchema } from "@/lib/validaciones/catalogo";
import {
  erroresPorCampo,
  textoDe,
  type EstadoFormulario,
} from "@/lib/validaciones/comun";
import { invalidarTienda } from "@/lib/tienda/invalidar";

const RUTA = "/admin/marcas";

/** Escapa % _ \ para usarlos como texto literal dentro de un ILIKE. */
const escaparLike = (texto: string) => texto.replace(/[\\%_]/g, "\\$&");

function idObligatorio(formData: FormData): number {
  const parsed = idDeFormulario.safeParse(textoDe(formData, "id"));
  if (!parsed.success) redirect(`${RUTA}?error=generico`);
  return parsed.data;
}

/** Crea o edita una marca (si el formulario trae `id`, edita). */
export async function guardarMarca(
  _estadoPrevio: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await requerirSeccion("marcas");
  invalidarTienda();

  const valores = { nombre: textoDe(formData, "nombre") };
  const parsed = marcaSchema.safeParse({
    ...valores,
    activa: formData.get("activa") === "on",
  });
  if (!parsed.success) {
    return { errores: erroresPorCampo(parsed.error), valores };
  }
  const { nombre, activa } = parsed.data;

  const idTexto = textoDe(formData, "id");
  const editandoId = idTexto ? idObligatorio(formData) : null;
  const supabase = await createClient();

  // Nombre repetido (sin importar mayúsculas).
  let repetidas = supabase
    .from("marcas")
    .select("id")
    .ilike("nombre", escaparLike(nombre));
  if (editandoId !== null) repetidas = repetidas.neq("id", editandoId);
  const { data: yaExiste } = await repetidas.limit(1);
  if (yaExiste?.length) {
    return {
      errores: { nombre: ["Ya hay una marca con ese nombre"] },
      valores,
    };
  }

  if (editandoId !== null) {
    // El slug no cambia al renombrar (no se rompen los enlaces con filtros por marca).
    const { error } = await supabase
      .from("marcas")
      .update({ nombre, activa })
      .eq("id", editandoId);
    if (error) {
      return {
        error: "No pudimos guardar los cambios. Inténtalo de nuevo.",
        valores,
      };
    }
    redirect(`${RUTA}?ok=marca-actualizada`);
  }

  let intento = 0;
  while (true) {
    const slug = await slugLibre(supabase, "marcas", slugify(nombre));
    const { error } = await supabase
      .from("marcas")
      .insert({ nombre, slug, activa });
    if (!error) break;
    if (error.code === "23505" && intento++ < 1) continue;
    return {
      error:
        error.code === "42501"
          ? "No tienes permiso para crear marcas."
          : "No pudimos crear la marca. Inténtalo de nuevo.",
      valores,
    };
  }
  redirect(`${RUTA}?ok=marca-creada`);
}

/** Activa o desactiva una marca. */
export async function alternarMarca(formData: FormData): Promise<void> {
  await requerirSeccion("marcas");
  invalidarTienda();
  const id = idObligatorio(formData);
  const supabase = await createClient();

  const { data: actual } = await supabase
    .from("marcas")
    .select("activa")
    .eq("id", id)
    .maybeSingle();
  if (!actual) redirect(`${RUTA}?error=permiso`);

  const { data, error } = await supabase
    .from("marcas")
    .update({ activa: !actual.activa })
    .eq("id", id)
    .select("id");
  if (error) redirect(`${RUTA}?error=${codigoDeError(error)}`);
  if (!data?.length) redirect(`${RUTA}?error=permiso`);

  redirect(
    `${RUTA}?ok=${actual.activa ? "marca-desactivada" : "marca-activada"}`,
  );
}

/** Elimina una marca SOLO si ningún producto la usa (lo impide una llave foránea). */
export async function eliminarMarca(formData: FormData): Promise<void> {
  await requerirSeccion("marcas");
  invalidarTienda();
  const id = idObligatorio(formData);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("marcas")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) redirect(`${RUTA}?error=${codigoDeError(error)}`);
  if (!data?.length) redirect(`${RUTA}?error=permiso`);

  redirect(`${RUTA}?ok=marca-eliminada`);
}
