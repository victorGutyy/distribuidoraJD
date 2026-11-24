"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, type FieldErrors, type Resolver } from "react-hook-form";
import { crearPedido } from "@/app/(tienda)/checkout/actions";
import { CampoCheckout } from "@/components/tienda/checkout/CampoCheckout";
import { useResumenCarrito } from "@/components/tienda/carrito/useResumenCarrito";
import { aEntradas } from "@/lib/carrito";
import { formatCOP } from "@/lib/formato";
import { claveParaPedido, firmaDelCarrito, leerClaveGuardada } from "@/lib/idempotencia";
import {
  CLAVE_CLIENTE,
  CLAVE_ULTIMO_PEDIDO,
  leerClienteGuardado,
} from "@/lib/ultimo-pedido";
import { checkoutSchema } from "@/lib/validaciones/pedido";
import { useCarrito } from "@/stores/carrito";

/** Lo que la persona escribe (todo texto, salvo la casilla). Los demás datos salen del carrito. */
type Campos = {
  nombre: string;
  celular: string;
  nombre_negocio: string;
  documento: string;
  direccion: string;
  referencia: string;
  notas: string;
  acepta_datos: boolean;
  web: string;
};

const VACIO: Campos = {
  nombre: "",
  celular: "",
  nombre_negocio: "",
  documento: "",
  direccion: "",
  referencia: "",
  notas: "",
  acepta_datos: false,
  web: "",
};
const NOMBRES = new Set(Object.keys(VACIO));
const CLAVE_INTENTO = "ev-intento-pedido";

/** Clave de este intento de compra: se guarda en la pestaña para que un reintento la reutilice. */
function claveDelIntento(firma: string): string {
  const generar = () => crypto.randomUUID();
  try {
    const nueva = claveParaPedido(leerClaveGuardada(sessionStorage.getItem(CLAVE_INTENTO)), firma, generar);
    sessionStorage.setItem(CLAVE_INTENTO, JSON.stringify(nueva));
    return nueva.clave;
  } catch {
    return generar();
  }
}

/**
 * Formulario del checkout (RF-09), con react-hook-form. Se valida con el MISMO
 * esquema del servidor (lib/validaciones/pedido.ts); el servidor lo vuelve a
 * validar y recalcula todos los precios al crear el pedido.
 */
export function FormularioCheckout() {
  const router = useRouter();
  const r = useResumenCarrito();
  const vaciar = useCarrito((s) => s.vaciar);
  const aplicarVigentes = useCarrito((s) => s.aplicarVigentes);
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  // Lo que no escribe la persona sale del carrito. react-hook-form relee estas funciones en cada
  // validación, así que siempre ven el carrito y la ubicación de este momento.
  const ctx = {
    recoge_en_bodega: r.entrega?.esBodega ?? false,
    sector_id: r.entrega?.sectorId ?? null,
    items: aEntradas(r.items),
    total_visto: r.total,
  };

  const resolver: Resolver<Campos> = async (valores) => {
    const parsed = checkoutSchema.safeParse({ ...valores, ...ctx });
    if (parsed.success) return { values: valores, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of parsed.error.issues) {
      const campo = NOMBRES.has(String(issue.path[0])) ? String(issue.path[0]) : "root";
      if (!errors[campo]) errors[campo] = { type: "validation", message: issue.message };
    }
    return { values: {}, errors: errors as FieldErrors<Campos> };
  };

  const { register, handleSubmit, reset, setError, formState } = useForm<Campos>({
    defaultValues: VACIO,
    resolver,
  });
  const { errors } = formState;

  // Datos guardados en este navegador del pedido anterior (solo en este dispositivo).
  useEffect(() => {
    try {
      const g = leerClienteGuardado(localStorage.getItem(CLAVE_CLIENTE));
      if (g) reset({ ...VACIO, ...g });
    } catch {
      /* sin almacenamiento: se deja vacío */
    }
  }, [reset]);

  const bloqueo = !r.hidratado
    ? "Cargando tu carrito…"
    : r.items.length === 0
      ? "Tu carrito está vacío."
      : r.hayAgotados
        ? "Hay productos agotados en tu carrito."
        : r.faltaMinimo > 0
          ? `Te faltan ${formatCOP(r.faltaMinimo)} para el pedido mínimo.`
          : !r.entrega || !r.entrega.fecha
            ? "Elige dónde recibes tu pedido."
            : null;

  async function enviar(valores: Campos) {
    setEnviando(true);
    setErrorGeneral(null);
    try {
      const clave_idempotencia = claveDelIntento(firmaDelCarrito(r.items, r.total));
      const respuesta = await crearPedido({ ...valores, acepta_datos: valores.acepta_datos as true, ...ctx, clave_idempotencia });
      if (respuesta.ok) {
        try {
          sessionStorage.removeItem(CLAVE_INTENTO);
        } catch {
          /* sin almacenamiento: no pasa nada */
        }
        try {
          localStorage.setItem(CLAVE_ULTIMO_PEDIDO, JSON.stringify(respuesta.pedido));
          localStorage.setItem(
            CLAVE_CLIENTE,
            JSON.stringify({
              nombre: valores.nombre,
              celular: valores.celular,
              nombre_negocio: valores.nombre_negocio,
              documento: valores.documento,
              direccion: valores.direccion,
              referencia: valores.referencia,
            }),
          );
        } catch {
          /* sin almacenamiento: el pedido ya quedó guardado igual */
        }
        vaciar();
        router.push(`/pedido/${respuesta.pedido.numero}`);
        return;
      }
      if (respuesta.vigentes) {
        const ids = Object.keys(respuesta.vigentes).map(Number);
        aplicarVigentes(new Map(ids.map((id) => [id, respuesta.vigentes?.[id] ?? null])));
      }
      for (const [ruta, mensaje] of Object.entries(respuesta.errores ?? {})) {
        if (NOMBRES.has(ruta)) setError(ruta as keyof Campos, { message: mensaje });
      }
      setErrorGeneral(respuesta.error ?? "Revisa los datos marcados e inténtalo de nuevo.");
    } catch {
      setErrorGeneral("Se perdió la conexión y no sabemos si tu pedido llegó. Vuelve a pulsar «Confirmar pedido»: si ya había llegado, no se duplicará.");
    } finally {
      setEnviando(false);
    }
  }

  const esBodega = r.entrega?.esBodega ?? false;
  const avisoCasilla = errors.acepta_datos?.message;

  return (
    <form onSubmit={handleSubmit(enviar)} noValidate className="grid gap-4">
      <h2 className="text-lg font-bold">Tus datos</h2>

      {errorGeneral ? (
        <p role="alert" className="rounded-lg border border-destructive bg-destructive/5 p-3 text-sm text-destructive">
          {errorGeneral}
        </p>
      ) : null}
      {errors.root?.message ? (
        <p role="alert" className="rounded-lg border border-destructive bg-destructive/5 p-3 text-sm text-destructive">
          {errors.root.message}
        </p>
      ) : null}

      <CampoCheckout id="nombre" etiqueta="Nombre completo" autoComplete="name" error={errors.nombre?.message} registro={register("nombre")} />
      <CampoCheckout id="celular" etiqueta="Celular" autoComplete="tel-national" inputMode="tel" ayuda="10 dígitos, empieza por 3. Ejemplo: 310 123 4567" error={errors.celular?.message} registro={register("celular")} />
      <CampoCheckout id="nombre_negocio" etiqueta="Nombre del negocio (opcional)" autoComplete="organization" error={errors.nombre_negocio?.message} registro={register("nombre_negocio")} />
      <CampoCheckout id="documento" etiqueta="Cédula o NIT (opcional)" inputMode="numeric" error={errors.documento?.message} registro={register("documento")} />

      {esBodega ? (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm">Recogerás tu pedido en la bodega, no necesitamos tu dirección.</p>
      ) : (
        <>
          <CampoCheckout id="direccion" etiqueta="Dirección de entrega" autoComplete="street-address" error={errors.direccion?.message} registro={register("direccion")} />
          <CampoCheckout id="referencia" etiqueta="Barrio o referencia (opcional)" ayuda="Ayuda al repartidor a encontrarte." error={errors.referencia?.message} registro={register("referencia")} />
        </>
      )}

      <CampoCheckout id="notas" etiqueta="Notas para tu pedido (opcional)" multilinea error={errors.notas?.message} registro={register("notas")} />

      {/* Campo trampa: las personas no lo ven; algunos bots lo llenan y se descartan. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="web">No llenes este campo</label>
        <input id="web" type="text" tabIndex={-1} autoComplete="off" {...register("web")} />
      </div>

      <p className="rounded-lg border bg-muted/40 p-3 text-sm">
        Forma de pago: <b>contraentrega</b>. Pagas cuando recibes tu pedido.
      </p>

      <div className="grid gap-1">
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            aria-invalid={Boolean(avisoCasilla) || undefined}
            aria-describedby={avisoCasilla ? "acepta-error" : undefined}
            className="mt-0.5 size-5 shrink-0 accent-ev-azul"
            {...register("acepta_datos")}
          />
          <span>
            Acepto la{" "}
            <Link href="/politica-de-datos" target="_blank" className="font-semibold text-ev-azul underline">
              política de tratamiento de datos personales
            </Link>{" "}
            (Ley 1581 de 2012).
          </span>
        </label>
        {avisoCasilla ? (
          <p id="acepta-error" className="text-sm text-destructive">
            {avisoCasilla}
          </p>
        ) : null}
      </div>

      {bloqueo ? (
        <p className="text-sm text-muted-foreground">
          {bloqueo}{" "}
          {r.hayAgotados ? (
            <Link href="/carrito" className="font-semibold text-ev-azul underline">
              Revisar el carrito
            </Link>
          ) : null}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enviando || bloqueo !== null}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-ev-azul px-6 text-base font-semibold text-white hover:bg-ev-azul/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enviando ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
        {enviando ? "Enviando tu pedido…" : `Confirmar pedido · ${formatCOP(r.total)}`}
      </button>
    </form>
  );
}
