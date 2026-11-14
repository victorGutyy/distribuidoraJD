import type { UbicacionPedido } from "@/lib/carrito";
import {
  fechaEntregaBodega,
  fechaEntregaSector,
  type ConfigEntrega,
} from "@/lib/entregas";

/**
 * Qué entrega le corresponde a la ubicación elegida (RF-07): lugar, costo de
 * envío y fecha. Lógica PURA, con pruebas. La usan el carrito, el checkout y el
 * servidor (que la repite con datos de la base: nunca se confía en el navegador).
 */

export type ZonaPublica = {
  id: number;
  nombre: string;
  sectores: { id: number; nombre: string; diasReparto: number[]; costoEnvio: number }[];
};

export type EntregaResuelta = {
  esBodega: boolean;
  /** "Calarcá – Barrio Centro" o "Recoger en bodega". */
  lugar: string;
  sectorId: number | null;
  costoEnvio: number;
  /** "AAAA-MM-DD", o null si el sector no tiene días de reparto utilizables. */
  fecha: string | null;
};

/** Null si no se eligió ubicación o la zona elegida ya no está disponible. */
export function resolverEntrega(
  ubicacion: UbicacionPedido | null,
  zonas: readonly ZonaPublica[],
  ahora: Date,
  config: ConfigEntrega,
): EntregaResuelta | null {
  if (!ubicacion) return null;
  if (ubicacion.tipo === "bodega") {
    return {
      esBodega: true,
      lugar: "Recoger en bodega",
      sectorId: null,
      costoEnvio: 0,
      fecha: fechaEntregaBodega(ahora, config),
    };
  }
  const municipio = zonas.find((z) => z.id === ubicacion.municipioId);
  const sector = municipio?.sectores.find((s) => s.id === ubicacion.sectorId);
  if (!municipio || !sector) return null;
  return {
    esBodega: false,
    lugar: `${municipio.nombre} – ${sector.nombre}`,
    sectorId: sector.id,
    costoEnvio: sector.costoEnvio,
    fecha: fechaEntregaSector(ahora, sector.diasReparto, config),
  };
}

/** Sin zonas disponibles, la única opción es recoger en bodega. */
export function ubicacionEfectiva(
  ubicacion: UbicacionPedido | null,
  zonas: readonly ZonaPublica[],
): UbicacionPedido | null {
  if (ubicacion) return ubicacion;
  return zonas.length === 0 ? { tipo: "bodega" } : null;
}
