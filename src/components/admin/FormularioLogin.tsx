"use client";

import Link from "next/link";
import { useActionState } from "react";
import { iniciarSesion } from "@/app/admin/(auth)/actions";
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

/** Avisos según el motivo por el que se llegó al login (?motivo=). */
const AVISOS: Record<string, string> = {
  "sin-acceso":
    "Tu cuenta no está activa o no tiene permisos para el panel. Si crees que es un error, habla con el administrador.",
  enlace:
    "Ese enlace ya no sirve (venció o ya se usó). Pide uno nuevo desde «Olvidé mi contraseña».",
};

type Props = {
  /** Ruta a la que volver tras entrar (ya validada en el servidor). */
  next?: string;
  motivo?: string;
};

export function FormularioLogin({ next, motivo }: Props) {
  const [estado, accion, pendiente] = useActionState(iniciarSesion, INICIAL);
  const aviso = motivo ? AVISOS[motivo] : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Ingresar al panel</CardTitle>
        <CardDescription>
          Usa el correo y la contraseña que te dio el administrador.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={accion} className="grid gap-4" noValidate>
          {aviso ? <AvisoInfo>{aviso}</AvisoInfo> : null}
          {estado.error ? <AvisoError>{estado.error}</AvisoError> : null}

          <input type="hidden" name="next" value={next ?? ""} />

          <Campo
            id="correo"
            nombre="correo"
            etiqueta="Correo"
            type="email"
            inputMode="email"
            autoComplete="username"
            defaultValue={estado.valores?.correo}
            errores={estado.errores?.correo}
            autoFocus
          />
          <Campo
            id="contrasena"
            nombre="contrasena"
            etiqueta="Contraseña"
            type="password"
            autoComplete="current-password"
            errores={estado.errores?.contrasena}
          />

          <Button type="submit" size="lg" disabled={pendiente} className="h-11">
            {pendiente ? "Entrando…" : "Entrar"}
          </Button>

          <Link
            href="/admin/recuperar"
            className="text-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Olvidé mi contraseña
          </Link>
        </form>
      </CardContent>
    </Card>
  );
}
