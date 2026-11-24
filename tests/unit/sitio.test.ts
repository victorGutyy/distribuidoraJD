import { describe, expect, it } from "vitest";
import { resolverUrlSitio } from "@/lib/sitio";

describe("resolverUrlSitio", () => {
  it("prefiere NEXT_PUBLIC_SITE_URL y quita barras y rutas sobrantes", () => {
    expect(resolverUrlSitio({ NEXT_PUBLIC_SITE_URL: "https://evdistribuidora.co/", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" })).toBe(
      "https://evdistribuidora.co",
    );
  });
  it("agrega https si falta el protocolo (Vercel entrega el dominio sin él)", () => {
    expect(resolverUrlSitio({ VERCEL_PROJECT_PRODUCTION_URL: "ev.vercel.app" })).toBe("https://ev.vercel.app");
  });
  it("sin nada configurado usa localhost; un valor inválido se salta", () => {
    expect(resolverUrlSitio({})).toBe("http://localhost:3000");
    expect(resolverUrlSitio({ NEXT_PUBLIC_SITE_URL: "http://", VERCEL_PROJECT_PRODUCTION_URL: "ev.vercel.app" })).toBe("https://ev.vercel.app");
  });
});
