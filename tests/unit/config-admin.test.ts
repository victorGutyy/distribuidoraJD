import { describe, expect, it } from "vitest";
import { paraGuardar, valoresConfigFormulario } from "@/lib/config-admin";
import { leerConfigTienda } from "@/lib/tienda/config";
import {
  comprasSchema,
  contactoSchema,
  empresaParaGuardar,
  empresaSchema,
  entregaSchema,
  parsearDiasNoHabiles,
} from "@/lib/validaciones/config";

describe("valoresConfigFormulario", () => {
  it("con la configuración inicial de la base rellena valores seguros", () => {
    const v = valoresConfigFormulario([
      { clave: "whatsapp_pedidos", valor: null },
      { clave: "pedido_minimo", valor: 0 },
      { clave: "regla_mayoreo", valor: "por_cantidad" },
      { clave: "hora_corte", valor: null },
      { clave: "dias_no_habiles", valor: [] },
      { clave: "empresa", valor: { nit: null, redes: {}, nombre: "EV Distribuidora", horarios: null, direccion: null } },
    ]);
    expect(v).toMatchObject({ whatsapp: "", pedido_minimo: "0", regla_mayoreo: "por_cantidad", hora_corte: "17:00", dias_no_habiles: "" });
    expect(v.empresa.nombre).toBe("EV Distribuidora");
  });

  it("quita el 57 del celular y lista las fechas una por línea", () => {
    const v = valoresConfigFormulario([
      { clave: "whatsapp_pedidos", valor: "573101234567" },
      { clave: "dias_no_habiles", valor: ["2026-12-25", "2026-12-08", 5] },
      { clave: "regla_mayoreo", valor: "ambas" },
    ]);
    expect(v.whatsapp).toBe("3101234567");
    expect(v.dias_no_habiles).toBe("2026-12-25\n2026-12-08");
    expect(v.regla_mayoreo).toBe("ambas");
  });

  it("un valor vacío se guarda como texto vacío, no como null", () => {
    expect(paraGuardar(null)).toBe("");
    expect(paraGuardar("hola")).toBe("hola");
  });
});

describe("contactoSchema", () => {
  it("normaliza el WhatsApp y acepta vacío", () => {
    const r = contactoSchema.safeParse({ whatsapp: "310 123 4567", mensaje_whatsapp: "Hola", mensaje_barra: "" });
    expect(r.success && r.data).toEqual({ whatsapp: "573101234567", mensaje_whatsapp: "Hola", mensaje_barra: null });
    expect(contactoSchema.safeParse({ whatsapp: "", mensaje_whatsapp: "Hola", mensaje_barra: "x" }).success).toBe(true);
  });

  it("rechaza un número que no es celular o un mensaje vacío", () => {
    expect(contactoSchema.safeParse({ whatsapp: "123", mensaje_whatsapp: "Hola", mensaje_barra: "" }).success).toBe(false);
    expect(contactoSchema.safeParse({ whatsapp: "", mensaje_whatsapp: " ", mensaje_barra: "" }).success).toBe(false);
  });
});

describe("comprasSchema", () => {
  it("convierte pesos y acepta vacío como 0", () => {
    const r = comprasSchema.safeParse({ pedido_minimo: "50.000", regla_mayoreo: "por_cantidad", umbral_mayor_monto: "" });
    expect(r.success && r.data).toEqual({ pedido_minimo: 50000, regla_mayoreo: "por_cantidad", umbral_mayor_monto: 0 });
  });

  it("por monto o ambas exigen el monto", () => {
    expect(comprasSchema.safeParse({ pedido_minimo: "", regla_mayoreo: "por_monto", umbral_mayor_monto: "" }).success).toBe(false);
    expect(comprasSchema.safeParse({ pedido_minimo: "", regla_mayoreo: "ambas", umbral_mayor_monto: "0" }).success).toBe(false);
    expect(comprasSchema.safeParse({ pedido_minimo: "", regla_mayoreo: "ambas", umbral_mayor_monto: "200000" }).success).toBe(true);
  });

  it("rechaza decimales y reglas desconocidas", () => {
    expect(comprasSchema.safeParse({ pedido_minimo: "12,5", regla_mayoreo: "por_cantidad", umbral_mayor_monto: "" }).success).toBe(false);
    expect(comprasSchema.safeParse({ pedido_minimo: "", regla_mayoreo: "otra", umbral_mayor_monto: "" }).success).toBe(false);
  });
});

describe("entregaSchema y días no hábiles", () => {
  it("parsea fechas por línea, por coma o por espacio, sin repetidas y ordenadas", () => {
    expect(parsearDiasNoHabiles("2026-12-25\n2026-12-08, 2026-12-25  2026-01-01")).toEqual({
      fechas: ["2026-01-01", "2026-12-08", "2026-12-25"],
      invalidas: [],
    });
    expect(parsearDiasNoHabiles("25/12/2026 2026-02-31").invalidas).toEqual(["25/12/2026", "2026-02-31"]);
  });

  it("valida la hora y las fechas", () => {
    expect(entregaSchema.safeParse({ hora_corte: "17:00", dias_no_habiles: "2026-12-25" }).success).toBe(true);
    expect(entregaSchema.safeParse({ hora_corte: "5pm", dias_no_habiles: "" }).success).toBe(false);
    expect(entregaSchema.safeParse({ hora_corte: "17:00", dias_no_habiles: "mañana" }).success).toBe(false);
  });
});

describe("empresaSchema", () => {
  it("guarda solo las redes con https y vacíos como null", () => {
    const r = empresaSchema.safeParse({
      nombre: " EV Distribuidora ", nit: "", direccion: "Cra 1", horarios: "",
      facebook: "https://facebook.com/ev", instagram: "", tiktok: "",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(empresaParaGuardar(r.data)).toEqual({
        nombre: "EV Distribuidora", nit: null, direccion: "Cra 1", horarios: null,
        redes: { facebook: "https://facebook.com/ev" },
      });
    }
  });

  it("rechaza redes sin https y nombre vacío", () => {
    const base = { nombre: "EV", nit: "", direccion: "", horarios: "", facebook: "", instagram: "", tiktok: "" };
    expect(empresaSchema.safeParse({ ...base, instagram: "http://insta.com/ev" }).success).toBe(false);
    expect(empresaSchema.safeParse({ ...base, tiktok: "javascript:alert(1)" }).success).toBe(false);
    expect(empresaSchema.safeParse({ ...base, nombre: " " }).success).toBe(false);
  });

  it("lo guardado lo lee bien la tienda (ida y vuelta)", () => {
    const r = empresaSchema.parse({ nombre: "EV", nit: "900", direccion: "Calle 1", horarios: "L-S", facebook: "https://f.com/ev", instagram: "", tiktok: "" });
    const c = leerConfigTienda([{ clave: "empresa", valor: empresaParaGuardar(r) }]);
    expect(c.empresa).toEqual({ nombre: "EV", direccion: "Calle 1", horarios: "L-S", redes: [{ nombre: "facebook", url: "https://f.com/ev" }] });
  });
});
