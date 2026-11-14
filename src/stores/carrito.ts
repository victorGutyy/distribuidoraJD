import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import {
  agregarItem,
  aplicarVigentes,
  cambiarCantidad,
  quitarItem,
  sanitizarItems,
  sanitizarUbicacion,
  type DatosItem,
  type DatosVigentes,
  type ItemCarrito,
  type ResultadoAgregar,
  type UbicacionPedido,
} from "@/lib/carrito";

/**
 * Almacén del carrito en el NAVEGADOR (Zustand + localStorage, RF-08). Solo se
 * guarda lo necesario para mostrar el carrito; los precios NO son definitivos:
 * se revalidan al abrirlo y el servidor los recalcula al crear el pedido (RN-06).
 */

export const CLAVE_CARRITO = "ev-carrito";

type Estado = {
  items: ItemCarrito[];
  ubicacion: UbicacionPedido | null;
  /** true cuando ya se leyó lo guardado en el navegador (evita diferencias con el servidor al pintar). */
  hidratado: boolean;
  panelAbierto: boolean;
  avisos: string[];
  agregar: (datos: DatosItem, cantidad: number) => ResultadoAgregar;
  cambiarCantidad: (varianteId: number, cantidad: number) => void;
  quitar: (varianteId: number) => void;
  vaciar: () => void;
  aplicarVigentes: (vigentes: ReadonlyMap<number, DatosVigentes | null>) => void;
  descartarAvisos: () => void;
  fijarUbicacion: (ubicacion: UbicacionPedido | null) => void;
  abrirPanel: () => void;
  cerrarPanel: () => void;
};

/** localStorage puede faltar o fallar (modo privado, cuota llena): el carrito sigue funcionando en memoria. */
const almacenSeguro: StateStorage = {
  getItem: (nombre) => {
    try {
      return localStorage.getItem(nombre);
    } catch {
      return null;
    }
  },
  setItem: (nombre, valor) => {
    try {
      localStorage.setItem(nombre, valor);
    } catch {
      /* sin almacenamiento: se ignora */
    }
  },
  removeItem: (nombre) => {
    try {
      localStorage.removeItem(nombre);
    } catch {
      /* sin almacenamiento: se ignora */
    }
  },
};

export const useCarrito = create<Estado>()(
  persist(
    (set, get) => ({
      items: [],
      ubicacion: null,
      hidratado: false,
      panelAbierto: false,
      avisos: [],
      agregar: (datos, cantidad) => {
        const r = agregarItem(get().items, datos, cantidad);
        if (r.agregado) set({ items: r.items });
        return r;
      },
      cambiarCantidad: (varianteId, cantidad) =>
        set((s) => ({ items: cambiarCantidad(s.items, varianteId, cantidad) })),
      quitar: (varianteId) => set((s) => ({ items: quitarItem(s.items, varianteId) })),
      vaciar: () => set({ items: [], avisos: [] }),
      aplicarVigentes: (vigentes) => {
        const r = aplicarVigentes(get().items, vigentes);
        set({ items: r.items, avisos: r.avisos });
      },
      descartarAvisos: () => set({ avisos: [] }),
      fijarUbicacion: (ubicacion) => set({ ubicacion }),
      abrirPanel: () => set({ panelAbierto: true }),
      cerrarPanel: () => set({ panelAbierto: false }),
    }),
    {
      name: CLAVE_CARRITO,
      version: 1,
      storage: createJSONStorage(() => almacenSeguro),
      // Solo esto se guarda; lo demás (panel abierto, avisos) es de la sesión actual.
      partialize: (s) => ({ items: s.items, ubicacion: s.ubicacion }),
      // Lo guardado puede estar dañado o alterado: se limpia antes de usarlo.
      merge: (guardado, actual) => {
        const g = (guardado ?? {}) as { items?: unknown; ubicacion?: unknown };
        return {
          ...actual,
          items: sanitizarItems(g.items),
          ubicacion: sanitizarUbicacion(g.ubicacion),
        };
      },
      // Se lee el navegador después de montar la página (ver ProveedorTienda), no al cargar el módulo.
      skipHydration: true,
    },
  ),
);
