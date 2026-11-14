"use client";

import Link from "next/link";
import { useActionState } from "react";
import { guardarSector } from "@/app/admin/(panel)/zonas/actions";
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
import { DIAS_SEMANA } from "@/lib/validaciones/zonas";

const INICIAL: EstadoFormulario = {};

type Props = {
  municipios: { id: number; nombre: string }[];
  /** Si viene, el formulario edita ese sector; si no, crea uno nuevo. */
  sector?: {
    id: number;
    municipio_id: number;
    nombre: string;
    dias_reparto: number[];
    costo_envio: number;
    activo: boolean;
  };
};

/** Formulario de sector de reparto (RF-07): municipio, nombre, días y costo de envío. */
export function FormularioSector({ municipios, sector }: Props) {
  const [estado, accion, pendiente] = useActionState(guardarSector, INICIAL);
  const editando = Boolean(sector);
  const errorDias = estado.errores?.dias?.[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editando ? "Editar sector" : "Nuevo sector"}</CardTitle>
        <CardDescription>
          Un sector es una zona de un municipio a la que el reparto va siempre los
          mismos días de la semana.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={accion} className="grid gap-4" noValidate>
          {estado.error ? <AvisoError>{estado.error}</AvisoError> : null}
          {sector ? <input type="hidden" name="id" value={sector.id} /> : null}

          <CampoSelect
            id="municipio_id"
            nombre="municipio_id"
            etiqueta="Municipio"
            defaultValue={estado.valores?.municipio_id ?? (sector ? String(sector.municipio_id) : undefined)}
            opciones={municipios.map((m) => ({ valor: String(m.id), etiqueta: m.nombre }))}
            errores={estado.errores?.municipio_id}
          />
          <Campo
            id="nombre"
            nombre="nombre"
            etiqueta="Nombre del sector"
            defaultValue={estado.valores?.nombre ?? sector?.nombre}
            errores={estado.errores?.nombre}
            ayuda="Por ejemplo: Barrio Centro, Zona industrial."
            autoFocus={editando}
          />

          <fieldset className="grid gap-1" aria-describedby={errorDias ? "dias-error" : undefined}>
            <legend className="mb-1 text-sm font-medium">Días de reparto</legend>
            <div className="grid grid-cols-2 gap-x-4">
              {DIAS_SEMANA.map((d) => (
                <label key={d.valor} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="dias"
                    value={d.valor}
                    defaultChecked={sector?.dias_reparto.includes(d.valor)}
                    className="size-5 accent-ev-azul"
                  />
                  {d.nombre}
                </label>
              ))}
            </div>
            {errorDias ? (
              <p id="dias-error" className="text-sm text-red-700">
                {errorDias}
              </p>
            ) : null}
          </fieldset>

          <Campo
            id="costo_envio"
            nombre="costo_envio"
            etiqueta="Costo de envío (pesos)"
            defaultValue={estado.valores?.costo_envio ?? (sector ? String(sector.costo_envio) : "0")}
            errores={estado.errores?.costo_envio}
            inputMode="text"
            ayuda="Escribe 0 si el envío no tiene costo."
          />
          <CampoCasilla
            id="activo"
            nombre="activo"
            etiqueta="Activo"
            defaultChecked={sector?.activo ?? true}
            ayuda="Un sector inactivo no se ofrece al hacer el pedido."
          />

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="lg" disabled={pendiente} className="h-11">
              {pendiente ? "Guardando…" : editando ? "Guardar cambios" : "Crear sector"}
            </Button>
            {editando ? (
              <Link
                href="/admin/zonas"
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
