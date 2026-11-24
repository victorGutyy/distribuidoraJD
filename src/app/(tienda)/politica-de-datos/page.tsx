import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de tratamiento de datos",
  alternates: { canonical: "/politica-de-datos" },
};

/**
 * TEXTO PROVISIONAL. Antes de publicar la tienda, el cliente debe revisar este texto
 * con su asesor legal y completar los datos del responsable (fase F7, RNF-09).
 */
export default function PoliticaDeDatos() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Política de tratamiento de datos personales</h1>
      <p className="mb-4 rounded-lg border border-ev-dorado bg-ev-dorado/10 p-3 text-sm">
        Texto provisional: pendiente de revisión legal antes de abrir la tienda al público.
      </p>
      <div className="grid gap-4 text-sm leading-relaxed">
        <p>
          EV Distribuidora recoge tu nombre, celular, dirección y los datos de tu negocio únicamente para
          tomar, preparar y entregar tus pedidos, y para comunicarnos contigo sobre ellos, conforme a la Ley
          1581 de 2012.
        </p>
        <p>
          No vendemos ni compartimos tus datos con terceros, salvo lo necesario para la entrega. Puedes
          consultar, actualizar o pedir que eliminemos tus datos escribiéndonos por WhatsApp.
        </p>
        <p>Guardamos tus datos mientras sean necesarios para atender tus pedidos y cumplir obligaciones legales.</p>
      </div>
    </main>
  );
}
