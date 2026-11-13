"use client";

import {
  FileSpreadsheet,
  Images,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  Settings,
  ShoppingBag,
  Tags,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cerrarSesion } from "@/app/admin/actions";
import { Logo } from "@/components/tienda/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ETIQUETA_ROL,
  type ItemMenu,
  type Rol,
  type Seccion,
} from "@/lib/permisos";

const ICONOS: Record<Seccion, LucideIcon> = {
  dashboard: LayoutDashboard,
  pedidos: ShoppingBag,
  productos: Package,
  precios: Tags,
  importar: FileSpreadsheet,
  banners: Images,
  zonas: MapPin,
  config: Settings,
  usuarios: Users,
};

type Props = {
  nombre: string;
  rol: Rol;
  items: ItemMenu[];
};

export function BarraAdmin({ nombre, rol, items }: Props) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);

  const esActivo = (item: ItemMenu) =>
    item.seccion === "dashboard"
      ? pathname === "/admin"
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <>
      {/* Móvil: barra superior con botón de menú */}
      <header className="flex items-center justify-between border-b bg-background px-4 py-2 md:hidden">
        <Logo className="w-10" sizes="40px" />
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={abierto}
          aria-controls="menu-admin"
          onClick={() => setAbierto((v) => !v)}
        >
          {abierto ? <X aria-hidden /> : <Menu aria-hidden />}
        </Button>
      </header>

      {/* Menú: lateral fijo en escritorio, desplegable en móvil */}
      <aside
        id="menu-admin"
        className={cn(
          "flex-col border-r bg-background md:flex md:w-64 md:shrink-0",
          abierto ? "flex" : "hidden",
        )}
      >
        <div className="hidden items-center gap-3 px-5 py-5 md:flex">
          <Logo className="w-12" sizes="48px" />
          <span className="text-sm font-semibold leading-tight">
            Panel
            <br />
            Distribuidora JD
          </span>
        </div>

        <nav aria-label="Secciones del panel" className="flex-1 px-3 py-2">
          <ul className="grid gap-1">
            {items.map((item) => {
              const Icono = ICONOS[item.seccion];
              const activo = esActivo(item);
              const base =
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium";

              if (!item.disponible) {
                return (
                  <li key={item.seccion}>
                    <span
                      aria-disabled="true"
                      className={cn(
                        base,
                        "cursor-not-allowed text-muted-foreground",
                      )}
                    >
                      <Icono className="size-4" aria-hidden />
                      <span className="flex-1">{item.etiqueta}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        Pronto
                      </span>
                    </span>
                  </li>
                );
              }

              return (
                <li key={item.seccion}>
                  <Link
                    href={item.href}
                    aria-current={activo ? "page" : undefined}
                    onClick={() => setAbierto(false)}
                    className={cn(
                      base,
                      activo
                        ? "bg-jd-amarillo text-jd-negro"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    <Icono className="size-4" aria-hidden />
                    {item.etiqueta}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t px-5 py-4">
          <p className="truncate text-sm font-medium">{nombre}</p>
          <p className="mb-3 text-xs text-muted-foreground">
            {ETIQUETA_ROL[rol]}
          </p>
          <form action={cerrarSesion}>
            <Button type="submit" variant="outline" className="h-11 w-full">
              <LogOut aria-hidden />
              Cerrar sesión
            </Button>
          </form>
        </div>
      </aside>
    </>
  );
}
