import { describe, expect, it } from "vitest";
import { cabecerasDeSeguridad, construirCSP } from "@/lib/seguridad";

const SUPA = "https://abc.supabase.co";

describe("construirCSP", () => {
  it("prohíbe que otros sitios incrusten la página y bloquea object/base", () => {
    const csp = construirCSP({ supabaseUrl: SUPA, produccion: true });
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("autoriza solo nuestro Supabase para imágenes y conexiones", () => {
    const csp = construirCSP({ supabaseUrl: SUPA, produccion: true });
    expect(csp).toContain(`img-src 'self' data: blob: ${SUPA}`);
    expect(csp).toContain(`connect-src 'self' ${SUPA} wss://abc.supabase.co`);
  });

  it("permite eval y no fuerza https solo en desarrollo", () => {
    const dev = construirCSP({ supabaseUrl: SUPA, produccion: false });
    const prod = construirCSP({ supabaseUrl: SUPA, produccion: true });
    expect(dev).toContain("'unsafe-eval'");
    expect(prod).not.toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
    expect(prod).toContain("upgrade-insecure-requests");
  });

  it("funciona sin URL de Supabase o con una inválida", () => {
    expect(construirCSP({ supabaseUrl: null, produccion: true })).toContain("connect-src 'self';");
    expect(construirCSP({ supabaseUrl: "no es url", produccion: true })).toContain("connect-src 'self';");
  });
});

describe("cabecerasDeSeguridad", () => {
  const nombres = (p: boolean) => cabecerasDeSeguridad({ supabaseUrl: SUPA, produccion: p }).map((c) => c.key);

  it("incluye las cabeceras básicas siempre", () => {
    for (const k of ["Content-Security-Policy", "X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy"]) {
      expect(nombres(false)).toContain(k);
    }
  });

  it("HSTS solo en producción (en localhost dejaría el navegador forzando https)", () => {
    expect(nombres(true)).toContain("Strict-Transport-Security");
    expect(nombres(false)).not.toContain("Strict-Transport-Security");
  });
});
