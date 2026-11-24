"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useFieldArray, useForm, type Path } from "react-hook-form";
import { guardarProducto } from "@/app/admin/(panel)/productos/actions";
import { AvisoError } from "@/components/admin/Campo";
import {
  ariaCampo,
  CampoForm,
  claseInput,
  claseSelect,
} from "@/components/admin/CampoForm";
import { CamposVariante } from "@/components/admin/CamposVariante";
import { useAvisoSinGuardar } from "@/components/admin/useAvisoSinGuardar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { OpcionCategoria } from "@/lib/catalogo/categorias";
import { varianteVacia } from "@/lib/catalogo/producto-form";
import {
  productoSchema,
  type ProductoFormValues,
  type ProductoValidado,
} from "@/lib/validaciones/producto";

type Props = {
  valoresIniciales: ProductoFormValues;
  categorias: OpcionCategoria[];
  marcas: { id: number; nombre: string }[];
};

function Casilla({
  id,
  etiqueta,
  ayuda,
  registro,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  registro: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  return (
    <div>
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
      {ayuda ? (
        <p className="pl-8 text-xs text-muted-foreground">{ayuda}</p>
      ) : null}
    </div>
  );
}

export function FormularioProducto({
  valoresIniciales,
  categorias,
  marcas,
}: Props) {
  const form = useForm<ProductoFormValues, unknown, ProductoValidado>({
    resolver: zodResolver(productoSchema),
    defaultValues: valoresIniciales,
  });
  const { register, control, formState } = form;
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "variantes",
  });
  const [pendiente, iniciar] = useTransition();
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const esEdicion = valoresIniciales.id !== "";
  const errores = formState.errors;
  const hayErrores = Object.keys(errores).length > 0;
  // Avisa antes de perder lo escrito (cerrar la pestaña, usar el menú o «Cancelar»).
  useAvisoSinGuardar(formState.isDirty && !pendiente);

  const enviar = form.handleSubmit(() => {
    setErrorGeneral(null);
    iniciar(async () => {
      // Se envían los valores tal como están en el formulario; el servidor los
      // valida de nuevo y, si todo sale bien, redirige (esta promesa no vuelve).
      const resultado = await guardarProducto(form.getValues());
      for (const [ruta, message] of Object.entries(resultado?.errores ?? {})) {
        form.setError(ruta as Path<ProductoFormValues>, { message });
      }
      if (resultado?.error) setErrorGeneral(resultado.error);
    });
  });

  const errNombre = errores.nombre?.message;
  const errCategoria = errores.categoria_id?.message;
  const errDescripcion = errores.descripcion?.message;
  const errEtiquetas = errores.etiquetas?.message;
  const errVariantes =
    errores.variantes?.root?.message ?? errores.variantes?.message;

  return (
    <form onSubmit={enviar} className="grid gap-6" noValidate>
      {hayErrores || errorGeneral ? (
        <AvisoError>
          {errorGeneral ??
            "Revisa los campos marcados en rojo antes de guardar."}
        </AvisoError>
      ) : null}

      <input type="hidden" {...register("id")} />

      <Card>
        <CardHeader>
          <CardTitle>Datos del producto</CardTitle>
          <CardDescription>
            Puedes guardarlo sin precio: queda en borrador y no se ve en la
            tienda.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <CampoForm id="nombre" etiqueta="Nombre" error={errNombre}>
            <Input
              id="nombre"
              className={claseInput}
              autoFocus={!esEdicion}
              {...ariaCampo("nombre", errNombre)}
              {...register("nombre")}
            />
          </CampoForm>

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoForm
              id="categoria_id"
              etiqueta="Categoría"
              error={errCategoria}
            >
              <select
                id="categoria_id"
                className={claseSelect}
                {...ariaCampo("categoria_id", errCategoria)}
                {...register("categoria_id")}
              >
                <option value="">Elige una categoría…</option>
                {categorias.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.etiqueta}
                  </option>
                ))}
              </select>
            </CampoForm>
            <CampoForm id="marca_id" etiqueta="Marca (opcional)">
              <select
                id="marca_id"
                className={claseSelect}
                {...register("marca_id")}
              >
                <option value="">Sin marca</option>
                {marcas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </CampoForm>
          </div>

          <CampoForm
            id="descripcion"
            etiqueta="Descripción (opcional)"
            error={errDescripcion}
          >
            <Textarea
              id="descripcion"
              rows={3}
              className="text-base md:text-sm"
              {...ariaCampo("descripcion", errDescripcion)}
              {...register("descripcion")}
            />
          </CampoForm>

          <CampoForm
            id="etiquetas"
            etiqueta="Etiquetas (opcional)"
            error={errEtiquetas}
            ayuda="Separadas por comas. Ej.: granos, legumbres"
          >
            <Input
              id="etiquetas"
              className={claseInput}
              {...ariaCampo("etiquetas", errEtiquetas, "x")}
              {...register("etiquetas")}
            />
          </CampoForm>

          <div className="flex flex-wrap gap-x-6">
            <Casilla
              id="activo"
              etiqueta="Activo"
              ayuda="Desmárcalo para ocultarlo sin borrarlo."
              registro={register("activo")}
            />
            <Casilla
              id="destacado"
              etiqueta="Destacado"
              registro={register("destacado")}
            />
            <Casilla
              id="es_nuevo"
              etiqueta="Nuevo"
              registro={register("es_nuevo")}
            />
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="titulo-presentaciones" className="grid gap-4">
        <div>
          <h2 id="titulo-presentaciones" className="text-lg font-semibold">
            Presentaciones
          </h2>
          <p className="text-sm text-muted-foreground">
            Cada tamaño o empaque del producto, con su precio propio.
          </p>
        </div>

        {errVariantes ? <AvisoError>{errVariantes}</AvisoError> : null}

        {fields.map((campo, i) => (
          <CamposVariante
            key={campo.id}
            index={i}
            form={form}
            total={fields.length}
            onSubir={() => move(i, i - 1)}
            onBajar={() => move(i, i + 1)}
            onQuitar={() => remove(i)}
          />
        ))}

        <Button
          type="button"
          variant="outline"
          className="h-11 justify-self-start"
          onClick={() => append(varianteVacia())}
          disabled={fields.length >= 30}
        >
          <Plus aria-hidden />
          Agregar presentación
        </Button>
      </section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        <Button type="submit" size="lg" className="h-11" disabled={pendiente}>
          {pendiente
            ? "Guardando…"
            : esEdicion
              ? "Guardar cambios"
              : "Crear producto"}
        </Button>
        <Link
          href="/admin/productos"
          className="inline-flex h-11 items-center rounded-lg border bg-background px-4 text-sm font-medium hover:bg-muted"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
