import { describe, expect, it } from "vitest";
import { clicSalePagina, type ClicEnlace } from "@/lib/navegacion-segura";

const ACTUAL = "https://ev.co/admin/precios?page=2";
const base: ClicEnlace = { href: "/admin/productos", button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

describe("clicSalePagina", () => {
  it("un enlace del menú o de «Siguiente» saca de la página", () => {
    expect(clicSalePagina(base, ACTUAL)).toBe(true);
    expect(clicSalePagina({ ...base, href: "/admin/precios?page=3" }, ACTUAL)).toBe(true);
    expect(clicSalePagina({ ...base, href: "https://otro.com/x" }, ACTUAL)).toBe(true);
  });
  it("no pregunta si abre en otra pestaña, con Ctrl/Cmd/Shift o con clic derecho", () => {
    expect(clicSalePagina({ ...base, target: "_blank" }, ACTUAL)).toBe(false);
    expect(clicSalePagina({ ...base, ctrlKey: true }, ACTUAL)).toBe(false);
    expect(clicSalePagina({ ...base, metaKey: true }, ACTUAL)).toBe(false);
    expect(clicSalePagina({ ...base, shiftKey: true }, ACTUAL)).toBe(false);
    expect(clicSalePagina({ ...base, button: 2 }, ACTUAL)).toBe(false);
  });
  it("no pregunta por anclas de la misma página, descargas ni enlaces que no son web", () => {
    expect(clicSalePagina({ ...base, href: "#fila-3" }, ACTUAL)).toBe(false);
    expect(clicSalePagina({ ...base, href: "/admin/precios?page=2#abajo" }, ACTUAL)).toBe(false);
    expect(clicSalePagina({ ...base, download: true }, ACTUAL)).toBe(false);
    expect(clicSalePagina({ ...base, href: "mailto:a@b.co" }, ACTUAL)).toBe(false);
    expect(clicSalePagina({ ...base, href: null }, ACTUAL)).toBe(false);
  });
});
