"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import {
  ariaCampo,
  CampoForm,
  claseInput,
  claseSelect,
} from "@/components/admin/CampoForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  UNIDADES_CONTENIDO,
  UNIDADES_VENTA,
} from "@/lib/catalogo/producto-form";
import type {
  ProductoFormValues,
  ProductoValidado,
} from "@/lib/validaciones/producto";

type Props = {
  index: number;
  form: UseFormReturn<ProductoFormValues, unknown, ProductoValidado>;
  total: number;
  onSubir: () => void;
  onBajar: () => void;
  onQuitar: () => void;
};

/** Casilla simple (nativa) con área táctil de 44 px. */
function Casilla({
  id,
  etiqueta,
  registro,
}: {
  id: string;
  etiqueta: string;
  registro: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium"
    >
      <input
        id={id}
        type="checkbox"
        className="size-5 accent-ev-azul"
        {...registro}
      />
      {etiqueta}
    </label>
  );
}

/** Una tarjeta con todos los datos de UNA presentación (variante) del producto. */
export function CamposVariante({
  index,
  form,
  total,
  onSubir,
  onBajar,
  onQuitar,
}: Props) {
  const { register, control, formState } = form;
  const errores = formState.errors.variantes?.[index];
  const base = `variantes.${index}` as const;
  const id = (campo: string) => `v${index}-${campo}`;

  const enOferta = useWatch({ control, name: `${base}.en_oferta` });
  const unidadVenta = useWatch({ control, name: `${base}.unidad_venta` });
  const esNueva = !useWatch({ control, name: `${base}.id` });

  // Si la unidad de venta viene de una importación (valor fuera de la lista), se conserva.
  const unidadesVenta = UNIDADES_VENTA.some((u) => u.valor === unidadVenta)
    ? UNIDADES_VENTA
    : [...UNIDADES_VENTA, { valor: unidadVenta, etiqueta: unidadVenta }];

  const campoTexto = (
    campo: keyof ProductoFormValues["variantes"][number],
    etiqueta: string,
    opciones: { ayuda?: string; placeholder?: string; numerico?: boolean } = {},
  ) => {
    const error = errores?.[campo]?.message as string | undefined;
    return (
      <CampoForm
        id={id(campo)}
        etiqueta={etiqueta}
        error={error}
        ayuda={opciones.ayuda}
      >
        <Input
          id={id(campo)}
          className={claseInput}
          inputMode={opciones.numerico ? "decimal" : undefined}
          placeholder={opciones.placeholder}
          {...ariaCampo(id(campo), error, opciones.ayuda)}
          {...register(`${base}.${campo}` as `variantes.${number}.sku`)}
        />
      </CampoForm>
    );
  };

  return (
    <fieldset className="grid gap-4 rounded-xl border bg-background p-4">
      <legend className="px-2 text-sm font-semibold">
        Presentación {index + 1}
      </legend>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onSubir}
          disabled={index === 0}
          aria-label={`Subir la presentación ${index + 1}`}
        >
          <ArrowUp aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onBajar}
          disabled={index === total - 1}
          aria-label={`Bajar la presentación ${index + 1}`}
        >
          <ArrowDown aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-9"
          onClick={onQuitar}
          disabled={total === 1}
          aria-label={`Quitar la presentación ${index + 1}`}
          title="Se elimina de verdad al guardar el producto"
        >
          <Trash2 aria-hidden />
          Quitar
        </Button>
      </div>

      <input type="hidden" {...register(`${base}.id`)} />

      <div className="grid gap-4 sm:grid-cols-2">
        {campoTexto("nombre_presentacion", "Presentación", {
          placeholder: "Ej. 400 g",
        })}
        {campoTexto("sku", "SKU", {
          placeholder: "Se genera solo",
          ayuda: esNueva
            ? "Déjalo vacío y se crea uno (EV-00001-01)."
            : undefined,
        })}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {campoTexto("contenido_valor", "Contenido", {
          numerico: true,
          placeholder: "400",
        })}
        <CampoForm id={id("contenido_unidad")} etiqueta="Unidad">
          <select
            id={id("contenido_unidad")}
            className={claseSelect}
            {...register(`${base}.contenido_unidad`)}
          >
            <option value="">—</option>
            {UNIDADES_CONTENIDO.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </CampoForm>
        <CampoForm id={id("unidad_venta")} etiqueta="Se vende como">
          <select
            id={id("unidad_venta")}
            className={claseSelect}
            {...register(`${base}.unidad_venta`)}
          >
            {unidadesVenta.map((u) => (
              <option key={u.valor} value={u.valor}>
                {u.etiqueta}
              </option>
            ))}
          </select>
        </CampoForm>
        {campoTexto("unidades_por_empaque", "Unidades por empaque", {
          numerico: true,
        })}
      </div>

      <div className="grid gap-4 rounded-lg bg-muted/50 p-3 sm:grid-cols-3">
        {campoTexto("precio_unidad", "Precio por unidad ($)", {
          numerico: true,
          placeholder: "3200",
          ayuda: "Sin precio, el producto no se ve en la tienda.",
        })}
        {campoTexto("precio_mayor", "Precio por mayor ($)", {
          numerico: true,
          placeholder: "3000",
        })}
        {campoTexto("cantidad_min_mayor", "Por mayor desde (und.)", {
          numerico: true,
          placeholder: "12",
        })}
      </div>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Casilla
          id={id("en_oferta")}
          etiqueta="En oferta"
          registro={register(`${base}.en_oferta`)}
        />
        {enOferta
          ? campoTexto("precio_oferta", "Precio de oferta ($)", {
              numerico: true,
            })
          : null}
      </div>

      <details className="rounded-lg border px-3 py-2">
        <summary className="min-h-9 cursor-pointer text-sm font-medium">
          Peso y medidas (opcional)
        </summary>
        <div className="grid grid-cols-2 gap-4 py-3 sm:grid-cols-4">
          {campoTexto("peso_g", "Peso de envío (g)", { numerico: true })}
          {campoTexto("alto_cm", "Alto (cm)", { numerico: true })}
          {campoTexto("ancho_cm", "Ancho (cm)", { numerico: true })}
          {campoTexto("largo_cm", "Largo (cm)", { numerico: true })}
        </div>
      </details>

      <div className="flex flex-wrap gap-x-6">
        <Casilla
          id={id("disponible")}
          etiqueta="Disponible (no agotado)"
          registro={register(`${base}.disponible`)}
        />
        <Casilla
          id={id("activo")}
          etiqueta="Activa"
          registro={register(`${base}.activo`)}
        />
      </div>
    </fieldset>
  );
}
