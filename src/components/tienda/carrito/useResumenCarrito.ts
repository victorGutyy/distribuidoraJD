"use client";

import { useMemo } from "react";
import { aEntradas, mapaDePrecios, totalUnidades } from "@/lib/carrito";
import { calcularCarrito, faltaParaMinimo } from "@/lib/precios";
import { resolverEntrega, ubicacionEfectiva } from "@/lib/ubicacion";
import { useTienda } from "@/components/tienda/carrito/ProveedorTienda";
import { useCarrito } from "@/stores/carrito";

/**
 * Cuentas del carrito (con lib/precios.ts), entrega y lo que impide continuar.
 * Mientras no se haya leído el navegador, el carrito se ve vacío (igual que en el
 * servidor), así la página no "salta" al cargar.
 */
export function useResumenCarrito() {
  const tienda = useTienda();
  const hidratado = useCarrito((s) => s.hidratado);
  const itemsGuardados = useCarrito((s) => s.items);
  const ubicacionGuardada = useCarrito((s) => s.ubicacion);

  const items = useMemo(() => (hidratado ? itemsGuardados : []), [hidratado, itemsGuardados]);

  return useMemo(() => {
    const calculo = calcularCarrito(aEntradas(items), mapaDePrecios(items), tienda.precios);
    const ubicacion = ubicacionEfectiva(hidratado ? ubicacionGuardada : null, tienda.zonas);
    // La fecha depende de la hora actual: solo se calcula en el navegador, ya hidratado.
    const entrega = hidratado ? resolverEntrega(ubicacion, tienda.zonas, new Date(), tienda.entrega) : null;
    const total = calculo.total + (entrega?.costoEnvio ?? 0);
    return {
      hidratado,
      items,
      unidades: totalUnidades(items),
      calculo,
      ubicacion,
      entrega,
      total,
      faltaMinimo: faltaParaMinimo(calculo.total, tienda.pedidoMinimo),
      hayAgotados: items.some((i) => !i.disponible),
    };
  }, [hidratado, items, ubicacionGuardada, tienda]);
}
