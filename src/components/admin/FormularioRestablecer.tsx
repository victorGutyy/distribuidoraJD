"use client";

import { useActionState } from "react";
import { restablecerContrasena } from "@/app/admin/(auth)/actions";
import { AvisoError, Campo } from "@/components/admin/Campo";
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

export function FormularioRestablecer() {
  const [estado, accion, pendiente] = useActionState(
    restablecerContrasena,
    INICIAL,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Crea tu contraseña nueva</CardTitle>
        <CardDescription>
          Elige una contraseña que no uses en otros sitios.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={accion} className="grid gap-4" noValidate>
          {estado.error ? <AvisoError>{estado.error}</AvisoError> : null}

          <Campo
            id="contrasena"
            nombre="contrasena"
            etiqueta="Contraseña nueva"
            type="password"
            autoComplete="new-password"
            ayuda="Mínimo 8 caracteres."
            errores={estado.errores?.contrasena}
            autoFocus
          />
          <Campo
            id="confirmar"
            nombre="confirmar"
            etiqueta="Repite la contraseña"
            type="password"
            autoComplete="new-password"
            errores={estado.errores?.confirmar}
          />

          <Button type="submit" size="lg" disabled={pendiente} className="h-11">
            {pendiente ? "Guardando…" : "Guardar contraseña"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
