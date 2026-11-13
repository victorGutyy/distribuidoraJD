import { describe, expect, it } from "vitest";
import {
  loginSchema,
  recuperarSchema,
  restablecerSchema,
} from "@/lib/validaciones/auth";
import { erroresPorCampo } from "@/lib/validaciones/comun";

describe("loginSchema", () => {
  it("acepta datos válidos y normaliza el correo (recorta y pasa a minúsculas)", () => {
    const r = loginSchema.safeParse({
      correo: "  Victor@Ejemplo.COM ",
      contrasena: "cualquiera",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.correo).toBe("victor@ejemplo.com");
  });

  it("rechaza campos vacíos con mensajes en español", () => {
    const r = loginSchema.safeParse({ correo: "", contrasena: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const errores = erroresPorCampo(r.error);
      expect(errores.correo?.[0]).toBe("Escribe tu correo");
      expect(errores.contrasena?.[0]).toBe("Escribe tu contraseña");
    }
  });

  it("rechaza un correo sin formato", () => {
    const r = loginSchema.safeParse({
      correo: "no-es-correo",
      contrasena: "x",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(erroresPorCampo(r.error).correo?.[0]).toBe(
        "Ese correo no parece válido",
      );
    }
  });
});

describe("recuperarSchema", () => {
  it("solo pide un correo válido", () => {
    expect(recuperarSchema.safeParse({ correo: "a@b.co" }).success).toBe(true);
    expect(recuperarSchema.safeParse({ correo: "a@" }).success).toBe(false);
  });
});

describe("restablecerSchema", () => {
  it("acepta contraseñas iguales de 8 a 72 caracteres", () => {
    const r = restablecerSchema.safeParse({
      contrasena: "unaClaveLarga1",
      confirmar: "unaClaveLarga1",
    });
    expect(r.success).toBe(true);
  });

  it("rechaza contraseñas cortas", () => {
    const r = restablecerSchema.safeParse({
      contrasena: "corta",
      confirmar: "corta",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(erroresPorCampo(r.error).contrasena?.[0]).toBe(
        "Debe tener al menos 8 caracteres",
      );
    }
  });

  it("rechaza contraseñas de más de 72 caracteres (límite de bcrypt)", () => {
    const larga = "a".repeat(73);
    expect(
      restablecerSchema.safeParse({ contrasena: larga, confirmar: larga })
        .success,
    ).toBe(false);
  });

  it("rechaza cuando no coinciden y marca el campo de confirmación", () => {
    const r = restablecerSchema.safeParse({
      contrasena: "unaClaveLarga1",
      confirmar: "otraClaveLarga2",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(erroresPorCampo(r.error).confirmar?.[0]).toBe(
        "Las contraseñas no coinciden",
      );
    }
  });
});
