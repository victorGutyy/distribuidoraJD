"use server";

import { redirect } from "next/navigation";
import { requerirSeccion } from "@/lib/auth";
import { codigoDeError } from "@/lib/avisos";
import { invalidarTienda } from "@/lib/tienda/invalidar";
import { createClient } from "@/lib/supabase/server";
import { idDeFormulario } from "@/lib/validaciones/catalogo";
import {
  erroresPorCampo,
  textoDe,
  type EstadoFormulario,
} from "@/lib/validaciones/comun";
import { sectorSchema } from "@/lib/validaciones/zonas";

const RUTA = "/admin/zonas";

/** Escapa % _ \ para usarlos como texto literal dentro de un ILIKE. */
const escaparLike = (texto: string) => texto.replace(/[\\%_]/g, "\\$&");

function idObligatorio(formData: FormData): number {
  const parsed = idDeFormulario.safeParse(textoDe(formData, "id"));
  if (!parsed.success) redirect(`${RUTA}?error=generico`);
  return parsed.data;
}

/** Crea o edita un sector de reparto (si el formulario trae `id`, edita). */
export async function guardarSector(
  _estadoPrevio: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await requerirSeccion("zonas");
  invalidarTienda();

  const valores = {
    municipio_id: textoDe(formData, "municipio_id"),
    nombre: textoDe(formData, "nombre"),
    costo_envio: textoDe(formData, "costo_envio"),
  };
  const parsed = sectorSchema.safeParse({
    ...valores,
    dias: formData.getAll("dias").filter((d): d is string => typeof d === "string"),
    activo: formData.get("activo") === "on",
  });
  if (!parsed.success) {
    return { errores: erroresPorCampo(parsed.error), valores };
  }
  const { municipio_id, nombre, dias, costo_envio, activo } = parsed.data;

  const idTexto = textoDe(formData, "id");
  const editandoId = idTexto ? idObligatorio(formData) : null;
  const supabase = await createClient();

  // Nombre repetido dentro del mismo municipio (sin importar mayúsculas).
  let repetidos = supabase
    .from("sectores")
    .select("id")
    .eq("municipio_id", municipio_id)
    .ilike("nombre", escaparLike(nombre));
  if (editandoId !== null) repetidos = repetidos.neq("id", editandoId);
  const { data: yaExiste } = await repetidos.limit(1);
  if (yaExiste?.length) {
    return {
      errores: { nombre: ["Ya hay un sector con ese nombre en este municipio"] },
      valores,
    };
  }

  const fila = { municipio_id, nombre, dias_reparto: dias, costo_envio, activo };
  const { error } =
    editandoId !== null
      ? await supabase.from("sectores").update(fila).eq("id", editandoId)
      : await supabase.from("sectores").insert(fila);
  if (error) {
    return {
      error:
        error.code === "42501"
          ? "No tienes permiso para guardar sectores."
          : error.code === "23503"
            ? "El municipio elegido ya no existe. Recarga la página."
            : "No pudimos guardar el sector. Inténtalo de nuevo.",
      valores,
    };
  }
  redirect(`${RUTA}?ok=${editandoId !== null ? "sector-actualizado" : "sector-creado"}`);
}

/** Activa o desactiva un sector. */
export async function alternarSector(formData: FormData): Promise<void> {
  await requerirSeccion("zonas");
  invalidarTienda();
  const id = idObligatorio(formData);
  const supabase = await createClient();

  const { data: actual } = await supabase
    .from("sectores")
    .select("activo")
    .eq("id", id)
    .maybeSingle();
  if (!actual) redirect(`${RUTA}?error=permiso`);

  const { data, error } = await supabase
    .from("sectores")
    .update({ activo: !actual.activo })
    .eq("id", id)
    .select("id");
  if (error) redirect(`${RUTA}?error=${codigoDeError(error)}`);
  if (!data?.length) redirect(`${RUTA}?error=permiso`);

  redirect(`${RUTA}?ok=${actual.activo ? "sector-desactivado" : "sector-activado"}`);
}

/** Elimina un sector SOLO si no tiene pedidos ni clientes (lo impide una llave foránea). */
export async function eliminarSector(formData: FormData): Promise<void> {
  await requerirSeccion("zonas");
  invalidarTienda();
  const id = idObligatorio(formData);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sectores")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) {
    redirect(`${RUTA}?error=${error.code === "23503" ? "sector-con-pedidos" : codigoDeError(error)}`);
  }
  if (!data?.length) redirect(`${RUTA}?error=permiso`);

  redirect(`${RUTA}?ok=sector-eliminado`);
}

/** Activa o desactiva un municipio (sus sectores dejan de ofrecerse en la tienda). */
export async function alternarMunicipio(formData: FormData): Promise<void> {
  await requerirSeccion("zonas");
  invalidarTienda();
  const id = idObligatorio(formData);
  const supabase = await createClient();

  const { data: actual } = await supabase
    .from("municipios")
    .select("activo")
    .eq("id", id)
    .maybeSingle();
  if (!actual) redirect(`${RUTA}?error=permiso`);

  const { data, error } = await supabase
    .from("municipios")
    .update({ activo: !actual.activo })
    .eq("id", id)
    .select("id");
  if (error) redirect(`${RUTA}?error=${codigoDeError(error)}`);
  if (!data?.length) redirect(`${RUTA}?error=permiso`);

  redirect(`${RUTA}?ok=${actual.activo ? "municipio-desactivado" : "municipio-activado"}`);
}
