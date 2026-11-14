import Link from "next/link";
import { claseSelect } from "@/components/admin/CampoForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FiltrosPedidos } from "@/lib/filtros-pedidos";
import { ESTADOS_PEDIDO, ETIQUETA_ESTADO } from "@/lib/pedidos";

type Props = {
  filtros: FiltrosPedidos;
  sectores: { id: number; nombre: string; municipio: string }[];
};

function Etiqueta({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <label htmlFor={id} className="text-sm leading-none font-medium">
      {children}
    </label>
  );
}

/**
 * Filtros de la lista de pedidos (RF-27). Es un <form method="get">: quedan en la URL.
 * En la vista por ruta solo importan la fecha de entrega y el sector.
 */
export function FiltrosPedidosForm({ filtros, sectores }: Props) {
  const ruta = filtros.vista === "ruta";
  return (
    <form method="get" action="/admin/pedidos" className="grid gap-3 rounded-xl border bg-background p-4">
      {ruta ? <input type="hidden" name="vista" value="ruta" /> : null}

      {!ruta ? (
        <div className="grid gap-1.5">
          <Etiqueta id="p-q">Buscar por número, nombre, negocio o celular</Etiqueta>
          <Input id="p-q" name="q" type="search" defaultValue={filtros.q} placeholder="Ej. EV-000123, Juan, 310…" className="h-11 text-base md:text-sm" />
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {!ruta ? (
          <div className="grid gap-1.5">
            <Etiqueta id="p-estado">Estado</Etiqueta>
            <select id="p-estado" name="estado" defaultValue={filtros.estado ?? ""} className={claseSelect}>
              <option value="">Todos</option>
              {ESTADOS_PEDIDO.map((e) => (
                <option key={e} value={e}>
                  {ETIQUETA_ESTADO[e]}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="grid gap-1.5">
          <Etiqueta id="p-entrega">Fecha de entrega</Etiqueta>
          <Input id="p-entrega" name="entrega" type="date" defaultValue={filtros.entrega ?? ""} className="h-11 text-base md:text-sm" />
        </div>
        <div className="grid gap-1.5">
          <Etiqueta id="p-sector">Sector</Etiqueta>
          <select id="p-sector" name="sector" defaultValue={filtros.sector ?? ""} className={claseSelect}>
            <option value="">Todos</option>
            {sectores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.municipio} – {s.nombre}
              </option>
            ))}
          </select>
        </div>
        {!ruta ? (
          <>
            <div className="grid gap-1.5">
              <Etiqueta id="p-desde">Hecho desde</Etiqueta>
              <Input id="p-desde" name="desde" type="date" defaultValue={filtros.desde ?? ""} className="h-11 text-base md:text-sm" />
            </div>
            <div className="grid gap-1.5">
              <Etiqueta id="p-hasta">Hecho hasta</Etiqueta>
              <Input id="p-hasta" name="hasta" type="date" defaultValue={filtros.hasta ?? ""} className="h-11 text-base md:text-sm" />
            </div>
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-11">
          Filtrar
        </Button>
        <Link
          href={ruta ? "/admin/pedidos?vista=ruta" : "/admin/pedidos"}
          className="inline-flex h-11 items-center rounded-lg border px-4 text-sm font-medium hover:bg-muted"
        >
          Limpiar filtros
        </Link>
      </div>
    </form>
  );
}
