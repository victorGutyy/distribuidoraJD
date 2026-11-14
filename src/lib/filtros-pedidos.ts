import { esEstadoPedido, type EstadoPedido } from "@/lib/pedidos";

/**
 * Filtros de la lista de pedidos del panel. La URL es la fuente de verdad
 * (/admin/pedidos?estado=nuevo&entrega=2026-11-19), así se puede compartir o guardar
 * el enlace. Lógica PURA, con pruebas.
 */

export const POR_PAGINA_PEDIDOS = 25;

export type FiltrosPedidos = {
  q: string;
  estado: EstadoPedido | null;
  /** Pedidos hechos entre estas fechas (inclusive), "AAAA-MM-DD". */
  desde: string | null;
  hasta: string | null;
  /** Fecha de entrega, "AAAA-MM-DD". */
  entrega: string | null;
  sector: number | null;
  /** "lista" (tabla) o "ruta" (pedidos de un día de reparto agrupados por sector, HU-04). */
  vista: "lista" | "ruta";
  pagina: number;
};

type Params = Record<string, string | string[] | undefined>;

const primero = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Una fecha "AAAA-MM-DD" que existe de verdad (no el 31 de febrero), o null. */
export function fechaValida(v: string | undefined | null): string | null {
  if (!v || !FECHA.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
}

const entero = (v: string | undefined): number | null => {
  if (!v || !/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n > 0 && n < 1_000_000 ? n : null;
};

/** Lee y SANEA los parámetros de la URL: lo desconocido cae al valor por defecto. */
export function leerFiltrosPedidos(params: Params): FiltrosPedidos {
  const estado = primero(params.estado);
  const desde = fechaValida(primero(params.desde));
  let hasta = fechaValida(primero(params.hasta));
  if (desde && hasta && hasta < desde) hasta = null;
  return {
    q: (primero(params.q) ?? "").trim().replace(/\s+/g, " ").slice(0, 60),
    estado: esEstadoPedido(estado) ? estado : null,
    desde,
    hasta,
    entrega: fechaValida(primero(params.entrega)),
    sector: entero(primero(params.sector)),
    vista: primero(params.vista) === "ruta" ? "ruta" : "lista",
    pagina: entero(primero(params.pagina)) ?? 1,
  };
}

/** Arma la URL de la lista conservando los filtros y cambiando solo `cambios`. */
export function urlPedidos(
  filtros: FiltrosPedidos,
  cambios: Partial<Record<keyof FiltrosPedidos, string | number | null>> = {},
  base = "/admin/pedidos",
): string {
  const f: Record<string, string | number | null> = { ...filtros, ...cambios };
  const params = new URLSearchParams();
  if (f.q) params.set("q", String(f.q));
  if (f.estado) params.set("estado", String(f.estado));
  if (f.desde) params.set("desde", String(f.desde));
  if (f.hasta) params.set("hasta", String(f.hasta));
  if (f.entrega) params.set("entrega", String(f.entrega));
  if (f.sector) params.set("sector", String(f.sector));
  if (f.vista === "ruta") params.set("vista", "ruta");
  const pagina = "pagina" in cambios ? Number(cambios.pagina) : 1;
  if (pagina > 1) params.set("pagina", String(pagina));
  const texto = params.toString();
  return texto ? `${base}?${texto}` : base;
}

export function hayFiltrosPedidos(f: FiltrosPedidos): boolean {
  return Boolean(f.q || f.estado || f.desde || f.hasta || f.entrega || f.sector);
}

/** Escapa % _ \ para usarlos como texto literal dentro de un ILIKE. */
export function textoParaBuscar(q: string): string {
  return q
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\\%_]/g, "\\$&");
}

/**
 * "Pedidos por ruta" (HU-04): agrupa pedidos por sector, con el sector sin nombre
 * (recoger en bodega) al final. Dentro de cada sector se conserva el orden recibido.
 */
export function agruparPorSector<T extends { sector_nombre: string | null; municipio_nombre: string | null }>(
  pedidos: readonly T[],
): { titulo: string; pedidos: T[] }[] {
  const grupos = new Map<string, T[]>();
  for (const p of pedidos) {
    const titulo = p.sector_nombre ? `${p.municipio_nombre ?? ""} – ${p.sector_nombre}`.replace(/^ – /, "") : "Recoge en bodega";
    const g = grupos.get(titulo);
    if (g) g.push(p);
    else grupos.set(titulo, [p]);
  }
  return [...grupos]
    .map(([titulo, lista]) => ({ titulo, pedidos: lista }))
    .sort((a, b) => {
      if (a.titulo === "Recoge en bodega") return 1;
      if (b.titulo === "Recoge en bodega") return -1;
      return a.titulo.localeCompare(b.titulo, "es");
    });
}
