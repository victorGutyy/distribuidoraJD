import { describe, expect, it } from "vitest";
import {
  ahoraEnBogota,
  CONFIG_ENTREGA_POR_DEFECTO,
  diaDeSemana,
  fechaEntregaBodega,
  fechaEntregaSector,
  minutosDeHora,
  sumarDias,
  textoDiasReparto,
  textoFechaCorta,
  textoFechaEntrega,
} from "@/lib/entregas";

/** Una hora de pared de Bogotá (UTC-5) como instante. */
const bogota = (iso: string) => new Date(`${iso}-05:00`);
const JUEVES = [4];

describe("fechas y horas de Bogotá", () => {
  it("convierte el instante a la hora local (UTC-5)", () => {
    expect(ahoraEnBogota(new Date("2026-11-11T22:30:00Z"))).toEqual({ fecha: "2026-11-11", minutos: 17 * 60 + 30 });
    // Pasada la medianoche UTC todavía es el día anterior en Bogotá.
    expect(ahoraEnBogota(new Date("2026-11-12T04:59:00Z"))).toEqual({ fecha: "2026-11-11", minutos: 23 * 60 + 59 });
    expect(ahoraEnBogota(new Date("2026-11-12T05:00:00Z"))).toEqual({ fecha: "2026-11-12", minutos: 0 });
  });

  it("suma días y calcula el día de la semana (1 = lunes … 7 = domingo)", () => {
    expect(sumarDias("2026-11-30", 1)).toBe("2026-12-01");
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
    expect(diaDeSemana("2026-11-12")).toBe(4); // jueves
    expect(diaDeSemana("2026-11-15")).toBe(7); // domingo
  });

  it("minutosDeHora acepta horas válidas y cae a 17:00 si el texto es inválido", () => {
    expect(minutosDeHora("17:30")).toBe(1050);
    expect(minutosDeHora("9:05")).toBe(545);
    expect(minutosDeHora("tarde")).toBe(1020);
    expect(minutosDeHora("25:00")).toBe(1020);
  });

  it("escribe las fechas en español", () => {
    expect(textoFechaEntrega("2026-11-12")).toBe("jueves 12 de noviembre");
    expect(textoFechaCorta("2026-11-12")).toBe("jueves 12/11");
    expect(textoFechaCorta("2026-12-01")).toBe("martes 01/12");
  });
});

describe("fechaEntregaSector (RF-07)", () => {
  it("un lunes, un sector de jueves recibe el jueves de esa semana", () => {
    expect(fechaEntregaSector(bogota("2026-11-09T10:00:00"), JUEVES)).toBe("2026-11-12");
  });

  it("el miércoles antes de la hora de corte entra en el jueves; después, en el siguiente", () => {
    expect(fechaEntregaSector(bogota("2026-11-11T16:59:00"), JUEVES)).toBe("2026-11-12");
    expect(fechaEntregaSector(bogota("2026-11-11T17:00:00"), JUEVES)).toBe("2026-11-12"); // justo a la hora
    expect(fechaEntregaSector(bogota("2026-11-11T17:01:00"), JUEVES)).toBe("2026-11-19");
  });

  it("el mismo día de reparto ya no entra: va a la semana siguiente", () => {
    expect(fechaEntregaSector(bogota("2026-11-12T08:00:00"), JUEVES)).toBe("2026-11-19");
  });

  it("con varios días elige el más cercano", () => {
    // martes y viernes; el lunes 9 a las 10:00 → martes 10
    expect(fechaEntregaSector(bogota("2026-11-09T10:00:00"), [2, 5])).toBe("2026-11-10");
    // el martes 10 a las 18:00 (ya pasó el corte de la ruta del miércoles, no aplica) → viernes 13
    expect(fechaEntregaSector(bogota("2026-11-10T18:00:00"), [2, 5])).toBe("2026-11-13");
  });

  it("salta los días no hábiles", () => {
    const config = { ...CONFIG_ENTREGA_POR_DEFECTO, diasNoHabiles: ["2026-11-12"] };
    expect(fechaEntregaSector(bogota("2026-11-09T10:00:00"), JUEVES, config)).toBe("2026-11-19");
  });

  it("respeta una hora de corte configurada", () => {
    const config = { ...CONFIG_ENTREGA_POR_DEFECTO, horaCorte: "12:00" };
    expect(fechaEntregaSector(bogota("2026-11-11T12:01:00"), JUEVES, config)).toBe("2026-11-19");
    expect(fechaEntregaSector(bogota("2026-11-11T11:59:00"), JUEVES, config)).toBe("2026-11-12");
  });

  it("usa la hora de Bogotá aunque el servidor esté en UTC", () => {
    // 2026-11-12T03:00Z = miércoles 22:00 en Bogotá → ya pasó el corte del jueves
    expect(fechaEntregaSector(new Date("2026-11-12T03:00:00Z"), JUEVES)).toBe("2026-11-19");
  });

  it("devuelve null sin días de reparto válidos", () => {
    expect(fechaEntregaSector(new Date(), [])).toBeNull();
    expect(fechaEntregaSector(new Date(), [0, 8, 2.5])).toBeNull();
  });
});

describe("fechaEntregaBodega (RF-07)", () => {
  it("es el siguiente día hábil", () => {
    expect(fechaEntregaBodega(bogota("2026-11-10T10:00:00"))).toBe("2026-11-11"); // martes → miércoles
    expect(fechaEntregaBodega(bogota("2026-11-13T10:00:00"))).toBe("2026-11-14"); // viernes → sábado (se atiende)
  });

  it("el sábado pasa al lunes (el domingo no se atiende)", () => {
    expect(fechaEntregaBodega(bogota("2026-11-14T10:00:00"))).toBe("2026-11-16");
  });

  it("salta los días no hábiles", () => {
    const config = { ...CONFIG_ENTREGA_POR_DEFECTO, diasNoHabiles: ["2026-11-16"] };
    expect(fechaEntregaBodega(bogota("2026-11-14T10:00:00"), config)).toBe("2026-11-17");
  });
});

describe("textoDiasReparto", () => {
  it("escribe los días en español", () => {
    expect(textoDiasReparto([4])).toBe("jueves");
    expect(textoDiasReparto([4, 2])).toBe("martes y jueves");
    expect(textoDiasReparto([5, 1, 3])).toBe("lunes, miércoles y viernes");
    expect(textoDiasReparto([])).toBe("sin días");
    expect(textoDiasReparto([2, 2, 9])).toBe("martes");
  });
});
