/**
 * Matriz de permisos del panel (docs/01_REQUERIMIENTOS.md §6).
 *
 * Lógica PURA (sin Next ni Supabase) para poder probarla con Vitest.
 *
 * ⚠️ Esto decide qué se MUESTRA y a qué rutas se deja entrar, pero la
 * protección real de los datos es RLS en la base de datos y la comprobación
 * del rol en cada Server Action. Ocultar un botón no protege nada.
 */

export type Rol = "admin" | "editor" | "vendedor";

export const ROLES: readonly Rol[] = ["admin", "editor", "vendedor"];

export const ETIQUETA_ROL: Record<Rol, string> = {
  admin: "Administrador",
  editor: "Editor",
  vendedor: "Vendedor",
};

export type Seccion =
  | "dashboard"
  | "productos"
  | "categorias"
  | "marcas"
  | "precios"
  | "inventario"
  | "importar"
  | "banners"
  | "pedidos"
  | "zonas"
  | "config"
  | "usuarios";

type DefSeccion = {
  etiqueta: string;
  /** Ruta base de la sección dentro del panel. */
  href: string;
  /** Roles que pueden entrar. El vendedor, en productos, solo mira. */
  roles: readonly Rol[];
  /** false = la pantalla aún no está construida (se muestra "Próximamente"). */
  disponible: boolean;
  /** Fase del plan (CLAUDE.md §12) en la que se construye. */
  fase: string;
};

export const SECCIONES: Record<Seccion, DefSeccion> = {
  dashboard: {
    etiqueta: "Inicio",
    href: "/admin",
    roles: ["admin", "editor", "vendedor"],
    disponible: true,
    fase: "F1",
  },
  productos: {
    etiqueta: "Productos",
    href: "/admin/productos",
    roles: ["admin", "editor", "vendedor"],
    disponible: true,
    fase: "F2",
  },
  categorias: {
    etiqueta: "Categorías",
    href: "/admin/categorias",
    roles: ["admin", "editor"],
    disponible: true,
    fase: "F2",
  },
  marcas: {
    etiqueta: "Marcas",
    href: "/admin/marcas",
    roles: ["admin", "editor"],
    disponible: true,
    fase: "F2",
  },
  precios: {
    etiqueta: "Precios",
    href: "/admin/precios",
    roles: ["admin", "editor"],
    disponible: true,
    fase: "F3",
  },
  inventario: {
    etiqueta: "Inventario",
    href: "/admin/inventario",
    // Costos y existencias son privados (RN-14): solo admin y editor.
    roles: ["admin", "editor"],
    disponible: true,
    fase: "RF-32",
  },
  importar: {
    etiqueta: "Importar",
    href: "/admin/importar",
    roles: ["admin", "editor"],
    disponible: true,
    fase: "F3",
  },
  banners: {
    etiqueta: "Banners",
    href: "/admin/banners",
    roles: ["admin", "editor"],
    disponible: true,
    fase: "F6",
  },
  pedidos: {
    etiqueta: "Pedidos",
    href: "/admin/pedidos",
    roles: ["admin", "editor", "vendedor"],
    disponible: true,
    fase: "F6",
  },
  zonas: {
    etiqueta: "Zonas de entrega",
    href: "/admin/zonas",
    roles: ["admin"],
    disponible: true,
    fase: "F6",
  },
  config: {
    etiqueta: "Configuración",
    href: "/admin/config",
    roles: ["admin"],
    disponible: true,
    fase: "F6",
  },
  usuarios: {
    etiqueta: "Usuarios",
    href: "/admin/usuarios",
    roles: ["admin"],
    disponible: true,
    fase: "F6",
  },
};

/** Orden en que aparecen en el menú. */
const ORDEN_MENU: readonly Seccion[] = [
  "dashboard",
  "pedidos",
  "productos",
  "categorias",
  "marcas",
  "precios",
  "inventario",
  "importar",
  "banners",
  "zonas",
  "config",
  "usuarios",
];

/** Páginas del panel que NO requieren sesión (login y recuperación). */
export const RUTAS_ADMIN_PUBLICAS: readonly string[] = [
  "/admin/login",
  "/admin/recuperar",
  "/admin/restablecer",
  "/admin/auth/callback",
  "/admin/auth/confirmar",
];

export function esRutaAdminPublica(pathname: string): boolean {
  return RUTAS_ADMIN_PUBLICAS.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`),
  );
}

/** ¿Es un rol válido? Útil para validar lo que viene de la base de datos. */
export function esRol(valor: unknown): valor is Rol {
  return (
    typeof valor === "string" && (ROLES as readonly string[]).includes(valor)
  );
}

export function puedeVer(rol: Rol, seccion: Seccion): boolean {
  return SECCIONES[seccion].roles.includes(rol);
}

export type ItemMenu = {
  seccion: Seccion;
  etiqueta: string;
  href: string;
  disponible: boolean;
};

/** Secciones del menú para un rol, en orden. */
export function menuParaRol(rol: Rol): ItemMenu[] {
  return ORDEN_MENU.filter((s) => puedeVer(rol, s)).map((s) => ({
    seccion: s,
    etiqueta: SECCIONES[s].etiqueta,
    href: SECCIONES[s].href,
    disponible: SECCIONES[s].disponible,
  }));
}

/**
 * Sección a la que pertenece una ruta del panel.
 * "/admin" → dashboard; "/admin/productos/12/editar" → productos;
 * una ruta desconocida → null.
 */
export function seccionDeRuta(pathname: string): Seccion | null {
  const limpio = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  if (limpio === "/admin") return "dashboard";
  for (const seccion of ORDEN_MENU) {
    const { href } = SECCIONES[seccion];
    if (seccion === "dashboard") continue;
    if (limpio === href || limpio.startsWith(`${href}/`)) return seccion;
  }
  return null;
}

/** ¿Este rol puede entrar a esta ruta del panel? Rutas desconocidas: no. */
export function puedeAccederARuta(rol: Rol, pathname: string): boolean {
  const seccion = seccionDeRuta(pathname);
  return seccion !== null && puedeVer(rol, seccion);
}

/**
 * Ruta a la que volver tras iniciar sesión. Solo se aceptan rutas internas del
 * panel: así el login no sirve para redirigir a un sitio externo (open redirect).
 */
export function rutaAdminSegura(
  valor: string | null | undefined,
  porDefecto = "/admin",
): string {
  if (!valor) return porDefecto;
  // Debe ser una ruta del panel, sin "//", sin esquema (http:) y sin "\".
  if (!valor.startsWith("/admin")) return porDefecto;
  if (valor.startsWith("//") || valor.includes("\\") || valor.includes("://")) {
    return porDefecto;
  }
  if (
    valor !== "/admin" &&
    !valor.startsWith("/admin/") &&
    !valor.startsWith("/admin?")
  ) {
    return porDefecto;
  }
  // No devolver a las propias pantallas de acceso (evita bucles).
  if (esRutaAdminPublica(valor.split("?")[0])) return porDefecto;
  return valor;
}
