import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

// PÁGINA TEMPORAL DE F0: comprueba que .env.local está bien configurado y que
// Supabase responde. Se elimina antes de publicar. Nunca muestra valores de claves.
export const metadata: Metadata = {
  title: "Estado de la conexión",
  robots: { index: false, follow: false },
};

type Resultado = { ok: boolean; detalle: string };

async function probarSupabase(): Promise<Resultado> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { ok: false, detalle: "No se puede probar: faltan variables." };
  }
  try {
    // Endpoint de salud del servicio de autenticación de Supabase.
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return res.ok
      ? { ok: true, detalle: `Supabase respondió ${res.status}.` }
      : {
          ok: false,
          detalle: `Supabase respondió ${res.status}. Revisa que la clave anon sea la correcta.`,
        };
  } catch {
    return {
      ok: false,
      detalle: "No hubo respuesta. Revisa la URL del proyecto y tu internet.",
    };
  }
}

function Fila({ ok, titulo, detalle }: Resultado & { titulo: string }) {
  return (
    <li className="flex gap-3 rounded-lg border p-4">
      <span aria-hidden className="text-xl">
        {ok ? "✅" : "❌"}
      </span>
      <div>
        <p className="font-medium">{titulo}</p>
        <p className="text-sm text-muted-foreground">{detalle}</p>
      </div>
    </li>
  );
}

// Con Cache Components, lo que depende de la visita va dentro de <Suspense>.
// connection() le dice a Next: "esto se calcula en cada petición, no al compilar".
async function ListaEstado() {
  await connection();
  const tieneUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const tieneAnon = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const tieneServicio = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const conexion = await probarSupabase();

  return (
    <ul className="space-y-3">
      <Fila
        ok={tieneUrl}
        titulo="NEXT_PUBLIC_SUPABASE_URL"
        detalle={tieneUrl ? "Definida." : "Falta en .env.local."}
      />
      <Fila
        ok={tieneAnon}
        titulo="NEXT_PUBLIC_SUPABASE_ANON_KEY"
        detalle={tieneAnon ? "Definida." : "Falta en .env.local."}
      />
      <Fila
        ok={tieneServicio}
        titulo="SUPABASE_SERVICE_ROLE_KEY"
        detalle={
          tieneServicio ? "Definida (solo servidor)." : "Falta en .env.local."
        }
      />
      <Fila {...conexion} titulo="Conexión con Supabase" />
    </ul>
  );
}

export default function Estado() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold">Estado de la conexión</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Página temporal de la fase F0. Solo indica si cada variable existe;
        nunca muestra su valor.
      </p>
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Comprobando…</p>}
      >
        <ListaEstado />
      </Suspense>
    </main>
  );
}
