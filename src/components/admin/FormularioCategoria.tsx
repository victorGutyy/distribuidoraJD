"use client";

import Link from "next/link";
import { useActionState } from "react";
import { guardarCategoria } from "@/app/admin/(panel)/categorias/actions";
import { AvisoError, Campo } from "@/components/admin/Campo";
import { CampoCasilla } from "@/components/admin/CampoCasilla";
import { CampoSelect } from "@/components/admin/CampoSelect";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { EstadoFormulario } from "@/lib/validaciones/comun";

const INICIAL: EstadoFormulario = {};

type Props = {
  /** Si viene, el formulario edita esa categoría; si no, crea una nueva. */
  categoria?: {
    id: number;
    nombre: string;
    parent_id: number | null;
    activa: boolean;
  };
  /** Categorías principales, para elegir a cuál pertenece una subcategoría. */
  principales: { id: number; nombre: string }[];
  /** true = tiene subcategorías, por lo que no puede pasar a ser subcategoría. */
  tieneHijas?: boolean;
};

export function FormularioCategoria({
  categoria,
  principales,
  tieneHijas = false,
}: Props) {
  const [estado, accion, pendiente] = useActionState(guardarCategoria, INICIAL);
  const editando = Boolean(categoria);

  const opciones = [
    { valor: "", etiqueta: "Ninguna: es una categoría principal" },
    ...principales
      .filter((p) => p.id !== categoria?.id)
      .map((p) => ({ valor: String(p.id), etiqueta: p.nombre })),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {editando ? "Editar categoría" : "Nueva categoría"}
        </CardTitle>
        <CardDescription>
          Hay dos niveles: categoría principal y subcategoría.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={accion} className="grid gap-4" noValidate>
          {estado.error ? <AvisoError>{estado.error}</AvisoError> : null}
          {categoria ? (
            <input type="hidden" name="id" value={categoria.id} />
          ) : null}

          <Campo
            id="nombre"
            nombre="nombre"
            etiqueta="Nombre"
            defaultValue={estado.valores?.nombre ?? categoria?.nombre}
            errores={estado.errores?.nombre}
            autoFocus={editando}
          />
          <CampoSelect
            id="parent_id"
            nombre="parent_id"
            etiqueta="Pertenece a"
            opciones={opciones}
            defaultValue={
              estado.valores?.parent_id ??
              (categoria?.parent_id ? String(categoria.parent_id) : "")
            }
            errores={estado.errores?.parent_id}
            disabled={tieneHijas}
            ayuda={
              tieneHijas
                ? "Tiene subcategorías, así que se queda como categoría principal."
                : undefined
            }
          />
          <CampoCasilla
            id="activa"
            nombre="activa"
            etiqueta="Activa (visible en la tienda)"
            defaultChecked={categoria?.activa ?? true}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              size="lg"
              disabled={pendiente}
              className="h-11"
            >
              {pendiente
                ? "Guardando…"
                : editando
                  ? "Guardar cambios"
                  : "Crear categoría"}
            </Button>
            {editando ? (
              <Link
                href="/admin/categorias"
                className="inline-flex h-11 items-center rounded-lg border px-4 text-sm font-medium hover:bg-muted"
              >
                Cancelar
              </Link>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
