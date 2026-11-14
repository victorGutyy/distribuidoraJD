"use client";

import { useCallback, useState } from "react";
import {
  aplicarLoteImportacion,
  cerrarImportacion,
  previsualizarImportacion,
  type FilaVista,
  type ResultadoLote,
} from "@/app/admin/(panel)/importar/actions";
import { leerTabla, type FilaConNumero, type ModoImportacion } from "@/lib/importacion/columnas";
import { ErrorArchivo, leerArchivo } from "@/lib/importacion/leer-archivo";
import { repartirEnLotes, skusRepetidos, trocear } from "@/lib/importacion/lotes";

export type Fase = "inicio" | "leyendo" | "listo" | "aplicando" | "terminado";

export type Resumen = Omit<ResultadoLote, "error"> & {
  /** Filas que la vista previa marcó "sin cambios" o "con error" y no se enviaron. */
  omitidas: number;
  /** Si se cortó a mitad de camino (por ejemplo, se perdió la conexión). */
  interrumpida: boolean;
};

const TROZO_VISTA_PREVIA = 300;
const TROZO_PRECIOS = 300;

const sumar = (a: Resumen, b: ResultadoLote): Resumen => ({
  ...a,
  productosCreados: a.productosCreados + b.productosCreados,
  productosActualizados: a.productosActualizados + b.productosActualizados,
  variantesCreadas: a.variantesCreadas + b.variantesCreadas,
  variantesActualizadas: a.variantesActualizadas + b.variantesActualizadas,
  sinCambios: a.sinCambios + b.sinCambios,
  categoriasCreadas: a.categoriasCreadas + b.categoriasCreadas,
  marcasCreadas: a.marcasCreadas + b.marcasCreadas,
  errores: [...a.errores, ...b.errores],
});

const resumenVacio = (omitidas: number): Resumen => ({
  productosCreados: 0,
  productosActualizados: 0,
  variantesCreadas: 0,
  variantesActualizadas: 0,
  sinCambios: 0,
  categoriasCreadas: 0,
  marcasCreadas: 0,
  errores: [],
  omitidas,
  interrumpida: false,
});

/** Todo el recorrido de una importación: leer → vista previa → confirmar → registrar. */
export function useImportacion() {
  const [modo, setModo] = useState<ModoImportacion>("catalogo");
  const [fase, setFase] = useState<Fase>("inicio");
  const [archivo, setArchivo] = useState("");
  const [filas, setFilas] = useState<FilaConNumero[]>([]);
  const [vistas, setVistas] = useState<FilaVista[]>([]);
  const [progreso, setProgreso] = useState({ hecho: 0, total: 0 });
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ignoradas, setIgnoradas] = useState<string[]>([]);

  const reiniciar = useCallback(() => {
    setFase("inicio");
    setArchivo("");
    setFilas([]);
    setVistas([]);
    setResumen(null);
    setError(null);
    setIgnoradas([]);
  }, []);

  const cambiarModo = (nuevo: ModoImportacion) => {
    setModo(nuevo);
    reiniciar();
  };

  async function elegirArchivo(file: File) {
    reiniciar();
    setFase("leyendo");
    setArchivo(file.name);
    try {
      const lectura = leerTabla(await leerArchivo(file), modo);
      if (lectura.faltantes.length > 0) {
        throw new ErrorArchivo(
          `Al archivo le faltan estas columnas: ${lectura.faltantes.join(", ")}. Descarga la plantilla para ver el formato.`,
        );
      }
      if (lectura.filas.length === 0) {
        throw new ErrorArchivo("El archivo no tiene filas con datos.");
      }

      const todas: FilaVista[] = [];
      const trozos = trocear(lectura.filas, TROZO_VISTA_PREVIA);
      setProgreso({ hecho: 0, total: lectura.filas.length });
      for (const trozo of trozos) {
        const r = await previsualizarImportacion({ modo, filas: trozo });
        if (r.error || !r.filas) throw new ErrorArchivo(r.error ?? "Error al revisar.");
        todas.push(...r.filas);
        setProgreso({ hecho: todas.length, total: lectura.filas.length });
      }

      // El mismo SKU en dos filas del archivo: se avisa en la segunda.
      const repetidos = skusRepetidos(
        lectura.filas.map((f) => ({ fila: f.fila, sku: f.datos.sku || null })),
      );
      for (const v of todas) {
        const aviso = repetidos.get(v.fila);
        if (aviso) {
          v.estado = "error";
          v.errores = [...v.errores, aviso];
        }
      }

      setIgnoradas(lectura.ignoradas);
      setFilas(lectura.filas);
      setVistas(todas);
      setFase("listo");
    } catch (e) {
      setError(
        e instanceof ErrorArchivo
          ? e.message
          : "No pudimos revisar el archivo. Inténtalo de nuevo.",
      );
      setFase("inicio");
    }
  }

  async function confirmar() {
    const estado = new Map(vistas.map((v) => [v.fila, v.estado]));
    const aEnviar = filas.filter((f) => {
      const e = estado.get(f.fila);
      return e === "crear" || e === "actualizar";
    });
    const lotes =
      modo === "precios"
        ? trocear(aEnviar, TROZO_PRECIOS)
        : repartirEnLotes(aEnviar, (f) => f.datos);

    setFase("aplicando");
    setError(null);
    setProgreso({ hecho: 0, total: aEnviar.length });
    let acumulado = resumenVacio(filas.length - aEnviar.length);
    let enviadas = 0;
    for (const lote of lotes) {
      try {
        const r = await aplicarLoteImportacion({ modo, filas: lote });
        acumulado = sumar(acumulado, r);
        if (r.error) throw new Error(r.error);
      } catch (e) {
        acumulado.interrumpida = true;
        setError(
          e instanceof Error && e.message
            ? e.message
            : "Se perdió la conexión. Lo que ya se guardó, quedó guardado.",
        );
        break;
      }
      enviadas += lote.length;
      setProgreso({ hecho: enviadas, total: aEnviar.length });
    }

    await cerrarImportacion({
      modo,
      archivo,
      filasTotal: filas.length,
      creadas: acumulado.variantesCreadas,
      actualizadas: acumulado.variantesActualizadas,
      // El historial guarda máximo 2000 avisos, con textos cortos.
      errores: acumulado.errores.slice(0, 2000).map((e) => ({
        ref: e.ref.slice(0, 200),
        mensaje: e.mensaje.slice(0, 500),
      })),
    }).catch(() => undefined);
    setResumen(acumulado);
    setFase("terminado");
  }

  return {
    modo,
    cambiarModo,
    fase,
    archivo,
    vistas,
    progreso,
    resumen,
    error,
    ignoradas,
    elegirArchivo,
    confirmar,
    reiniciar,
  };
}
