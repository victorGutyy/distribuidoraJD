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
      { clave: "descuento_monto_minimo", valor: 0 },
      { clave: "hora_corte", valor: null },
      { clave: "dias_no_habiles", valor: [] },
      { clave: "empresa", valor: { nit: null, redes: {}, nombre: "EV Distribuidora", horarios: null, direccion: null } },
    ]);
    expect(v).toMatchObject({ whatsapp: "", pedido_minimo: "0", descuento_monto_minimo: "0", descuento_porcentaje: "0", hora_corte: "17:00", dias_no_habiles: "" });
    expect(v.empresa.nombre).toBe("EV Distribuidora");
  });

  it("quita el 57 del celular y lista las fechas una por línea", () => {
    const v = valoresConfigFormulario([
      { clave: "whatsapp_pedidos", valor: "573101234567" },
      { clave: "dias_no_habiles", valor: ["2026-12-25", "2026-12-08", 5] },
      { clave: "descuento_monto_minimo", valor: 500000 },
      { clave: "descuento_porcentaje", valor: 5 },
    ]);
    expect(v.whatsapp).toBe("3101234567");
    expect(v.dias_no_habiles).toBe("2026-12-25\n2026-12-08");
    expect(v).toMatchObject({ descuento_monto_minimo: "500000", descuento_porcentaje: "5" });
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
  const base = { pedido_minimo: "", descuento_monto_minimo: "", descuento_porcentaje: "" };

  it("convierte pesos y acepta vacío como 0 (sin descuento)", () => {
    const r = comprasSchema.safeParse({ ...base, pedido_minimo: "50.000" });
    expect(r.success && r.data).toEqual({ pedido_minimo: 50000, descuento_monto_minimo: 0, descuento_porcentaje: 0 });
  });

  it("acepta el descuento completo: 5 % desde 500.000", () => {
    const r = comprasSchema.safeParse({ ...base, descuento_monto_minimo: "500.000", descuento_porcentaje: "5" });
    expect(r.success && r.data).toEqual({ pedido_minimo: 0, descuento_monto_minimo: 500000, descuento_porcentaje: 5 });
  });

  it("el monto y el porcentaje van juntos: uno solo no sirve", () => {
    expect(comprasSchema.safeParse({ ...base, descuento_monto_minimo: "500000" }).success).toBe(false);
    expect(comprasSchema.safeParse({ ...base, descuento_porcentaje: "5" }).success).toBe(false);
    expect(comprasSchema.safeParse({ ...base, descuento_monto_minimo: "0", descuento_porcentaje: "0" }).success).toBe(true);
  });

  it("rechaza decimales, porcentajes de 100 o más y textos", () => {
    expect(comprasSchema.safeParse({ ...base, pedido_minimo: "12,5" }).success).toBe(false);
    expect(comprasSchema.safeParse({ ...base, descuento_monto_minimo: "1000", descuento_porcentaje: "100" }).success).toBe(false);
    expect(comprasSchema.safeParse({ ...base, descuento_monto_minimo: "1000", descuento_porcentaje: "5,5" }).success).toBe(false);
    expect(comprasSchema.safeParse({ ...base, descuento_monto_minimo: "1000", descuento_porcentaje: "cinco" }).success).toBe(false);
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
