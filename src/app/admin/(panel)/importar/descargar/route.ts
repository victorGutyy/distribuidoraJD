import { connection, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { obtenerPerfilActual } from "@/lib/auth";
import { COLUMNAS_CATALOGO } from "@/lib/importacion/columnas";
import {
  FILAS_EJEMPLO,
  INSTRUCCIONES,
  tablaDeExportacion,
  type Celda,
} from "@/lib/importacion/exportar";
import {
  aVarianteExistente,
  SELECT_VARIANTE_EXISTENTE,
  type FilaBD,
} from "@/lib/importacion/leer-bd";
import { createClient } from "@/lib/supabase/server";

/**
 * Descargas de la sección Importar (solo admin y editor):
 *   ?tipo=plantilla  → plantilla vacía con ejemplos e instrucciones
 *   ?tipo=catalogo   → todo el catálogo, una fila por presentación
 *   ?tipo=precios    → solo SKU y precios (para ajustarlos en Excel y volver a subir)
 *   &formato=xlsx|csv (por defecto xlsx)
 * La protección real es el rol aquí y RLS en la base de datos.
 */

const POR_PAGINA = 1000; // PostgREST devuelve como máximo 1000 filas por consulta

async function leerTodasLasPresentaciones() {
  const supabase = await createClient();
  const todas = [];
  for (let desde = 0; ; desde += POR_PAGINA) {
    const { data, error } = await supabase
      .from("variantes")
      .select(SELECT_VARIANTE_EXISTENTE)
      .order("id")
      .range(desde, desde + POR_PAGINA - 1);
    if (error) return null;
    const pagina = (data ?? []) as unknown as FilaBD[];
    todas.push(...pagina.map(aVarianteExistente));
    if (pagina.length < POR_PAGINA) return todas;
  }
}

function nombreArchivo(base: string, formato: string): string {
  const hoy = new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Bogota",
  });
  return `${base}-${hoy}.${formato}`;
}

export async function GET(request: NextRequest) {
  await connection();
  const perfil = await obtenerPerfilActual();
  if (!perfil) return new Response("Inicia sesión.", { status: 401 });
  if (perfil.rol === "vendedor") {
    return new Response("No tienes permiso.", { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const tipo = params.get("tipo");
  const formato = params.get("formato") === "csv" ? "csv" : "xlsx";

  let tabla: Celda[][];
  let base: string;
  if (tipo === "plantilla") {
    tabla = [[...COLUMNAS_CATALOGO], ...FILAS_EJEMPLO];
    base = "plantilla-importacion-ev";
  } else if (tipo === "catalogo" || tipo === "precios") {
    const presentaciones = await leerTodasLasPresentaciones();
    if (!presentaciones) {
      return new Response("No pudimos leer el catálogo.", { status: 500 });
    }
    tabla = tablaDeExportacion(presentaciones, tipo);
    base = tipo === "catalogo" ? "catalogo-ev" : "precios-ev";
  } else {
    return new Response("Tipo de descarga no válido.", { status: 400 });
  }

  const hoja = XLSX.utils.aoa_to_sheet(tabla);
  hoja["!cols"] = tabla[0].map((_, i) => ({
    wch: Math.min(
      40,
      Math.max(10, ...tabla.slice(0, 50).map((f) => String(f[i] ?? "").length)),
    ),
  }));

  if (formato === "csv") {
    // El BOM hace que Excel abra bien las tildes y las ñ.
    const csv = "﻿" + XLSX.utils.sheet_to_csv(hoja);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nombreArchivo(base, "csv")}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Catálogo");
  if (tipo === "plantilla") {
    const ayuda = XLSX.utils.aoa_to_sheet(
      [["Instrucciones"], ...INSTRUCCIONES.map((t) => [t])],
    );
    ayuda["!cols"] = [{ wch: 120 }];
    XLSX.utils.book_append_sheet(libro, ayuda, "Instrucciones");
  }
  const contenido = XLSX.write(libro, { type: "buffer", bookType: "xlsx" });
  return new Response(contenido, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo(base, "xlsx")}"`,
      "Cache-Control": "no-store",
    },
  });
}
