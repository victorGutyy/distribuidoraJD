"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { guardarPreciosRapido } from "@/app/admin/(panel)/precios/actions";
import { AvisoError, AvisoInfo } from "@/components/admin/Campo";
import { useAvisoSinGuardar } from "@/components/admin/useAvisoSinGuardar";
import { Button } from "@/components/ui/button";
import {
  advertenciaDeFila,
  costoCambiado,
  idsModificados,
  valoresDesdeFila,
  type CampoTexto,
  type FilaPrecio,
  type ValoresPrecio,
} from "@/lib/catalogo/cuadricula-precios";
import {
  calcularGanancia,
  estadoMargen,
  formatPorcentaje,
  type EstadoMargen,
} from "@/lib/costos";
import { formatCOP } from "@/lib/formato";
import { parsearPesos } from "@/lib/numeros";

// producto | unidad | costo | ganancia | oferta | precio oferta | disp.
// (el precio por mayor ya no se edita: el descuento es por monto de compra, ver Configuración)
const COLUMNAS =
  "lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))_minmax(0,1.3fr)_auto_minmax(0,1fr)_auto]";

const CLASE_MARGEN: Record<EstadoMargen, string> = {
  sin_dato: "text-muted-foreground",
  perdida: "font-semibold text-destructive",
  bajo: "font-medium text-ev-dorado-oscuro",
  ok: "text-foreground",
};

/** Ganancia y margen de lo que hay escrito AHORA en la fila (antes de guardar). */
function textoGanancia(v: ValoresPrecio): { texto: string; estado: EstadoMargen } {
  const precio = v.precio_unidad.trim() === "" ? null : parsearPesos(v.precio_unidad);
  const costo = v.costo.trim() === "" ? null : parsearPesos(v.costo);
  const g = calcularGanancia(precio, costo);
  if (!g) return { texto: "—", estado: "sin_dato" };
  return {
    texto: `${formatCOP(g.ganancia)} · ${formatPorcentaje(g.margenPct)}`,
    estado: estadoMargen(precio, costo),
  };
}

const claseInput =
  "h-10 w-full rounded-lg border bg-background px-2 text-base md:text-sm tabular-nums focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none";

function mapear(filas: FilaPrecio[]): Record<number, ValoresPrecio> {
  return Object.fromEntries(filas.map((f) => [f.id, valoresDesdeFila(f)]));
}

/**
 * Cuadrícula editable de precios. Las filas modificadas se marcan; "Guardar" las
 * envía todas juntas. Enter baja a la fila siguiente en la misma columna.
 */
export function CuadriculaPrecios({ filas }: { filas: FilaPrecio[] }) {
  const [base, setBase] = useState(() => mapear(filas));
  const [valores, setValores] = useState(() => mapear(filas));
  const [errores, setErrores] = useState<Record<number, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const modificados = idsModificados(base, valores);

  // Avisa al cerrar la pestaña Y al usar el menú, la paginación o los filtros (antes se perdía en silencio).
  useAvisoSinGuardar(modificados.length > 0, true);

  const cambiar = <K extends keyof ValoresPrecio>(id: number, campo: K, valor: ValoresPrecio[K]) =>
    setValores((v) => ({ ...v, [id]: { ...v[id], [campo]: valor } }));

  const bajarConEnter = (e: React.KeyboardEvent<HTMLInputElement>, indice: number, campo: string) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const siguiente = document.querySelector<HTMLInputElement>(
      `[data-col="${campo}"][data-fila="${indice + 1}"]`,
    );
    siguiente?.focus();
    siguiente?.select();
  };

  async function guardar() {
    setGuardando(true);
    setAviso(null);
    try {
      const r = await guardarPreciosRapido(
        modificados.map((id) => ({
          id,
          ...valores[id],
          // Solo si el costo cambió se guarda (si no, la fila no toca la tabla privada).
          costo_modificado: costoCambiado(base[id], valores[id]),
        })),
      );
      const guardadas = new Set(r.guardadas);
      setBase((b) => {
        const nuevo = { ...b };
        for (const id of guardadas) nuevo[id] = valores[id];
        return nuevo;
      });
      setErrores(Object.fromEntries(r.errores.map((e) => [e.id, e.mensaje])));
      if (r.error) setAviso({ tipo: "error", texto: r.error });
      else if (r.errores.length > 0)
        setAviso({
          tipo: "error",
          texto: `Se guardaron ${guardadas.size} y ${r.errores.length} tienen errores (están marcadas abajo).`,
        });
      else setAviso({ tipo: "ok", texto: `Se guardaron ${guardadas.size} cambios.` });
    } catch {
      setAviso({ tipo: "error", texto: "Se perdió la conexión. No se guardó nada." });
    } finally {
      setGuardando(false);
    }
  }

  const campoTexto = (id: number, i: number, campo: CampoTexto, etiqueta: string, placeholder?: string) => (
    <label className="grid gap-1 text-xs font-medium lg:block">
      <span className="lg:sr-only">{etiqueta}</span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        data-col={campo}
        data-fila={i}
        value={valores[id][campo]}
        placeholder={placeholder}
        onChange={(e) => cambiar(id, campo, e.target.value)}
        onKeyDown={(e) => bajarConEnter(e, i, campo)}
        aria-invalid={Boolean(errores[id])}
        className={claseInput}
      />
    </label>
  );

  return (
    <div className="grid gap-3">
      {aviso ? (
        aviso.tipo === "ok" ? <AvisoInfo>{aviso.texto}</AvisoInfo> : <AvisoError>{aviso.texto}</AvisoError>
      ) : null}

      <div
        className={`hidden gap-2 px-3 text-xs font-medium text-muted-foreground lg:grid ${COLUMNAS}`}
        aria-hidden="true"
      >
        <span>Producto</span>
        <span>Precio unidad</span>
        <span>Costo</span>
        <span>Ganancia</span>
        <span>Oferta</span>
        <span>Precio oferta</span>
        <span>Disp.</span>
      </div>

      <ul className="grid gap-2">
        {filas.map((f, i) => {
          const v = valores[f.id];
          const sucia = modificados.includes(f.id);
          const ganancia = textoGanancia(v);
          const advertencia = sucia ? advertenciaDeFila(base[f.id], v) : null;
          return (
            <li
              key={f.id}
              className={`grid items-center gap-2 rounded-xl border p-3 ${COLUMNAS} ${
                errores[f.id]
                  ? "border-destructive bg-destructive/5"
                  : sucia
                    ? "border-ev-dorado bg-ev-dorado/10"
                    : "bg-background"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{f.producto_nombre}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[f.nombre_presentacion, f.marca_nombre, f.sku].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:contents">
                {campoTexto(f.id, i, "precio_unidad", "Precio unidad", "$")}
                {campoTexto(f.id, i, "costo", "Costo", "$ costo")}
                <p
                  className={`col-span-2 min-w-0 text-sm tabular-nums sm:col-span-3 lg:col-span-1 ${CLASE_MARGEN[ganancia.estado]}`}
                >
                  <span className="text-xs font-medium text-muted-foreground lg:sr-only">
                    Ganancia:{" "}
                  </span>
                  {ganancia.texto}
                  {ganancia.estado === "perdida" ? (
                    <span className="block text-xs">Por debajo del costo</span>
                  ) : null}
                </p>
              </div>
              <div className="grid grid-cols-2 items-end gap-2 lg:contents">
                <label className="flex min-h-10 items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={v.en_oferta}
                    onChange={(e) => cambiar(f.id, "en_oferta", e.target.checked)}
                    className="size-5 accent-ev-azul"
                  />
                  En oferta
                </label>
                {campoTexto(f.id, i, "precio_oferta", "Precio de oferta", "$ oferta")}
              </div>
              <label className="flex min-h-10 items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={v.disponible}
                  onChange={(e) => cambiar(f.id, "disponible", e.target.checked)}
                  className="size-5 accent-ev-azul"
                />
                <span className="lg:sr-only">Disponible</span>
              </label>
              {advertencia ? (
                <p className="text-sm font-medium text-ev-dorado-oscuro lg:col-span-full">⚠ {advertencia}</p>
              ) : null}
              {errores[f.id] ? (
                <p role="alert" className="text-sm text-destructive lg:col-span-full">
                  {errores[f.id]}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 p-3 shadow-md backdrop-blur">
        <p className="text-sm" aria-live="polite">
          {modificados.length === 0
            ? "Sin cambios por guardar."
            : `${modificados.length} ${modificados.length === 1 ? "fila modificada" : "filas modificadas"} sin guardar.`}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={modificados.length === 0 || guardando}
            onClick={() => {
              setValores(base);
              setErrores({});
              setAviso(null);
            }}
          >
            Descartar
          </Button>
          <Button
            type="button"
            className="h-11"
            disabled={modificados.length === 0 || guardando}
            onClick={() => void guardar()}
          >
            {guardando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Guardar {modificados.length > 0 ? modificados.length : ""} {modificados.length === 1 ? "cambio" : "cambios"}
          </Button>
        </div>
      </div>
    </div>
  );
}
