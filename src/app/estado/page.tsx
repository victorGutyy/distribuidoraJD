import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// PÁGINA TEMPORAL (F0/F1): comprueba que .env.local está bien configurado, que
// Supabase responde y que RLS y la service_role funcionan desde la aplicación.
// Se elimina antes de publicar. Nunca muestra valores de claves ni datos.
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

// F1: con la clave pública, RLS solo deja leer lo público. La configuración
// pública tiene 9 claves y los pedidos NO deben poder leerse.
async function probarRls(): Promise<Resultado> {
  try {
    const supabase = await createClient();
    const config = await supabase
      .from("configuracion")
      .select("clave", { count: "exact", head: true });
    const pedidos = await supabase
      .from("pedidos")
      .select("id", { count: "exact", head: true });
    if (config.error) {
      return {
        ok: false,
        detalle: `Falló la lectura pública: ${config.error.message}`,
      };
    }
    // Sin sesión, 'pedidos' debe rechazarse (error de permiso), nunca devolver filas.
    const pedidosBloqueados = Boolean(pedidos.error);
    return {
      ok: (config.count ?? 0) > 0 && pedidosBloqueados,
      detalle: `Config pública legible: ${config.count ?? 0} claves. Pedidos ${
        pedidosBloqueados
          ? "bloqueados al público (correcto)"
          : "¡LEGIBLES! Revisa RLS"
      }.`,
    };
  } catch (e) {
    return {
      ok: false,
      detalle: e instanceof Error ? e.message : "Error desconocido.",
    };
  }
}

// F1: la service_role (solo servidor) omite RLS; debe poder contar los perfiles.
async function probarServiceRole(): Promise<Resultado> {
  try {
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("perfiles")
      .select("id", { count: "exact", head: true });
    if (error) return { ok: false, detalle: `Falló: ${error.message}` };
    return {
      ok: (count ?? 0) > 0,
      detalle: `La service_role lee perfiles: ${count}.`,
    };
  } catch (e) {
    return {
      ok: false,
      detalle: e instanceof Error ? e.message : "Error desconocido.",
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
  const rls = await probarRls();
  const servicio = await probarServiceRole();

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
      <Fila {...rls} titulo="RLS con la clave pública (F1)" />
      <Fila {...servicio} titulo="Cliente de servidor con service_role (F1)" />
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
