import { describe, expect, it } from "vitest";
import {
  esRol,
  esRutaAdminPublica,
  menuParaRol,
  puedeAccederARuta,
  puedeVer,
  rutaAdminSegura,
  seccionDeRuta,
  type Seccion,
} from "@/lib/permisos";

const claves = (rol: "admin" | "editor" | "vendedor") =>
  menuParaRol(rol).map((i) => i.seccion);

describe("matriz de permisos (requerimientos §6)", () => {
  it("el administrador ve todo el panel", () => {
    expect(claves("admin")).toEqual([
      "dashboard",
      "pedidos",
      "productos",
      "categorias",
      "marcas",
      "precios",
      "importar",
      "banners",
      "zonas",
      "config",
      "usuarios",
    ]);
  });

  it("el editor gestiona catálogo, precios, importación y banners; no zonas, config ni usuarios", () => {
    expect(claves("editor")).toEqual([
      "dashboard",
      "pedidos",
      "productos",
      "categorias",
      "marcas",
      "precios",
      "importar",
      "banners",
    ]);
  });

  it("el vendedor solo ve inicio, pedidos y productos (solo lectura)", () => {
    expect(claves("vendedor")).toEqual(["dashboard", "pedidos", "productos"]);
  });

  it("solo el admin entra a zonas, configuración y usuarios", () => {
    const soloAdmin: Seccion[] = ["zonas", "config", "usuarios"];
    for (const s of soloAdmin) {
      expect(puedeVer("admin", s)).toBe(true);
      expect(puedeVer("editor", s)).toBe(false);
      expect(puedeVer("vendedor", s)).toBe(false);
    }
  });

  it("el vendedor no entra a categorías, marcas, precios ni importar", () => {
    for (const s of ["categorias", "marcas", "precios", "importar"] as const) {
      expect(puedeVer("vendedor", s)).toBe(false);
    }
  });

  it("las secciones ya construidas aparecen disponibles y las de fases futuras no", () => {
    const disponibles = menuParaRol("admin")
      .filter((i) => i.disponible)
      .map((i) => i.seccion);
    expect(disponibles).toContain("dashboard");
    expect(disponibles).toContain("categorias");
    expect(disponibles).toContain("marcas");
    expect(disponibles).toContain("importar");
    expect(disponibles).toContain("precios");
    expect(disponibles).toContain("pedidos");
    // Se construyen en F6: siguen como "Próximamente".
    expect(disponibles).toContain("zonas");
    expect(disponibles).not.toContain("usuarios");
  });
});

describe("seccionDeRuta y puedeAccederARuta", () => {
  it("reconoce la sección de una ruta, incluidas las anidadas", () => {
    expect(seccionDeRuta("/admin")).toBe("dashboard");
    expect(seccionDeRuta("/admin/")).toBe("dashboard");
    expect(seccionDeRuta("/admin/productos")).toBe("productos");
    expect(seccionDeRuta("/admin/productos/12/editar")).toBe("productos");
    expect(seccionDeRuta("/admin/pedidos?estado=nuevo")).toBe("pedidos");
  });

  it("no confunde prefijos parecidos", () => {
    expect(seccionDeRuta("/admin/productosx")).toBeNull();
    expect(seccionDeRuta("/admin/zonas-falsas")).toBeNull();
  });

  it("una ruta desconocida no es accesible para nadie", () => {
    expect(seccionDeRuta("/admin/inventada")).toBeNull();
    expect(puedeAccederARuta("admin", "/admin/inventada")).toBe(false);
  });

  it("aplica la matriz a las rutas", () => {
    expect(puedeAccederARuta("admin", "/admin/usuarios")).toBe(true);
    expect(puedeAccederARuta("editor", "/admin/usuarios")).toBe(false);
    expect(puedeAccederARuta("vendedor", "/admin/precios/rapido")).toBe(false);
    expect(puedeAccederARuta("vendedor", "/admin/pedidos/EV-000001")).toBe(
      true,
    );
  });
});

describe("rutas públicas del panel y roles", () => {
  it("reconoce las pantallas de acceso como públicas", () => {
    expect(esRutaAdminPublica("/admin/login")).toBe(true);
    expect(esRutaAdminPublica("/admin/recuperar")).toBe(true);
    expect(esRutaAdminPublica("/admin/restablecer")).toBe(true);
    expect(esRutaAdminPublica("/admin/auth/callback")).toBe(true);
  });

  it("el resto del panel exige sesión", () => {
    expect(esRutaAdminPublica("/admin")).toBe(false);
    expect(esRutaAdminPublica("/admin/productos")).toBe(false);
    expect(esRutaAdminPublica("/admin/login-falso")).toBe(false);
  });

  it("esRol valida lo que llega de la base de datos", () => {
    expect(esRol("admin")).toBe(true);
    expect(esRol("superadmin")).toBe(false);
    expect(esRol(null)).toBe(false);
    expect(esRol(undefined)).toBe(false);
  });
});

describe("rutaAdminSegura (evita open redirect)", () => {
  it("acepta rutas internas del panel", () => {
    expect(rutaAdminSegura("/admin")).toBe("/admin");
    expect(rutaAdminSegura("/admin/pedidos")).toBe("/admin/pedidos");
    expect(rutaAdminSegura("/admin/pedidos?estado=nuevo")).toBe(
      "/admin/pedidos?estado=nuevo",
    );
  });

  it("usa el valor por defecto si no hay ruta", () => {
    expect(rutaAdminSegura(null)).toBe("/admin");
    expect(rutaAdminSegura(undefined)).toBe("/admin");
    expect(rutaAdminSegura("")).toBe("/admin");
    expect(rutaAdminSegura(undefined, "/admin/x")).toBe("/admin/x");
  });

  it("rechaza sitios externos y trucos", () => {
    expect(rutaAdminSegura("https://malo.com")).toBe("/admin");
    expect(rutaAdminSegura("//malo.com")).toBe("/admin");
    expect(rutaAdminSegura("/\\malo.com")).toBe("/admin");
    expect(rutaAdminSegura("/admin//malo.com/../..")).not.toBe("//malo.com");
    expect(rutaAdminSegura("/admin/x?u=https://malo.com")).toBe("/admin");
    expect(rutaAdminSegura("/otra-ruta")).toBe("/admin");
    expect(rutaAdminSegura("/administrador")).toBe("/admin");
    expect(rutaAdminSegura("javascript:alert(1)")).toBe("/admin");
  });

  it("no devuelve a las pantallas de acceso (evita bucles)", () => {
    expect(rutaAdminSegura("/admin/login")).toBe("/admin");
    expect(rutaAdminSegura("/admin/login?next=/admin/x")).toBe("/admin");
    expect(rutaAdminSegura("/admin/recuperar")).toBe("/admin");
  });
});
