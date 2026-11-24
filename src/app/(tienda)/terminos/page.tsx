import type { Metadata } from "next";
import Link from "next/link";
import { PaginaInformativa } from "@/components/tienda/PaginaInformativa";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  alternates: { canonical: "/terminos" },
};

/**
 * TEXTO PROVISIONAL (RNF-09). El cliente debe revisarlo con su asesor legal y completar
 * razón social, NIT y dirección antes de abrir la tienda al público.
 */
export default function Terminos() {
  return (
    <PaginaInformativa titulo="Términos y condiciones" provisional>
      <p>
        Estos términos regulan el uso del catálogo de EV Distribuidora y la forma en que tomamos tus pedidos.
        Al enviar un pedido aceptas lo que sigue.
      </p>
      <h2 className="font-semibold">Pedidos</h2>
      <p>
        El pedido se arma en la página y se envía por WhatsApp. Un pedido solo queda confirmado cuando
        nuestro equipo te responde confirmando disponibilidad, valor y fecha de entrega.
      </p>
      <h2 className="font-semibold">Precios y disponibilidad</h2>
      <p>
        Los precios están en pesos colombianos (COP) y pueden cambiar sin previo aviso. El precio que se
        cobra es el vigente al confirmar el pedido. Si un producto se agota, te avisaremos para ofrecerte
        una alternativa o retirarlo del pedido.
      </p>
      <h2 className="font-semibold">Pago y entrega</h2>
      <p>
        El pago es contraentrega, en efectivo o por el medio que acordemos al confirmar. La entrega se hace
        en los municipios y días de reparto publicados; la fecha estimada que ves es una promesa de
        servicio sujeta a disponibilidad y a imprevistos de ruta.
      </p>
      <h2 className="font-semibold">Cambios y devoluciones</h2>
      <p>
        Revisa tu pedido al recibirlo. Si hay un producto dañado, incompleto o equivocado, avísanos en el
        momento de la entrega o el mismo día por WhatsApp para resolverlo.
      </p>
      <h2 className="font-semibold">Datos personales</h2>
      <p>
        Tratamos tus datos según nuestra{" "}
        <Link className="underline" href="/politica-de-datos">
          política de tratamiento de datos
        </Link>
        .
      </p>
    </PaginaInformativa>
  );
}
