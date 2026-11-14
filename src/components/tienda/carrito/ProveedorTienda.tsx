"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import type { ConfigEntrega } from "@/lib/entregas";
import type { ConfigPrecios } from "@/lib/precios";
import type { ZonaPublica } from "@/lib/ubicacion";
import { CLAVE_CARRITO, useCarrito } from "@/stores/carrito";

/** Lo que el carrito necesita saber de la tienda: reglas de precio, de entrega y zonas. */
export type ContextoTienda = {
  precios: ConfigPrecios;
  entrega: ConfigEntrega;
  pedidoMinimo: number;
  whatsapp: string | null;
  mensajeWhatsApp: string;
  zonas: ZonaPublica[];
};

const Contexto = createContext<ContextoTienda | null>(null);

export function useTienda(): ContextoTienda {
  const c = useContext(Contexto);
  if (!c) throw new Error("useTienda se usa dentro de <ProveedorTienda>.");
  return c;
}

/**
 * Entrega a los componentes del carrito la configuración de la tienda y, una vez
 * montada la página, lee el carrito guardado en el navegador. También lo mantiene
 * al día si se cambia desde otra pestaña.
 */
export function ProveedorTienda({
  valor,
  children,
}: {
  valor: ContextoTienda;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const leer = async () => {
      await useCarrito.persist.rehydrate();
      useCarrito.setState({ hidratado: true });
    };
    void leer();
    const alCambiarOtraPestana = (e: StorageEvent) => {
      if (e.key === CLAVE_CARRITO) void useCarrito.persist.rehydrate();
    };
    window.addEventListener("storage", alCambiarOtraPestana);
    return () => window.removeEventListener("storage", alCambiarOtraPestana);
  }, []);

  // Si el valor viene igual desde el servidor, no se reconstruye el contexto.
  const memo = useMemo(() => valor, [valor]);
  return <Contexto.Provider value={memo}>{children}</Contexto.Provider>;
}
