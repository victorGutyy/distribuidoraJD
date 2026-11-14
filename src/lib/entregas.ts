/**
 * Fecha de entrega del pedido (RF-07, RNF-14). Lógica PURA, con pruebas.
 *
 * Todo se calcula en la hora de Colombia (America/Bogota, UTC-5 todo el año, sin
 * horario de verano). Las fechas viajan como texto "AAAA-MM-DD".
 */

export type ConfigEntrega = {
  /** "HH:MM" del día ANTERIOR al reparto, hasta la que entra el pedido en esa ruta. */
  horaCorte: string;
  /** Fechas "AAAA-MM-DD" en las que no se reparte ni se atiende la bodega. */
  diasNoHabiles: readonly string[];
  /** Días en que se puede recoger en bodega (1 = lunes … 7 = domingo). */
  diasBodega: readonly number[];
};

export const CONFIG_ENTREGA_POR_DEFECTO: ConfigEntrega = {
  horaCorte: "17:00",
  diasNoHabiles: [],
  diasBodega: [1, 2, 3, 4, 5, 6],
};

/** Máximo de días hacia adelante que se buscan antes de rendirse. */
const LIMITE_DIAS = 28;

const MS_DIA = 24 * 60 * 60 * 1000;
const OFFSET_BOGOTA_MS = -5 * 60 * 60 * 1000;

export type FechaHoraBogota = {
  /** "AAAA-MM-DD" */
  fecha: string;
  /** Minutos desde la medianoche (0–1439). */
  minutos: number;
};

/** La fecha y la hora que son AHORA en Bogotá. */
export function ahoraEnBogota(ahora: Date): FechaHoraBogota {
  const d = new Date(ahora.getTime() + OFFSET_BOGOTA_MS);
  return {
    fecha: d.toISOString().slice(0, 10),
    minutos: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

const aMs = (fecha: string) => Date.parse(`${fecha}T00:00:00Z`);

/** Suma días a una fecha "AAAA-MM-DD". */
export function sumarDias(fecha: string, dias: number): string {
  return new Date(aMs(fecha) + dias * MS_DIA).toISOString().slice(0, 10);
}

/** 1 = lunes … 7 = domingo. */
export function diaDeSemana(fecha: string): number {
  const d = new Date(aMs(fecha)).getUTCDay(); // 0 = domingo
  return d === 0 ? 7 : d;
}

/** "17:00" → 1020. Un texto inválido usa el valor por defecto (17:00). */
export function minutosDeHora(hora: string): number {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hora.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : 17 * 60;
}

/**
 * Próxima fecha de reparto para un sector (RF-07): el primer día de la semana en
 * que el sector tiene reparto, que no sea día no hábil, y cuya hora de corte (la
 * del día ANTERIOR) todavía no haya pasado. Null si el sector no tiene días de
 * reparto válidos.
 */
export function fechaEntregaSector(
  ahora: Date,
  diasReparto: readonly number[],
  config: ConfigEntrega = CONFIG_ENTREGA_POR_DEFECTO,
): string | null {
  const validos = diasReparto.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  if (validos.length === 0) return null;

  const hoy = ahoraEnBogota(ahora);
  const corte = minutosDeHora(config.horaCorte);

  for (let i = 1; i <= LIMITE_DIAS; i++) {
    const candidata = sumarDias(hoy.fecha, i);
    if (!validos.includes(diaDeSemana(candidata))) continue;
    if (config.diasNoHabiles.includes(candidata)) continue;
    // El corte es el día anterior a la entrega. Si ese día es hoy, ya no debe haber pasado.
    const diaDelCorte = sumarDias(candidata, -1);
    if (diaDelCorte === hoy.fecha && hoy.minutos > corte) continue;
    return candidata;
  }
  return null;
}

/** Recoger en bodega: el siguiente día hábil (desde mañana). */
export function fechaEntregaBodega(
  ahora: Date,
  config: ConfigEntrega = CONFIG_ENTREGA_POR_DEFECTO,
): string | null {
  const hoy = ahoraEnBogota(ahora);
  const dias = config.diasBodega.length > 0 ? config.diasBodega : CONFIG_ENTREGA_POR_DEFECTO.diasBodega;
  for (let i = 1; i <= LIMITE_DIAS; i++) {
    const candidata = sumarDias(hoy.fecha, i);
    if (dias.includes(diaDeSemana(candidata)) && !config.diasNoHabiles.includes(candidata)) {
      return candidata;
    }
  }
  return null;
}

const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-11-12" → "jueves 12 de noviembre". */
export function textoFechaEntrega(fecha: string): string {
  const [, mes, dia] = fecha.split("-").map(Number);
  return `${DIAS[diaDeSemana(fecha) - 1]} ${dia} de ${MESES[mes - 1]}`;
}

/** "2026-11-12" → "jueves 12/11" (para el mensaje de WhatsApp). */
export function textoFechaCorta(fecha: string): string {
  const [, mes, dia] = fecha.split("-").map(Number);
  return `${DIAS[diaDeSemana(fecha) - 1]} ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

/** [4] → "jueves"; [2, 4] → "martes y jueves"; [1, 3, 5] → "lunes, miércoles y viernes". */
export function textoDiasReparto(dias: readonly number[]): string {
  const nombres = [...new Set(dias)]
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)
    .sort((a, b) => a - b)
    .map((d) => DIAS[d - 1]);
  if (nombres.length === 0) return "sin días";
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}
