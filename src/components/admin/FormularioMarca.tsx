"use client";

import Link from "next/link";
import { useActionState } from "react";
import { guardarMarca } from "@/app/admin/(panel)/marcas/actions";
import { AvisoError, Campo } from "@/components/admin/Campo";
import { CampoCasilla } from "@/components/admin/CampoCasilla";
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
  /** Si viene, el formulario edita esa marca; si no, crea una nueva. */
  marca?: { id: number; nombre: string; activa: boolean };
};

export function FormularioMarca({ marca }: Props) {
  const [estado, accion, pendiente] = useActionState(guardarMarca, INICIAL);
  const editando = Boolean(marca);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editando ? "Editar marca" : "Nueva marca"}</CardTitle>
        <CardDescription>
          Las marcas sirven para filtrar el catálogo (p. ej. «Doña Lupe»).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={accion} className="grid gap-4" noValidate>
          {estado.error ? <AvisoError>{estado.error}</AvisoError> : null}
          {marca ? <input type="hidden" name="id" value={marca.id} /> : null}

          <Campo
            id="nombre"
            nombre="nombre"
            etiqueta="Nombre"
            defaultValue={estado.valores?.nombre ?? marca?.nombre}
            errores={estado.errores?.nombre}
            autoFocus={editando}
          />
          <CampoCasilla
            id="activa"
            nombre="activa"
            etiqueta="Activa"
            defaultChecked={marca?.activa ?? true}
            ayuda="Una marca inactiva deja de aparecer como filtro en la tienda."
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
                  : "Crear marca"}
            </Button>
            {editando ? (
              <Link
                href="/admin/marcas"
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
