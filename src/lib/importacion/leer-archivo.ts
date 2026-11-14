/**
 * Lee un archivo Excel (.xlsx) o CSV en el NAVEGADOR y lo devuelve como tabla de
 * textos (la primera fila es el encabezado). La interpretación de las columnas
 * está en columnas.ts; la validación, en fila.ts (y se repite en el servidor).
 *
 * SheetJS se carga solo al elegir un archivo (import dinámico), para no
 * aumentar el peso inicial de la página.
 */

export const MAX_BYTES_ARCHIVO = 8 * 1024 * 1024;
export const MAX_FILAS_ARCHIVO = 5000;

/** Una celda de Excel a texto. Los números no se formatean: 3200 → "3200". */
export function celdaATexto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "boolean") return valor ? "si" : "no";
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : "";
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor).replace(/^﻿/, "").trim();
}

export class ErrorArchivo extends Error {}

export async function leerArchivo(archivo: File): Promise<string[][]> {
  if (archivo.size > MAX_BYTES_ARCHIVO) {
    throw new ErrorArchivo("El archivo pesa más de 8 MB. Divídelo en partes.");
  }
  const nombre = archivo.name.toLowerCase();
  const esCsv = nombre.endsWith(".csv") || nombre.endsWith(".txt");
  if (!esCsv && !nombre.endsWith(".xlsx") && !nombre.endsWith(".xls")) {
    throw new ErrorArchivo("Sube un archivo .xlsx o .csv.");
  }

  const XLSX = await import("xlsx");
  let libro;
  try {
    libro = esCsv
      ? // raw: el texto se queda como está ("3.200" no se convierte en 3,2).
        XLSX.read(await archivo.text(), { type: "string", raw: true })
      : XLSX.read(await archivo.arrayBuffer(), { type: "array" });
  } catch {
    throw new ErrorArchivo("No pudimos leer el archivo. ¿Está dañado?");
  }

  const hoja = libro.Sheets[libro.SheetNames[0]];
  if (!hoja) throw new ErrorArchivo("El archivo no tiene ninguna hoja.");

  const tabla = XLSX.utils.sheet_to_json<unknown[]>(hoja, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: true,
  });
  if (tabla.length - 1 > MAX_FILAS_ARCHIVO) {
    throw new ErrorArchivo(
      `El archivo tiene más de ${MAX_FILAS_ARCHIVO} filas. Divídelo en partes.`,
    );
  }
  return tabla.map((fila) => fila.map(celdaATexto));
}
