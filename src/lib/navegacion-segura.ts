/**
 * Decide si un clic en un enlace saca a la persona de la página actual. Lógica PURA, con pruebas.
 *
 * `beforeunload` solo avisa al cerrar o recargar la pestaña; los enlaces internos de Next
 * (menú, paginación, «Cancelar») NO lo disparan. Por eso el panel escucha los clics en enlaces
 * y pregunta antes de salir si hay cambios sin guardar.
 */

export type ClicEnlace = {
  href: string | null;
  target?: string | null;
  download?: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

/** true = el clic navega dentro de esta pestaña a otra dirección (hay que confirmar). */
export function clicSalePagina(clic: ClicEnlace, urlActual: string): boolean {
  if (clic.button !== 0 || clic.metaKey || clic.ctrlKey || clic.shiftKey || clic.altKey) return false;
  if (clic.download) return false;
  if (clic.target && clic.target !== "_self") return false;
  if (!clic.href) return false;
  let destino: URL;
  let actual: URL;
  try {
    actual = new URL(urlActual);
    destino = new URL(clic.href, actual);
  } catch {
    return false;
  }
  if (destino.protocol !== "http:" && destino.protocol !== "https:") return false;
  // Mismo sitio y misma dirección (solo cambia el #ancla): no se sale de la página.
  if (destino.origin === actual.origin && destino.pathname === actual.pathname && destino.search === actual.search) {
    return false;
  }
  return true;
}
