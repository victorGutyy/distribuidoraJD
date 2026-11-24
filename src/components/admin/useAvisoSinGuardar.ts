"use client";

import { useEffect } from "react";
import { clicSalePagina } from "@/lib/navegacion-segura";

const MENSAJE = "Tienes cambios sin guardar. Si sales ahora, se perderán. ¿Quieres salir de todas formas?";

/**
 * Avisa antes de perder cambios sin guardar:
 * - al cerrar o recargar la pestaña (`beforeunload`);
 * - al hacer clic en cualquier enlace que cambie de página (menú, paginación, «Cancelar»…).
 * No cubre el botón «atrás» del navegador (Next no ofrece cómo interceptarlo).
 * `protegerEnvios` también frena los formularios de filtros de la misma pantalla.
 */
export function useAvisoSinGuardar(hayCambios: boolean, protegerEnvios = false) {
  useEffect(() => {
    if (!hayCambios) return;

    const alSalir = (e: BeforeUnloadEvent) => e.preventDefault();

    const alHacerClic = (e: MouseEvent) => {
      const enlace = (e.target as Element | null)?.closest?.("a");
      if (!enlace) return;
      const sale = clicSalePagina(
        {
          href: enlace.getAttribute("href"),
          target: enlace.getAttribute("target"),
          download: enlace.hasAttribute("download"),
          button: e.button,
          metaKey: e.metaKey,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
        },
        window.location.href,
      );
      if (sale && !window.confirm(MENSAJE)) {
        // En captura y antes que React: el enlace de Next nunca llega a navegar.
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const alEnviar = (e: SubmitEvent) => {
      if (!window.confirm(MENSAJE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", alSalir);
    document.addEventListener("click", alHacerClic, true);
    if (protegerEnvios) document.addEventListener("submit", alEnviar, true);
    return () => {
      window.removeEventListener("beforeunload", alSalir);
      document.removeEventListener("click", alHacerClic, true);
      if (protegerEnvios) document.removeEventListener("submit", alEnviar, true);
    };
  }, [hayCambios, protegerEnvios]);
}
