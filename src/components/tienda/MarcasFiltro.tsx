"use client";

import { useState } from "react";

type Marca = { id: number; nombre: string; slug: string; n: number };

/**
 * Casillas de marcas (RF-05). Con más de 10 marcas aparece un buscador que
 * filtra la lista sin recargar la página. Las casillas viajan con el formulario
 * de filtros (name="marca"), así que funciona igual sin JavaScript.
 */
export function MarcasFiltro({
  marcas,
  seleccionadas,
  idPrefijo,
}: {
  marcas: Marca[];
  seleccionadas: string[];
  idPrefijo: string;
}) {
  const [texto, setTexto] = useState("");
  const buscar = texto.trim().toLowerCase();
  const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  if (marcas.length === 0) return null;
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-semibold">Marca</legend>
      {marcas.length > 10 ? (
        <>
          <label htmlFor={`${idPrefijo}-buscar-marca`} className="sr-only">
            Buscar marca
          </label>
          <input
            id={`${idPrefijo}-buscar-marca`}
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar marca"
            className="h-10 rounded-lg border bg-background px-3 text-base md:text-sm"
          />
        </>
      ) : null}
      <ul className="grid max-h-56 gap-0.5 overflow-y-auto">
        {marcas.map((m) => {
          const oculta = buscar !== "" && !sinTildes(m.nombre).includes(sinTildes(buscar));
          return (
            <li key={m.id} hidden={oculta}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name="marca"
                  value={m.slug}
                  defaultChecked={seleccionadas.includes(m.slug)}
                  className="size-5 accent-ev-azul"
                />
                <span className="flex-1">{m.nombre}</span>
                <span className="text-xs text-muted-foreground">{m.n}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
