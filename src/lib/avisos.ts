/**
 * Avisos que se muestran tras una acción del panel. Las acciones redirigen con
 * un CÓDIGO (?ok=categoria-creada, ?error=con-datos) y no con texto libre:
 * así nadie puede armar un enlace que muestre un mensaje inventado.
 */

export const AVISOS_OK: Record<string, string> = {
  "categoria-creada": "Categoría creada.",
  "categoria-actualizada": "Categoría actualizada.",
  "categoria-activada": "Categoría activada.",
  "categoria-desactivada":
    "Categoría desactivada. Sus productos dejan de verse en la tienda.",
  "categoria-eliminada": "Categoría eliminada.",
  "marca-creada": "Marca creada.",
  "marca-actualizada": "Marca actualizada.",
  "marca-activada": "Marca activada.",
  "marca-desactivada": "Marca desactivada.",
  "marca-eliminada": "Marca eliminada.",
  "imagen-principal": "Imagen principal actualizada.",
  "imagen-eliminada": "Imagen eliminada.",
  "config-guardada": "Configuración guardada. La tienda ya muestra los cambios.",
  "banner-actualizado": "Banner actualizado.",
  "banner-eliminado": "Banner eliminado.",
  "usuario-actualizado": "Usuario actualizado.",
  "sector-creado": "Sector creado.",
  "sector-actualizado": "Sector actualizado.",
  "sector-activado": "Sector activado.",
  "sector-desactivado": "Sector desactivado. Ya no aparece al elegir la zona de entrega.",
  "sector-eliminado": "Sector eliminado.",
  "municipio-activado": "Municipio activado.",
  "municipio-desactivado": "Municipio desactivado. Sus sectores dejan de aparecer en la tienda.",
  "producto-guardado": "Producto guardado.",
  "producto-duplicado":
    "Producto duplicado. La copia está inactiva: revísala y actívala cuando esté lista.",
};

export const AVISOS_ERROR: Record<string, string> = {
  "con-datos":
    "No se puede eliminar porque está en uso (tiene productos o subcategorías). Desactívala en su lugar.",
  "sector-con-pedidos":
    "No se puede eliminar porque ya tiene pedidos o clientes. Desactívalo en su lugar.",
  "enlace-invalido":
    "El enlace debe ser una ruta de la tienda (como /catalogo) o empezar por https://.",
  permiso: "No tienes permiso para hacer esto, o el elemento ya no existe.",
  duplicado: "Ya existe un elemento igual.",
  generico: "No pudimos completar la acción. Inténtalo de nuevo.",
};

export function textoAvisoOk(codigo: string | undefined): string | undefined {
  return codigo ? AVISOS_OK[codigo] : undefined;
}

export function textoAvisoError(
  codigo: string | undefined,
): string | undefined {
  return codigo ? (AVISOS_ERROR[codigo] ?? AVISOS_ERROR.generico) : undefined;
}

/** Traduce un error de Postgres/Supabase a un código de aviso. */
export function codigoDeError(error: { code?: string }): string {
  switch (error.code) {
    case "23503": // foreign_key_violation: tiene datos relacionados
      return "con-datos";
    case "42501": // insufficient_privilege / RLS
      return "permiso";
    case "23505": // unique_violation
      return "duplicado";
    default:
      return "generico";
  }
}
