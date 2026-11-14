"use client";

import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { AvisoError, AvisoInfo } from "@/components/admin/Campo";
import {
  contarPorEstado,
  VistaPreviaImportacion,
} from "@/components/admin/importar/VistaPreviaImportacion";
import { useImportacion } from "@/components/admin/importar/useImportacion";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ModoImportacion } from "@/lib/importacion/columnas";

const MODOS: { valor: ModoImportacion; titulo: string; texto: string }[] = [
  {
    valor: "catalogo",
    titulo: "Catálogo completo",
    texto: "Crea y actualiza productos, categorías, marcas y presentaciones.",
  },
  {
    valor: "precios",
    titulo: "Solo precios",
    texto: "Cambia precios, ofertas y disponibilidad por SKU. No crea nada.",
  },
];

const DESCARGAS = [
  { tipo: "plantilla", texto: "Plantilla vacía" },
  { tipo: "catalogo", texto: "Catálogo actual" },
  { tipo: "precios", texto: "Precios actuales" },
];

export function Importador() {
  const imp = useImportacion();
  const ocupado = imp.fase === "leyendo" || imp.fase === "aplicando";
  const total = contarPorEstado(imp.vistas);
  const porHacer = total.crear + total.actualizar;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Elige qué vas a importar</CardTitle>
          <CardDescription>
            Cada fila del archivo es una presentación (se reconoce por su SKU).
            Una celda vacía nunca borra lo que ya está guardado.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de importación">
            {MODOS.map((m) => (
              <button
                key={m.valor}
                type="button"
                role="radio"
                aria-checked={imp.modo === m.valor}
                disabled={ocupado}
                onClick={() => imp.cambiarModo(m.valor)}
                className="rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted aria-checked:border-primary aria-checked:bg-primary/5 disabled:opacity-50"
              >
                <span className="block font-medium">{m.titulo}</span>
                <span className="text-muted-foreground">{m.texto}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {DESCARGAS.map((d) => (
              <a
                key={d.tipo}
                href={`/admin/importar/descargar?tipo=${d.tipo}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Download aria-hidden="true" /> {d.texto} (.xlsx)
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Sube el archivo</CardTitle>
          <CardDescription>
            Excel (.xlsx) o CSV. Primero se revisa todo; no se guarda nada hasta
            que confirmes.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <label className="grid gap-1.5 text-sm font-medium">
            Archivo de importación
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.txt"
              disabled={ocupado || imp.fase === "listo" || imp.fase === "terminado"}
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) void imp.elegirArchivo(archivo);
                e.target.value = "";
              }}
              className="block w-full cursor-pointer rounded-lg border bg-background p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground disabled:opacity-50"
            />
          </label>

          {imp.fase === "leyendo" ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Revisando {imp.archivo}… {imp.progreso.hecho}/{imp.progreso.total}
            </p>
          ) : null}
          {imp.error ? <AvisoError>{imp.error}</AvisoError> : null}
        </CardContent>
      </Card>

      {imp.fase === "listo" || imp.fase === "aplicando" ? (
        <Card>
          <CardHeader>
            <CardTitle>3. Revisa y confirma</CardTitle>
            <CardDescription className="flex items-center gap-1.5">
              <FileSpreadsheet className="size-4" aria-hidden="true" />
              {imp.archivo}: {imp.vistas.length} filas · {total.crear} se crean ·{" "}
              {total.actualizar} se actualizan · {total.sin_cambios} sin cambios ·{" "}
              {total.error} con error
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {imp.ignoradas.length > 0 ? (
              <AvisoInfo>
                Estas columnas no se reconocieron y se ignoran:{" "}
                {imp.ignoradas.join(", ")}.
              </AvisoInfo>
            ) : null}
            {total.error > 0 ? (
              <AvisoInfo>
                Las filas con error NO se importan. Corrígelas en el archivo y
                súbelo de nuevo cuando quieras: lo ya importado no se duplica.
              </AvisoInfo>
            ) : null}
            <VistaPreviaImportacion vistas={imp.vistas} />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                disabled={porHacer === 0 || imp.fase === "aplicando"}
                onClick={() => void imp.confirmar()}
              >
                {imp.fase === "aplicando" ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    Guardando… {imp.progreso.hecho}/{imp.progreso.total}
                  </>
                ) : (
                  `Importar ${porHacer} ${porHacer === 1 ? "fila" : "filas"}`
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={imp.fase === "aplicando"}
                onClick={imp.reiniciar}
              >
                Cancelar
              </Button>
              {porHacer === 0 ? (
                <span className="text-sm text-muted-foreground">
                  No hay nada que guardar: todo está igual o tiene errores.
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {imp.fase === "terminado" && imp.resumen ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {imp.resumen.interrumpida
                ? "Importación interrumpida"
                : "Importación terminada"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <ul className="grid gap-1">
              {imp.modo === "catalogo" ? (
                <>
                  <li>Productos creados: <b>{imp.resumen.productosCreados}</b></li>
                  <li>Productos actualizados: <b>{imp.resumen.productosActualizados}</b></li>
                  <li>Presentaciones creadas: <b>{imp.resumen.variantesCreadas}</b></li>
                  <li>Categorías nuevas: <b>{imp.resumen.categoriasCreadas}</b> · Marcas nuevas: <b>{imp.resumen.marcasCreadas}</b></li>
                </>
              ) : null}
              <li>Presentaciones actualizadas: <b>{imp.resumen.variantesActualizadas}</b></li>
              <li>Sin cambios: <b>{imp.resumen.sinCambios + imp.resumen.omitidas}</b></li>
            </ul>
            {imp.error ? <AvisoError>{imp.error}</AvisoError> : null}
            {imp.resumen.errores.length > 0 ? (
              <div>
                <p className="font-medium text-destructive">
                  No se pudieron guardar {imp.resumen.errores.length}:
                </p>
                <ul className="mt-1 max-h-60 overflow-auto text-xs">
                  {imp.resumen.errores.slice(0, 100).map((e, i) => (
                    <li key={`${e.ref}-${i}`}>
                      <b>{e.ref}</b>: {e.mensaje}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <AvisoInfo>
                Los productos sin precio quedan en borrador y no se ven en la
                tienda hasta que les pongas precio.
              </AvisoInfo>
            )}
            <div>
              <Button type="button" onClick={imp.reiniciar}>
                Importar otro archivo
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
