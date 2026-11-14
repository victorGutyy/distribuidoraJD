/** Franja negra con el mensaje configurable (RF-01). No se dibuja si no hay mensaje. */
export function BarraSuperior({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <p className="bg-ev-negro px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">
      {mensaje}
    </p>
  );
}
