"use server";

import { z } from "zod";
import { requerirRol } from "@/lib/auth";
import {
  COLUMNAS_CATALOGO,
  type ModoImportacion,
} from "@/lib/importacion/columnas";
import {
  compararCatalogo,
  compararPrecios,
  type Cambio,
  type EstadoFila,
  type VarianteExistente,
} from "@/lib/importacion/comparar";
import {
  payloadCatalogo,
  payloadPrecios,
  validarFilaCatalogo,
  validarFilaPrecios,
  type FilaCatalogo,
  type FilaPrecios,
} from "@/lib/importacion/fila";
import {
  aVarianteExistente,
  SELECT_VARIANTE_EXISTENTE,
  type FilaBD,
} from "@/lib/importacion/leer-bd";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

/** Solo admin y editor importan (la función SQL lo vuelve a comprobar). */
const ROLES_ESCRITURA = ["admin", "editor"] as const;

/** Tope por llamada: el navegador reparte el archivo en trozos más pequeños. */
const MAX_FILAS_LLAMADA = 500;

const entradaSchema = z.object({
  modo: z.enum(["catalogo", "precios"]),
  filas: z
    .array(
      z.object({
        fila: z.number().int().positive(),
        datos: z.partialRecord(z.enum(COLUMNAS_CATALOGO), z.string().max(3000)),
      }),
    )
    .min(1)
    .max(MAX_FILAS_LLAMADA),
});
export type EntradaImportacion = z.input<typeof entradaSchema>;

export type FilaVista = {
  fila: number;
  estado: EstadoFila | "error";
  errores: string[];
  cambios: Cambio[];
  /** Para reconocer la fila en la tabla de vista previa. */
  sku: string | null;
  producto: string | null;
  presentacion: string | null;
};

export type ResultadoVistaPrevia = { error?: string; filas?: FilaVista[] };

type ValidaCatalogo = { fila: number; ok: true; datos: FilaCatalogo };
type ValidaPrecios = { fila: number; ok: true; datos: FilaPrecios };

/** Trae las presentaciones guardadas con esos SKU (en grupos, por el largo de la URL). */
async function presentacionesPorSku(
  skus: string[],
): Promise<Map<string, VarianteExistente> | null> {
  const supabase = await createClient();
  const encontradas = new Map<string, VarianteExistente>();
  for (let i = 0; i < skus.length; i += 100) {
    const { data, error } = await supabase
      .from("variantes")
      .select(SELECT_VARIANTE_EXISTENTE)
      .in("sku", skus.slice(i, i + 100));
    if (error) return null;
    for (const fila of (data ?? []) as unknown as FilaBD[]) {
      const v = aVarianteExistente(fila);
      encontradas.set(v.sku, v);
    }
  }
  return encontradas;
}

/**
 * Valida las filas del archivo y las compara con lo guardado, SIN escribir nada.
 * Devuelve, por fila, si se crearía, se actualizaría (con "antes → después"), no
 * cambiaría o tiene errores.
 */
export async function previsualizarImportacion(
  entrada: EntradaImportacion,
): Promise<ResultadoVistaPrevia> {
  await requerirRol(ROLES_ESCRITURA);
  const parsed = entradaSchema.safeParse(entrada);
  if (!parsed.success) return { error: "No se pudo leer el archivo." };
  const { modo, filas } = parsed.data;

  const vistas: FilaVista[] = [];
  const validas: (ValidaCatalogo | ValidaPrecios)[] = [];

  for (const { fila, datos } of filas) {
    const base = {
      fila,
      sku: datos.sku?.trim() || null,
      producto: datos.producto?.trim() || null,
      presentacion: datos.presentacion?.trim() || null,
    };
    const r =
      modo === "precios" ? validarFilaPrecios(datos) : validarFilaCatalogo(datos);
    if (!r.ok) {
      vistas.push({ ...base, estado: "error", errores: r.errores, cambios: [] });
    } else {
      validas.push({ fila, ok: true, datos: r.fila as never });
      vistas.push({ ...base, estado: "sin_cambios", errores: [], cambios: [] });
    }
  }

  const skus = validas
    .map((v) => v.datos.sku)
    .filter((s): s is string => Boolean(s));
  const existentes = await presentacionesPorSku([...new Set(skus)]);
  if (!existentes) {
    return { error: "No pudimos consultar el catálogo. Inténtalo de nuevo." };
  }

  const porFila = new Map(vistas.map((v) => [v.fila, v]));
  for (const v of validas) {
    const vista = porFila.get(v.fila)!;
    const actual = v.datos.sku ? existentes.get(v.datos.sku) : undefined;
    if (modo === "precios") {
      const c = compararPrecios(v.datos as FilaPrecios, actual);
      if (!c) {
        vista.estado = "error";
        vista.errores = ["sku: no existe ninguna presentación con este SKU"];
      } else {
        vista.estado = c.estado;
        vista.cambios = c.cambios;
      }
    } else {
      const c = compararCatalogo(v.datos as FilaCatalogo, actual);
      vista.estado = c.estado;
      vista.cambios = c.cambios;
    }
  }
  return { filas: vistas };
}

export type ResultadoLote = {
  error?: string;
  productosCreados: number;
  productosActualizados: number;
  variantesCreadas: number;
  variantesActualizadas: number;
  sinCambios: number;
  categoriasCreadas: number;
  marcasCreadas: number;
  errores: { ref: string; mensaje: string }[];
};

const loteVacio: ResultadoLote = {
  productosCreados: 0,
  productosActualizados: 0,
  variantesCreadas: 0,
  variantesActualizadas: 0,
  sinCambios: 0,
  categoriasCreadas: 0,
  marcasCreadas: 0,
  errores: [],
};

const num = (v: unknown): number => (typeof v === "number" ? v : 0);

/**
 * Guarda un lote de filas (ya revisadas en la vista previa). Se valida DE NUEVO
 * en el servidor: nunca se confía en lo que manda el navegador (RN-06).
 */
export async function aplicarLoteImportacion(
  entrada: EntradaImportacion,
): Promise<ResultadoLote> {
  await requerirRol(ROLES_ESCRITURA);
  const parsed = entradaSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ...loteVacio, error: "No se pudo leer el lote." };
  }
  const { modo, filas } = parsed.data;

  const payload: Record<string, unknown>[] = [];
  const errores: ResultadoLote["errores"] = [];
  for (const { fila, datos } of filas) {
    if (modo === "precios") {
      const r = validarFilaPrecios(datos);
      if (r.ok) payload.push(payloadPrecios(r.fila));
      else errores.push({ ref: `fila ${fila}`, mensaje: r.errores.join("; ") });
    } else {
      const r = validarFilaCatalogo(datos);
      if (r.ok) payload.push(payloadCatalogo(r.fila));
      else errores.push({ ref: `fila ${fila}`, mensaje: r.errores.join("; ") });
    }
  }
  if (payload.length === 0) return { ...loteVacio, errores };

  const supabase = await createClient();
  const rpc =
    modo === "precios"
      ? await supabase.rpc("guardar_precios", { p_filas: payload as Json })
      : await supabase.rpc("importar_catalogo", { p_filas: payload as Json });
  if (rpc.error) {
    return {
      ...loteVacio,
      errores,
      error:
        rpc.error.code === "42501"
          ? "No tienes permiso para importar."
          : "No pudimos guardar este lote. Inténtalo de nuevo.",
    };
  }

  const r = (rpc.data ?? {}) as Record<string, unknown>;
  const delSql = (Array.isArray(r.errores) ? r.errores : []) as Record<
    string,
    string
  >[];
  const erroresSql = delSql.map((e) => ({
    ref: e.sku || e.producto || e.ref || "(sin referencia)",
    mensaje: e.mensaje ?? "Error desconocido",
  }));

  return modo === "precios"
    ? {
        ...loteVacio,
        variantesActualizadas: num(r.actualizadas),
        sinCambios: num(r.sin_cambios),
        errores: [...errores, ...erroresSql],
      }
    : {
        productosCreados: num(r.productos_creados),
        productosActualizados: num(r.productos_actualizados),
        variantesCreadas: num(r.variantes_creadas),
        variantesActualizadas: num(r.variantes_actualizadas),
        sinCambios: num(r.variantes_sin_cambios),
        categoriasCreadas: num(r.categorias_creadas),
        marcasCreadas: num(r.marcas_creadas),
        errores: [...errores, ...erroresSql],
      };
}

const cierreSchema = z.object({
  modo: z.enum(["catalogo", "precios"]),
  archivo: z.string().max(200),
  filasTotal: z.number().int().min(0).max(1_000_000),
  creadas: z.number().int().min(0).max(1_000_000),
  actualizadas: z.number().int().min(0).max(1_000_000),
  errores: z
    .array(z.object({ ref: z.string().max(200), mensaje: z.string().max(500) }))
    .max(2000),
});
export type CierreImportacion = z.input<typeof cierreSchema>;

/** Deja constancia de la importación en la tabla `importaciones` (historial). */
export async function cerrarImportacion(
  entrada: CierreImportacion,
): Promise<{ error?: string }> {
  const perfil = await requerirRol(ROLES_ESCRITURA);
  const parsed = cierreSchema.safeParse(entrada);
  if (!parsed.success) return { error: "No se pudo registrar la importación." };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("importaciones").insert({
    usuario_id: perfil.id,
    tipo: d.modo satisfies ModoImportacion,
    archivo_nombre: d.archivo || null,
    filas_total: d.filasTotal,
    creadas: d.creadas,
    actualizadas: d.actualizadas,
    errores: d.errores.slice(0, 200),
  });
  return error ? { error: "No se pudo registrar la importación." } : {};
}
