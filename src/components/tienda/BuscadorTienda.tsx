"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { Sugerencia } from "@/lib/tienda/consultas";

/**
 * Buscador del encabezado (RF-04). Es un <form method="get"> que envía a
 * /catalogo?q=…, así que funciona aunque no cargue JavaScript. Con JavaScript,
 * a partir de 2 caracteres (y 300 ms después de dejar de escribir) muestra hasta
 * 6 sugerencias. Teclado: flechas para elegir, Enter para abrir, Esc para cerrar.
 */
export function BuscadorTienda({ valorInicial = "" }: { valorInicial?: string }) {
  const router = useRouter();
  const id = useId();
  const [texto, setTexto] = useState(valorInicial);
  // Sugerencias junto con el texto para el que se pidieron: así no se muestran las de otro texto.
  const [datos, setDatos] = useState<{ q: string; items: Sugerencia[] }>({ q: "", items: [] });
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = texto.trim();
    if (q.length < 2) return;
    const control = new AbortController();
    const espera = setTimeout(async () => {
      try {
        const r = await fetch(`/api/sugerencias?q=${encodeURIComponent(q)}`, {
          signal: control.signal,
        });
        if (!r.ok) return;
        const cuerpo = (await r.json()) as { items: Sugerencia[] };
        setDatos({ q, items: cuerpo.items });
        setActivo(-1);
        setAbierto(true);
      } catch {
        // Cancelada o sin conexión: se ignora; el botón Buscar sigue funcionando.
      }
    }, 300);
    return () => {
      clearTimeout(espera);
      control.abort();
    };
  }, [texto]);

  // Se cierra al hacer clic fuera.
  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const items = datos.items;
  const mostrar = abierto && texto.trim().length >= 2 && datos.q === texto.trim();
  const total = items.length + 1; // sugerencias + "ver todos los resultados"

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!mostrar) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((a) => (a + 1) % total);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((a) => (a <= 0 ? total - 1 : a - 1));
    } else if (e.key === "Escape") {
      setAbierto(false);
    } else if (e.key === "Enter" && activo >= 0 && activo < items.length) {
      e.preventDefault();
      setAbierto(false);
      router.push(`/producto/${items[activo].slug}`);
    }
  }

  return (
    <div ref={contenedor} className="relative w-full">
      <form role="search" action="/catalogo" method="get" onSubmit={() => setAbierto(false)}>
        <label htmlFor={`${id}-q`} className="sr-only">
          Buscar productos
        </label>
        <input
          id={`${id}-q`}
          name="q"
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onFocus={() => setAbierto(true)}
          onKeyDown={alTeclear}
          placeholder="Buscar productos, marcas o SKU"
          autoComplete="off"
          role="combobox"
          aria-expanded={mostrar}
          aria-controls={`${id}-lista`}
          aria-autocomplete="list"
          aria-activedescendant={activo >= 0 ? `${id}-op-${activo}` : undefined}
          className="h-11 w-full rounded-full border bg-background pr-12 pl-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
        />
        <button
          type="submit"
          aria-label="Buscar"
          className="absolute top-0 right-0 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        >
          <Search className="size-5" aria-hidden="true" />
        </button>
      </form>

      {mostrar ? (
        <ul
          id={`${id}-lista`}
          role="listbox"
          aria-label="Sugerencias"
          className="absolute top-12 right-0 left-0 z-50 overflow-hidden rounded-xl border bg-background shadow-lg"
        >
          {items.map((s, i) => (
            <li
              key={s.slug}
              id={`${id}-op-${i}`}
              role="option"
              aria-selected={activo === i}
              className={activo === i ? "bg-muted" : undefined}
            >
              <a
                href={`/producto/${s.slug}`}
                onClick={() => setAbierto(false)}
                className="flex min-h-11 flex-col justify-center px-4 py-1.5 text-sm hover:bg-muted"
              >
                <span className="font-medium">{s.nombre}</span>
                {s.marca ? <span className="text-xs text-muted-foreground">{s.marca}</span> : null}
              </a>
            </li>
          ))}
          <li
            id={`${id}-op-${items.length}`}
            role="option"
            aria-selected={activo === items.length}
            className={activo === items.length ? "bg-muted" : undefined}
          >
            <a
              href={`/catalogo?q=${encodeURIComponent(texto.trim())}`}
              className="flex min-h-11 items-center border-t px-4 text-sm font-semibold hover:bg-muted"
            >
              {items.length === 0
                ? `Sin sugerencias: buscar «${texto.trim()}»`
                : `Ver todos los resultados para «${texto.trim()}»`}
            </a>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
