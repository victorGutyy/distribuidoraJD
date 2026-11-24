"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { contarPedidosNuevos } from "@/app/admin/(panel)/pedidos/actions";
import { debeSonar } from "@/lib/aviso-pedido";

const CADA_MS = 30_000;
const CLAVE_SONIDO = "ev-admin-sonido-pedidos";

/**
 * Cuenta los pedidos nuevos cada 30 s (solo con la pestaña visible), avisa con un sonido corto
 * cuando llega uno y escribe el número en el título de la pestaña. El sonido puede apagarse; los
 * navegadores solo dejan sonar tras un clic de la persona, por eso se «desbloquea» al activarlo.
 */
export function useAvisoPedidosNuevos(activo: boolean) {
  const [nuevos, setNuevos] = useState<number | null>(null);
  const [sonido, setSonido] = useState(false);
  const anterior = useRef<number | null>(null);
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => {
    try {
      // Se lee tras montar (no al renderizar) para que servidor y navegador pinten lo mismo.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSonido(localStorage.getItem(CLAVE_SONIDO) === "1");
    } catch {
      /* sin almacenamiento: queda apagado */
    }
  }, []);

  const pitar = useCallback(() => {
    const ctx = audio.current;
    if (!ctx) return;
    void ctx.resume();
    [880, 1175].forEach((frecuencia, i) => {
      const osc = ctx.createOscillator();
      const ganancia = ctx.createGain();
      const t = ctx.currentTime + i * 0.18;
      osc.frequency.value = frecuencia;
      ganancia.gain.setValueAtTime(0.0001, t);
      ganancia.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      ganancia.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(ganancia).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  }, []);

  const sonidoRef = useRef(sonido);
  useEffect(() => {
    sonidoRef.current = sonido;
  }, [sonido]);

  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    async function leer() {
      if (document.visibilityState === "hidden") return;
      try {
        const n = await contarPedidosNuevos();
        if (!vivo || n === null) return;
        if (debeSonar(anterior.current, n) && sonidoRef.current) pitar();
        anterior.current = n;
        setNuevos(n);
      } catch {
        /* sin conexión: se intenta de nuevo en el próximo ciclo */
      }
    }
    void leer();
    const intervalo = setInterval(() => void leer(), CADA_MS);
    const alVolver = () => void leer();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      vivo = false;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [activo, pitar]);

  // «(2) Pedidos | …» en la pestaña, para verlo aunque esté en segundo plano.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, "");
    document.title = nuevos && nuevos > 0 ? `(${nuevos}) ${base}` : base;
  }, [nuevos]);

  const alternarSonido = useCallback(() => {
    setSonido((s) => {
      const nuevo = !s;
      if (nuevo) {
        // Se crea dentro del clic: así el navegador permite sonar después.
        audio.current ??= new AudioContext();
        pitar();
      }
      try {
        localStorage.setItem(CLAVE_SONIDO, nuevo ? "1" : "0");
      } catch {
        /* sin almacenamiento */
      }
      return nuevo;
    });
  }, [pitar]);

  return { nuevos: nuevos ?? 0, sonido, alternarSonido };
}
