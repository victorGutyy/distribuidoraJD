"use client";

import { useActionState } from "react";
import {
  guardarCompras,
  guardarContacto,
  guardarEntrega,
  guardarEmpresa,
} from "@/app/admin/(panel)/config/actions";
import { AvisoError, Campo } from "@/components/admin/Campo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ValoresConfigFormulario } from "@/lib/config-admin";
import type { EstadoFormulario } from "@/lib/validaciones/comun";
import { REGLAS_MAYOREO } from "@/lib/validaciones/config";

const INICIAL: EstadoFormulario = {};

function Tarjeta({
  titulo,
  descripcion,
  estado,
  pendiente,
  accion,
  children,
}: {
  titulo: string;
  descripcion: string;
  estado: EstadoFormulario;
  pendiente: boolean;
  accion: (formData: FormData) => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription>{descripcion}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={accion} className="grid gap-4" noValidate>
          {estado.error ? <AvisoError>{estado.error}</AvisoError> : null}
          {children}
          <div>
            <Button type="submit" size="lg" disabled={pendiente} className="h-11">
              {pendiente ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** Campo de varias líneas con etiqueta, ayuda y error enlazados. */
function CampoLargo({
  id,
  etiqueta,
  defaultValue,
  errores,
  ayuda,
  filas = 4,
}: {
  id: string;
  etiqueta: string;
  defaultValue: string;
  errores?: string[];
  ayuda?: string;
  filas?: number;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {etiqueta}
      </label>
      <textarea
        id={id}
        name={id}
        rows={filas}
        defaultValue={defaultValue}
        aria-invalid={errores?.length ? true : undefined}
        aria-describedby={`${id}-ayuda`}
        className="w-full rounded-lg border bg-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm"
      />
      {ayuda ? (
        <p id={`${id}-ayuda`} className="text-sm text-muted-foreground">
          {ayuda}
        </p>
      ) : null}
      {errores?.length ? <p className="text-sm text-red-700">{errores[0]}</p> : null}
    </div>
  );
}

export function FormularioContacto({ v }: { v: ValoresConfigFormulario }) {
  const [estado, accion, pendiente] = useActionState(guardarContacto, INICIAL);
  const val = (c: string, por: string) => estado.valores?.[c] ?? por;
  return (
    <Tarjeta titulo="WhatsApp y mensajes" descripcion="El número recibe los pedidos y aparece en el botón flotante de la tienda." estado={estado} pendiente={pendiente} accion={accion}>
      <Campo id="whatsapp" nombre="whatsapp" etiqueta="Número de WhatsApp de pedidos" inputMode="text" defaultValue={val("whatsapp", v.whatsapp)} errores={estado.errores?.whatsapp} ayuda="Celular colombiano, 10 dígitos. Déjalo vacío para ocultar el botón." />
      <Campo id="mensaje_whatsapp" nombre="mensaje_whatsapp" etiqueta="Mensaje del botón flotante" defaultValue={val("mensaje_whatsapp", v.mensaje_whatsapp)} errores={estado.errores?.mensaje_whatsapp} ayuda="Es el texto que ya viene escrito cuando alguien te escribe desde el botón." />
      <Campo id="mensaje_barra" nombre="mensaje_barra" etiqueta="Mensaje de la barra superior" defaultValue={val("mensaje_barra", v.mensaje_barra)} errores={estado.errores?.mensaje_barra} ayuda="Franja negra arriba de la tienda. Vacío = no se muestra." />
    </Tarjeta>
  );
}

export function FormularioCompras({ v }: { v: ValoresConfigFormulario }) {
  const [estado, accion, pendiente] = useActionState(guardarCompras, INICIAL);
  const regla = estado.valores?.regla_mayoreo ?? v.regla_mayoreo;
  return (
    <Tarjeta titulo="Pedido mínimo y precio por mayor" descripcion="Reglas que se aplican en el carrito y al crear el pedido." estado={estado} pendiente={pendiente} accion={accion}>
      <Campo id="pedido_minimo" nombre="pedido_minimo" etiqueta="Pedido mínimo (pesos)" defaultValue={estado.valores?.pedido_minimo ?? v.pedido_minimo} errores={estado.errores?.pedido_minimo} ayuda="Escribe 0 si no hay pedido mínimo." />
      <fieldset className="grid gap-1">
        <legend className="mb-1 text-sm font-medium">¿Cuándo rige el precio por mayor?</legend>
        {REGLAS_MAYOREO.map((r) => (
          <label key={r.valor} className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
            <input type="radio" name="regla_mayoreo" value={r.valor} defaultChecked={regla === r.valor} className="mt-0.5 size-5 accent-ev-azul" />
            <span>
              <b>{r.etiqueta}</b>
              <span className="block text-muted-foreground">{r.ayuda}</span>
            </span>
          </label>
        ))}
        {estado.errores?.regla_mayoreo ? <p className="text-sm text-red-700">{estado.errores.regla_mayoreo[0]}</p> : null}
      </fieldset>
      <Campo id="umbral_mayor_monto" nombre="umbral_mayor_monto" etiqueta="Monto para el precio por mayor (pesos)" defaultValue={estado.valores?.umbral_mayor_monto ?? v.umbral_mayor_monto} errores={estado.errores?.umbral_mayor_monto} ayuda="Solo cuenta si elegiste «por monto» o «ambas»: desde qué total del pedido (a precio normal)." />
    </Tarjeta>
  );
}

export function FormularioEntrega({ v }: { v: ValoresConfigFormulario }) {
  const [estado, accion, pendiente] = useActionState(guardarEntrega, INICIAL);
  return (
    <Tarjeta titulo="Hora de corte y días sin reparto" descripcion="Con esto se calcula la fecha de entrega que ve el cliente." estado={estado} pendiente={pendiente} accion={accion}>
      <Campo id="hora_corte" nombre="hora_corte" etiqueta="Hora de corte" defaultValue={estado.valores?.hora_corte ?? v.hora_corte} errores={estado.errores?.hora_corte} ayuda="Hasta esta hora del día ANTERIOR al reparto entra el pedido en esa ruta. Ejemplo: 17:00" />
      <CampoLargo id="dias_no_habiles" etiqueta="Días no hábiles o festivos" defaultValue={estado.valores?.dias_no_habiles ?? v.dias_no_habiles} errores={estado.errores?.dias_no_habiles} ayuda="Una fecha por línea, así: 2026-12-25. En esos días no hay reparto ni se atiende la bodega." />
    </Tarjeta>
  );
}

export function FormularioEmpresa({ v }: { v: ValoresConfigFormulario }) {
  const [estado, accion, pendiente] = useActionState(guardarEmpresa, INICIAL);
  const e = v.empresa;
  const val = (c: string, por: string) => estado.valores?.[c] ?? por;
  return (
    <Tarjeta titulo="Datos de la empresa" descripcion="Se muestran en el pie de página de la tienda." estado={estado} pendiente={pendiente} accion={accion}>
      <Campo id="nombre" nombre="nombre" etiqueta="Nombre" defaultValue={val("nombre", e.nombre)} errores={estado.errores?.nombre} />
      <Campo id="nit" nombre="nit" etiqueta="NIT (opcional)" defaultValue={val("nit", e.nit)} errores={estado.errores?.nit} />
      <Campo id="direccion" nombre="direccion" etiqueta="Dirección (opcional)" defaultValue={val("direccion", e.direccion)} errores={estado.errores?.direccion} />
      <Campo id="horarios" nombre="horarios" etiqueta="Horarios de atención (opcional)" defaultValue={val("horarios", e.horarios)} errores={estado.errores?.horarios} ayuda="Ejemplo: Lunes a sábado, 7:00 a. m. a 5:00 p. m." />
      <Campo id="facebook" nombre="facebook" etiqueta="Facebook (enlace, opcional)" defaultValue={val("facebook", e.facebook)} errores={estado.errores?.facebook} />
      <Campo id="instagram" nombre="instagram" etiqueta="Instagram (enlace, opcional)" defaultValue={val("instagram", e.instagram)} errores={estado.errores?.instagram} />
      <Campo id="tiktok" nombre="tiktok" etiqueta="TikTok (enlace, opcional)" defaultValue={val("tiktok", e.tiktok)} errores={estado.errores?.tiktok} />
    </Tarjeta>
  );
}
