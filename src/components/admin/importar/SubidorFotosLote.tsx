"use client";

import { FolderUp, ImagePlus, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { consultarProductosPorSku } from "@/app/admin/(panel)/importar/fotos-actions";
import { registrarImagenes } from "@/app/admin/(panel)/productos/imagenes-actions";
import { AvisoError, AvisoInfo } from "@/components/admin/Campo";
import { Button } from "@/components/ui/button";
import { ErrorImagen, prepararImagen } from "@/lib/catalogo/comprimir-imagen";
import {
  agruparFotos,
  planearSubida,
  type PlanFotos,
} from "@/lib/catalogo/fotos-lote";
import { BUCKET, errorDeArchivo, LIMITES, rutasDeImagen } from "@/lib/catalogo/imagenes";
import { createClient } from "@/lib/supabase/client";

type Fase = "inicio" | "revisando" | "listo" | "subiendo" | "terminado";
type Fallo = { sku: string; nombre: string; motivo: string };
type Avisos = { invalidos: string[]; repetidos: string[] };

/** Cuántos productos se procesan a la vez (comprimir usa el procesador del equipo). */
const EN_PARALELO = 3;
const OPCIONES_SUBIDA = { contentType: "image/webp", cacheControl: "31536000", upsert: false } as const;

/**
 * Subida de fotos en lote: cada foto se nombra con el SKU del producto (EVC-00001.jpg,
 * EVC-00001_2.jpg…). Primero se revisa qué se va a subir; luego cada foto se convierte a
 * WebP en el navegador, se sube con la sesión de quien la sube y cada producto se registra.
 * Se puede repetir sin duplicar: los productos que ya tienen foto se saltan.
 */
export function SubidorFotosLote() {
  const entradaArchivos = useRef<HTMLInputElement>(null);
  const entradaCarpeta = useRef<HTMLInputElement>(null);
  const detener = useRef(false);
  const [fase, setFase] = useState<Fase>("inicio");
  const [plan, setPlan] = useState<PlanFotos<File> | null>(null);
  const [avisos, setAvisos] = useState<Avisos>({ invalidos: [], repetidos: [] });
  const [omitir, setOmitir] = useState(true);
  const [grupos, setGrupos] = useState<ReturnType<typeof agruparFotos<File>>["grupos"]>([]);
  const [productosPorSku, setProductosPorSku] = useState<Parameters<typeof planearSubida>[1]>({});
  const [error, setError] = useState<string | null>(null);
  const [hechos, setHechos] = useState(0);
  const [fotosSubidas, setFotosSubidas] = useState(0);
  const [actual, setActual] = useState("");
  const [fallos, setFallos] = useState<Fallo[]>([]);
  const [detenido, setDetenido] = useState(false);

  // Avisa al cerrar o recargar la pestaña a mitad de una subida.
  useEffect(() => {
    if (fase !== "subiendo") return;
    const alSalir = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", alSalir);
    return () => window.removeEventListener("beforeunload", alSalir);
  }, [fase]);

  const replanificar = useCallback(
    (g: typeof grupos, productos: typeof productosPorSku, omitirConFoto: boolean) =>
      setPlan(planearSubida(g, productos, { omitirConFoto, maxPorProducto: LIMITES.maxPorProducto })),
    [],
  );

  async function revisar(lista: File[]) {
    if (lista.length === 0) return;
    setError(null);
    setFase("revisando");
    const imagenes = lista.filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(f.name));
    const { grupos: g, invalidos, repetidos } = agruparFotos(imagenes.map((archivo) => ({ archivo, nombre: archivo.name })));
    setAvisos({ invalidos: [...lista.filter((f) => !imagenes.includes(f)).map((f) => f.name), ...invalidos], repetidos });
    if (g.length === 0) {
      setError("Ningún archivo tiene un nombre válido. Deben llamarse como el SKU, por ejemplo EVC-00001.jpg");
      setFase("inicio");
      return;
    }
    const r = await consultarProductosPorSku(g.map((x) => x.sku));
    if (r.error || !r.productos) {
      setError(r.error ?? "No pudimos consultar el catálogo.");
      setFase("inicio");
      return;
    }
    setGrupos(g);
    setProductosPorSku(r.productos);
    replanificar(g, r.productos, omitir);
    setFase("listo");
  }

  async function subir() {
    if (!plan) return;
    detener.current = false;
    setDetenido(false);
    setFase("subiendo");
    setHechos(0);
    setFotosSubidas(0);
    setFallos([]);
    const supabase = createClient();
    const cola = [...plan.porSubir];

    async function subirProducto(p: PlanFotos<File>["porSubir"][number]) {
      const uuids: string[] = [];
      const rutas: string[] = [];
      try {
        for (const { archivo } of p.archivos) {
          const problema = errorDeArchivo(archivo.type || "image/jpeg", archivo.size);
          if (problema) throw new ErrorImagen(`${archivo.name}: ${problema}`);
          const { grande, miniatura } = await prepararImagen(archivo);
          const uuid = crypto.randomUUID();
          const r = rutasDeImagen(p.productoId, uuid);
          const a = await supabase.storage.from(BUCKET).upload(r.grande, grande, OPCIONES_SUBIDA);
          if (a.error) throw new ErrorImagen("No se pudo subir (¿se cerró tu sesión?).");
          rutas.push(r.grande);
          const b = await supabase.storage.from(BUCKET).upload(r.miniatura, miniatura, OPCIONES_SUBIDA);
          if (b.error) throw new ErrorImagen("No se pudo subir la miniatura.");
          rutas.push(r.miniatura);
          uuids.push(uuid);
        }
        const registro = await registrarImagenes(p.productoId, uuids);
        if (registro.error) throw new ErrorImagen(registro.error);
        setFotosSubidas((n) => n + uuids.length);
      } catch (e) {
        if (rutas.length > 0) await supabase.storage.from(BUCKET).remove(rutas);
        setFallos((f) => [
          ...f,
          { sku: p.sku, nombre: p.nombre, motivo: e instanceof ErrorImagen ? e.message : "No se pudo procesar la imagen." },
        ]);
      } finally {
        setHechos((n) => n + 1);
      }
    }

    async function trabajador() {
      while (!detener.current) {
        const p = cola.shift();
        if (!p) return;
        setActual(`${p.sku} · ${p.nombre}`);
        await subirProducto(p);
      }
    }

    await Promise.all(Array.from({ length: EN_PARALELO }, trabajador));
    setActual("");
    setDetenido(detener.current);
    setFase("terminado");
  }

  const total = plan?.porSubir.length ?? 0;
  const totalFotos = plan?.porSubir.reduce((s, p) => s + p.archivos.length, 0) ?? 0;
  const ocupado = fase === "revisando" || fase === "subiendo";
  const clase =
    "inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border bg-background px-4 text-sm font-medium hover:bg-muted";

  return (
    <div className="grid gap-4">
      {error ? <AvisoError>{error}</AvisoError> : null}

      {fase === "inicio" || fase === "revisando" ? (
        <div className="flex flex-wrap gap-2">
          <label className={clase}>
            <ImagePlus aria-hidden="true" className="size-4" /> Elegir fotos
            <input ref={entradaArchivos} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={ocupado} onChange={(e) => void revisar(Array.from(e.target.files ?? []))} />
          </label>
          <label className={clase}>
            <FolderUp aria-hidden="true" className="size-4" /> Elegir una carpeta
            <input ref={entradaCarpeta} type="file" multiple className="sr-only" disabled={ocupado} onChange={(e) => void revisar(Array.from(e.target.files ?? []))} {...({ webkitdirectory: "" } as Record<string, string>)} />
          </label>
          {fase === "revisando" ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Revisando los nombres…
            </p>
          ) : null}
        </div>
      ) : null}

      {fase !== "inicio" && fase !== "revisando" && plan ? (
        <div className="grid gap-3 rounded-xl border p-4 text-sm">
          <p>
            <b>{totalFotos}</b> {totalFotos === 1 ? "foto" : "fotos"} de <b>{total}</b> {total === 1 ? "producto" : "productos"} para subir.
          </p>
          <ul className="grid gap-1 text-muted-foreground">
            {plan.yaTienenFoto.length > 0 ? <li>{plan.yaTienenFoto.length} productos ya tienen foto y se omiten.</li> : null}
            {plan.sinProducto.length > 0 ? <li className="text-destructive">{plan.sinProducto.length} SKU no existen en el catálogo (se ignoran): {plan.sinProducto.slice(0, 8).join(", ")}{plan.sinProducto.length > 8 ? "…" : ""}</li> : null}
            {avisos.invalidos.length > 0 ? <li className="text-destructive">{avisos.invalidos.length} archivos con nombre no válido: {avisos.invalidos.slice(0, 5).join(", ")}{avisos.invalidos.length > 5 ? "…" : ""}</li> : null}
            {avisos.repetidos.length > 0 ? <li>{avisos.repetidos.length} archivos repetidos (se usó el primero).</li> : null}
            {plan.recortadas > 0 ? <li>{plan.recortadas} fotos de más (máximo {LIMITES.maxPorProducto} por producto).</li> : null}
          </ul>

          {fase === "listo" ? (
            <>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 font-medium">
                <input
                  type="checkbox"
                  checked={omitir}
                  onChange={(e) => {
                    setOmitir(e.target.checked);
                    replanificar(grupos, productosPorSku, e.target.checked);
                  }}
                  className="size-5 accent-ev-azul"
                />
                Omitir los productos que ya tienen foto
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" className="h-11" disabled={total === 0} onClick={() => void subir()}>
                  Subir {totalFotos} {totalFotos === 1 ? "foto" : "fotos"}
                </Button>
                <Button type="button" variant="outline" className="h-11" onClick={() => { setFase("inicio"); setPlan(null); }}>
                  Elegir otras
                </Button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {fase === "subiendo" || fase === "terminado" ? (
        <div className="grid gap-3 rounded-xl border p-4 text-sm" aria-live="polite">
          <div className="h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={hechos} aria-label="Avance de la subida">
            <div className="h-full rounded-full bg-ev-azul transition-all" style={{ width: `${total ? Math.round((hechos / total) * 100) : 0}%` }} />
          </div>
          <p>
            {hechos} de {total} productos · {fotosSubidas} fotos subidas · {fallos.length} con error
          </p>
          {fase === "subiendo" ? (
            <>
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {actual || "Terminando…"}
              </p>
              <p className="text-xs text-muted-foreground">No cierres esta pestaña mientras sube. Si se corta, vuelve a elegir las mismas fotos: lo ya subido se omite.</p>
              <div>
                <Button type="button" variant="outline" className="h-11" onClick={() => { detener.current = true; }}>
                  Detener después de los actuales
                </Button>
              </div>
            </>
          ) : (
            <>
              <AvisoInfo>
                {detenido ? "Subida detenida." : "Subida terminada."} Los productos con foto ya se ven con ella en la tienda.
              </AvisoInfo>
              <div>
                <Button type="button" className="h-11" onClick={() => { setFase("inicio"); setPlan(null); }}>
                  Subir otras fotos
                </Button>
              </div>
            </>
          )}
          {fallos.length > 0 ? (
            <div>
              <p className="font-medium text-destructive">No se pudieron subir {fallos.length}:</p>
              <ul className="mt-1 max-h-48 overflow-auto text-xs">
                {fallos.slice(0, 100).map((f) => (
                  <li key={f.sku}>
                    <b>{f.sku}</b> ({f.nombre}): {f.motivo}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted-foreground">Para reintentarlos, vuelve a elegir las mismas fotos: solo se subirán las que faltan.</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
