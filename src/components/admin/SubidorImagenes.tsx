"use client";

import { ImagePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { registrarImagenes } from "@/app/admin/(panel)/productos/imagenes-actions";
import { ErrorImagen, prepararImagen } from "@/lib/catalogo/comprimir-imagen";
import {
  BUCKET,
  errorDeArchivo,
  LIMITES,
  rutasDeImagen,
  TIPOS_PERMITIDOS,
} from "@/lib/catalogo/imagenes";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Fase = "comprimiendo" | "subiendo" | "listo" | "error";
type Item = { clave: string; nombre: string; fase: Fase; detalle?: string };

const TEXTO_FASE: Record<Fase, string> = {
  comprimiendo: "Optimizando…",
  subiendo: "Subiendo…",
  listo: "Listo",
  error: "No se pudo",
};

type Props = { productoId: number; cantidadActual: number };

/**
 * Subida de imágenes: cada foto se convierte a WebP en el navegador, se sube al
 * bucket (con la sesión de quien la sube; RLS exige admin o editor) y por último
 * se registra en la base con una Server Action que verifica los archivos.
 */
export function SubidorImagenes({ productoId, cantidadActual }: Props) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const cupo = Math.max(0, LIMITES.maxPorProducto - cantidadActual);

  const cambiar = (clave: string, cambios: Partial<Item>) =>
    setItems((prev) =>
      prev.map((i) => (i.clave === clave ? { ...i, ...cambios } : i)),
    );

  async function procesar(archivos: File[]) {
    if (ocupado || archivos.length === 0) return;
    const lote = Date.now();
    const lista = archivos.map((archivo, i) => ({
      archivo,
      clave: `${lote}-${i}`,
    }));
    setItems(
      lista.map(({ archivo, clave }) => ({
        clave,
        nombre: archivo.name,
        fase: "comprimiendo",
      })),
    );
    setOcupado(true);

    const supabase = createClient();
    const subidas: { clave: string; uuid: string }[] = [];
    const rutas: string[] = [];

    for (const [indice, { archivo, clave }] of lista.entries()) {
      const problema =
        indice >= cupo
          ? `Máximo ${LIMITES.maxPorProducto} imágenes por producto.`
          : errorDeArchivo(archivo.type, archivo.size);
      if (problema) {
        cambiar(clave, { fase: "error", detalle: problema });
        continue;
      }
      try {
        const { grande, miniatura } = await prepararImagen(archivo);
        cambiar(clave, { fase: "subiendo" });

        const uuid = crypto.randomUUID();
        const r = rutasDeImagen(productoId, uuid);
        const opciones = {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: false,
        };
        const a = await supabase.storage
          .from(BUCKET)
          .upload(r.grande, grande, opciones);
        if (a.error)
          throw new ErrorImagen(
            "No se pudo subir. Revisa tu conexión o vuelve a ingresar.",
          );
        const b = await supabase.storage
          .from(BUCKET)
          .upload(r.miniatura, miniatura, opciones);
        if (b.error) {
          await supabase.storage.from(BUCKET).remove([r.grande]);
          throw new ErrorImagen("No se pudo subir la miniatura.");
        }
        subidas.push({ clave, uuid });
        rutas.push(r.grande, r.miniatura);
      } catch (e) {
        cambiar(clave, {
          fase: "error",
          detalle:
            e instanceof ErrorImagen
              ? e.message
              : "No se pudo procesar la imagen.",
        });
      }
    }

    if (subidas.length > 0) {
      const resultado = await registrarImagenes(
        productoId,
        subidas.map((s) => s.uuid),
      );
      if (resultado.error) {
        await supabase.storage.from(BUCKET).remove(rutas);
        for (const { clave } of subidas)
          cambiar(clave, { fase: "error", detalle: resultado.error });
      } else {
        for (const { clave } of subidas) cambiar(clave, { fase: "listo" });
        router.refresh();
      }
    }
    setOcupado(false);
    if (entrada.current) entrada.current.value = "";
  }

  return (
    <div className="grid gap-3">
      <label
        htmlFor="subir-imagenes"
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          void procesar(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-4 text-center text-sm focus-within:ring-3 focus-within:ring-ring/50",
          arrastrando ? "border-ev-azul bg-ev-azul/5" : "border-border",
          (ocupado || cupo === 0) && "pointer-events-none opacity-60",
        )}
      >
        <ImagePlus aria-hidden className="size-6 text-muted-foreground" />
        <span className="font-medium">
          {cupo === 0
            ? "Llegaste al máximo de imágenes"
            : "Toca para elegir fotos o arrástralas aquí"}
        </span>
        <span className="text-xs text-muted-foreground">
          JPG, PNG o WebP. Se optimizan solas (máx. 1200 px). Quedan {cupo} de{" "}
          {LIMITES.maxPorProducto}.
        </span>
        <input
          ref={entrada}
          id="subir-imagenes"
          type="file"
          multiple
          accept={TIPOS_PERMITIDOS.join(",")}
          disabled={ocupado || cupo === 0}
          className="sr-only"
          onChange={(e) => void procesar(Array.from(e.target.files ?? []))}
        />
      </label>

      {items.length > 0 ? (
        <ul className="grid gap-1.5 text-sm" aria-live="polite">
          {items.map((i) => (
            <li key={i.clave} className="flex flex-wrap items-baseline gap-x-2">
              <span className="max-w-[16rem] truncate font-medium">
                {i.nombre}
              </span>
              <span
                className={
                  i.fase === "error" ? "text-red-700" : "text-muted-foreground"
                }
              >
                {TEXTO_FASE[i.fase]}
                {i.detalle ? `: ${i.detalle}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
