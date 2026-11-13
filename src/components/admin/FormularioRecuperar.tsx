"use client";

import Link from "next/link";
import { useActionState } from "react";
import { solicitarRecuperacion } from "@/app/admin/(auth)/actions";
import { AvisoError, AvisoInfo, Campo } from "@/components/admin/Campo";
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

export function FormularioRecuperar() {
  const [estado, accion, pendiente] = useActionState(
    solicitarRecuperacion,
    INICIAL,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Recuperar contraseña</CardTitle>
        <CardDescription>
          Escribe tu correo y te enviamos un enlace para crear una contraseña
          nueva.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={accion} className="grid gap-4" noValidate>
          {estado.error ? <AvisoError>{estado.error}</AvisoError> : null}
          {estado.mensaje ? <AvisoInfo>{estado.mensaje}</AvisoInfo> : null}

          <Campo
            id="correo"
            nombre="correo"
            etiqueta="Correo"
            type="email"
            inputMode="email"
            autoComplete="email"
            defaultValue={estado.valores?.correo}
            errores={estado.errores?.correo}
            autoFocus
          />

          <Button type="submit" size="lg" disabled={pendiente} className="h-11">
            {pendiente ? "Enviando…" : "Enviar enlace"}
          </Button>

          <Link
            href="/admin/login"
            className="text-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Volver a ingresar
          </Link>
        </form>
      </CardContent>
    </Card>
  );
}
