"use client";

import Link from "next/link";
import { useActionState } from "react";
import { actualizarUsuario, invitarUsuario, type EstadoInvitacion } from "@/app/admin/(panel)/usuarios/actions";
import { AvisoError, AvisoInfo, Campo } from "@/components/admin/Campo";
import { CampoCasilla } from "@/components/admin/CampoCasilla";
import { CampoSelect } from "@/components/admin/CampoSelect";
import { CajaEnlace } from "@/components/admin/usuarios/EnlaceAcceso";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ETIQUETA_ROL, ROLES } from "@/lib/permisos";
import type { EstadoFormulario } from "@/lib/validaciones/comun";

type Sector = { id: number; nombre: string; municipio: string };

const OPCIONES_ROL = ROLES.map((r) => ({ valor: r, etiqueta: ETIQUETA_ROL[r] }));

/** Casillas de sectores: solo importan para el rol vendedor (ve y atiende pedidos de esas zonas). */
function Sectores({ sectores, marcados }: { sectores: Sector[]; marcados: number[] }) {
  return (
    <fieldset className="grid gap-1">
      <legend className="mb-1 text-sm font-medium">Sectores del vendedor</legend>
      <p className="text-sm text-muted-foreground">
        Solo se usan si el rol es Vendedor: verá y atenderá los pedidos de estos sectores.
      </p>
      {sectores.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay sectores. Créalos en «Zonas de entrega».</p>
      ) : (
        <div className="grid max-h-48 gap-x-4 overflow-y-auto sm:grid-cols-2">
          {sectores.map((s) => (
            <label key={s.id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" name="sectores" value={s.id} defaultChecked={marcados.includes(s.id)} className="size-5 accent-ev-azul" />
              {s.municipio} – {s.nombre}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

export function FormularioInvitar({ sectores }: { sectores: Sector[] }) {
  const [estado, accion, pendiente] = useActionState<EstadoInvitacion, FormData>(invitarUsuario, {});
  const val = (c: string) => (estado.enlace ? "" : (estado.valores?.[c] ?? ""));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo usuario</CardTitle>
        <CardDescription>
          Crea la cuenta y te damos un enlace para que la persona elija su contraseña. Tú se lo entregas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={accion} className="grid gap-4" noValidate key={estado.enlace ?? "nuevo"}>
          {estado.error ? <AvisoError>{estado.error}</AvisoError> : null}
          {estado.mensaje ? <AvisoInfo>{estado.mensaje}</AvisoInfo> : null}
          {estado.enlace ? <CajaEnlace enlace={estado.enlace} /> : null}

          <Campo id="correo" nombre="correo" etiqueta="Correo" type="email" autoComplete="off" defaultValue={val("correo")} errores={estado.errores?.correo} />
          <Campo id="nombre" nombre="nombre" etiqueta="Nombre" defaultValue={val("nombre")} errores={estado.errores?.nombre} />
          <CampoSelect id="rol" nombre="rol" etiqueta="Rol" defaultValue={estado.enlace ? "vendedor" : (estado.valores?.rol ?? "vendedor")} opciones={OPCIONES_ROL} errores={estado.errores?.rol} ayuda="Administrador: todo. Editor: catálogo, precios, importación y banners; solo mira pedidos. Vendedor: pedidos de sus sectores." />
          <Sectores sectores={sectores} marcados={[]} />
          <div>
            <Button type="submit" size="lg" disabled={pendiente} className="h-11">
              {pendiente ? "Creando…" : "Crear usuario"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export type UsuarioEditable = {
  id: string;
  nombre: string;
  correo: string | null;
  rol: "admin" | "editor" | "vendedor";
  activo: boolean;
  sectores: number[];
};

export function FormularioEditarUsuario({
  usuario,
  sectores,
  esUnoMismo,
}: {
  usuario: UsuarioEditable;
  sectores: Sector[];
  esUnoMismo: boolean;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(actualizarUsuario, {});
  return (
    <Card>
      <CardHeader>
        <CardTitle>Editar usuario</CardTitle>
        <CardDescription>{usuario.correo ?? "Sin correo"}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={accion} className="grid gap-4" noValidate>
          {estado.error ? <AvisoError>{estado.error}</AvisoError> : null}
          <input type="hidden" name="id" value={usuario.id} />
          <Campo id="nombre" nombre="nombre" etiqueta="Nombre" defaultValue={estado.valores?.nombre ?? usuario.nombre} errores={estado.errores?.nombre} />

          {esUnoMismo ? (
            <AvisoInfo>Esta es tu cuenta: puedes cambiar tu nombre, pero no tu rol ni desactivarte (te quedarías fuera del panel).</AvisoInfo>
          ) : (
            <>
              <CampoSelect id="rol" nombre="rol" etiqueta="Rol" defaultValue={estado.valores?.rol ?? usuario.rol} opciones={OPCIONES_ROL} errores={estado.errores?.rol} />
              <Sectores sectores={sectores} marcados={usuario.sectores} />
              <CampoCasilla id="activo" nombre="activo" etiqueta="Activo" defaultChecked={usuario.activo} ayuda="Una persona inactiva no puede entrar al panel." />
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="lg" disabled={pendiente} className="h-11">
              {pendiente ? "Guardando…" : "Guardar cambios"}
            </Button>
            <Link href="/admin/usuarios" className="inline-flex h-11 items-center rounded-lg border px-4 text-sm font-medium hover:bg-muted">
              Cancelar
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
