"use client";

import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { registrarBanner } from "@/app/admin/(panel)/banners/actions";
import { AvisoError } from "@/components/admin/Campo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { comprimirImagen, ErrorImagen } from "@/lib/catalogo/comprimir-imagen";
import { BUCKET, errorDeArchivo, LIMITES_BANNER, rutasDeBanner } from "@/lib/catalogo/imagenes";
import { createClient } from "@/lib/supabase/client";

const clase =
  "block w-full cursor-pointer rounded-lg border bg-background p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground";

/**
 * Subida de un banner (RF-30): la imagen se convierte a WebP en el navegador, se sube al
 * bucket con la sesión de quien la sube y al final se registra con una Server Action.
 */
export function SubidorBanner({ lleno }: { lleno: boolean }) {
  const router = useRouter();
  const [escritorio, setEscritorio] = useState<File | null>(null);
  const [movil, setMovil] = useState<File | null>(null);
  const [enlace, setEnlace] = useState("");
  const [fase, setFase] = useState<"quieto" | "optimizando" | "subiendo">("quieto");
  const [error, setError] = useState<string | null>(null);

  async function subir() {
    if (!escritorio) return;
    setError(null);
    for (const f of [escritorio, movil]) {
      const problema = f ? errorDeArchivo(f.type, f.size) : null;
      if (problema) return setError(problema);
    }
    const supabase = createClient();
    const uuid = crypto.randomUUID();
    const rutas = rutasDeBanner(uuid);
    const subidas: string[] = [];
    try {
      setFase("optimizando");
      const grande = await comprimirImagen(escritorio, LIMITES_BANNER.escritorio.maxLado, LIMITES_BANNER.escritorio.maxBytes);
      const pequena = movil
        ? await comprimirImagen(movil, LIMITES_BANNER.movil.maxLado, LIMITES_BANNER.movil.maxBytes)
        : null;

      setFase("subiendo");
      for (const [ruta, blob] of [[rutas.escritorio, grande], ...(pequena ? [[rutas.movil, pequena] as const] : [])] as const) {
        const { error: e } = await supabase.storage.from(BUCKET).upload(ruta, blob, { contentType: "image/webp", upsert: false });
        if (e) throw new ErrorImagen("No se pudo subir la imagen. ¿Tu sesión sigue activa?");
        subidas.push(ruta);
      }
      const r = await registrarBanner({ uuid, conMovil: Boolean(pequena), enlace });
      if (!r.ok) throw new ErrorImagen(r.error);

      setEscritorio(null);
      setMovil(null);
      setEnlace("");
      router.refresh();
    } catch (e) {
      // Si algo falló, no quedan archivos sueltos en el bucket.
      if (subidas.length > 0) await supabase.storage.from(BUCKET).remove(subidas);
      setError(e instanceof ErrorImagen ? e.message : "No se pudo subir el banner. Inténtalo de nuevo.");
    } finally {
      setFase("quieto");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo banner</CardTitle>
        <CardDescription>
          Imagen horizontal, de unos 1600 × 700 px para escritorio. Si quieres, sube otra pensada para el celular (más cuadrada).
          Se optimizan solas.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {lleno ? (
          <p className="text-sm text-muted-foreground">
            Ya tienes {LIMITES_BANNER.maxBanners} banners, el máximo. Elimina uno para agregar otro.
          </p>
        ) : (
          <>
            {error ? <AvisoError>{error}</AvisoError> : null}
            <label className="grid gap-1.5 text-sm font-medium">
              Imagen para escritorio (obligatoria)
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setEscritorio(e.target.files?.[0] ?? null)} className={clase} disabled={fase !== "quieto"} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Imagen para celular (opcional)
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setMovil(e.target.files?.[0] ?? null)} className={clase} disabled={fase !== "quieto"} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Enlace al hacer clic (opcional)
              <input type="text" value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="/catalogo?ofertas=1" disabled={fase !== "quieto"} className="h-11 rounded-lg border bg-background px-3 text-base md:text-sm" />
              <span className="text-xs font-normal text-muted-foreground">Una ruta de la tienda (/catalogo?ofertas=1) o un enlace que empiece por https://</span>
            </label>
            <div>
              <Button type="button" className="h-11 gap-2" disabled={!escritorio || fase !== "quieto"} onClick={() => void subir()}>
                {fase === "quieto" ? <Upload aria-hidden="true" /> : <Loader2 className="animate-spin" aria-hidden="true" />}
                {fase === "optimizando" ? "Optimizando…" : fase === "subiendo" ? "Subiendo…" : "Subir banner"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
