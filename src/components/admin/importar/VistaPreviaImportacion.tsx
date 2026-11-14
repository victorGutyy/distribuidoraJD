"use client";

import { useState } from "react";
import type { FilaVista } from "@/app/admin/(panel)/importar/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { textoCambio } from "@/lib/importacion/formato-cambio";

type Filtro = FilaVista["estado"] | "todas";

const ETIQUETA: Record<FilaVista["estado"], string> = {
  crear: "Se crea",
  actualizar: "Se actualiza",
  sin_cambios: "Sin cambios",
  error: "Con error",
};

const FILAS_POR_PAGINA = 100;

export function contarPorEstado(vistas: readonly FilaVista[]) {
  const total = { crear: 0, actualizar: 0, sin_cambios: 0, error: 0 };
  for (const v of vistas) total[v.estado]++;
  return total;
}

/** Tabla de la vista previa: qué pasará con cada fila antes de confirmar. */
export function VistaPreviaImportacion({ vistas }: { vistas: FilaVista[] }) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [mostrar, setMostrar] = useState(FILAS_POR_PAGINA);

  const total = contarPorEstado(vistas);
  const visibles = vistas.filter((v) => filtro === "todas" || v.estado === filtro);

  const opciones: { valor: Filtro; texto: string }[] = [
    { valor: "todas", texto: `Todas (${vistas.length})` },
    { valor: "crear", texto: `Se crean (${total.crear})` },
    { valor: "actualizar", texto: `Se actualizan (${total.actualizar})` },
    { valor: "sin_cambios", texto: `Sin cambios (${total.sin_cambios})` },
    { valor: "error", texto: `Con error (${total.error})` },
  ];

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar filas">
        {opciones.map((o) => (
          <Button
            key={o.valor}
            type="button"
            size="sm"
            variant={filtro === o.valor ? "default" : "outline"}
            aria-pressed={filtro === o.valor}
            onClick={() => {
              setFiltro(o.valor);
              setMostrar(FILAS_POR_PAGINA);
            }}
          >
            {o.texto}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Fila</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="w-32">Resultado</TableHead>
              <TableHead>Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.slice(0, mostrar).map((v) => (
              <TableRow key={v.fila}>
                <TableCell className="text-muted-foreground">{v.fila}</TableCell>
                <TableCell>
                  <div className="font-medium">{v.producto ?? v.sku ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {[v.presentacion, v.sku].filter(Boolean).join(" · ")}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      v.estado === "error"
                        ? "destructive"
                        : v.estado === "sin_cambios"
                          ? "outline"
                          : "secondary"
                    }
                  >
                    {ETIQUETA[v.estado]}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-normal text-xs">
                  {v.errores.length > 0 ? (
                    <ul className="text-destructive">
                      {v.errores.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  ) : v.cambios.length > 0 ? (
                    <ul>
                      {v.cambios.map((c) => (
                        <li key={c.campo}>{textoCambio(c)}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground">
                      {v.estado === "crear"
                        ? "Presentación nueva"
                        : v.estado === "sin_cambios"
                          ? "Ya está igual en el catálogo"
                          : ""}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {visibles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No hay filas con este filtro.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {visibles.length > mostrar ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => setMostrar((m) => m + FILAS_POR_PAGINA)}
        >
          Mostrar más ({visibles.length - mostrar} restantes)
        </Button>
      ) : null}
    </div>
  );
}
