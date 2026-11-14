import { describe, expect, it } from "vitest";
import { editarUsuarioSchema, idUsuarioSchema, invitarSchema } from "@/lib/validaciones/usuarios";

describe("invitarSchema", () => {
  it("normaliza el correo y convierte los sectores", () => {
    const r = invitarSchema.safeParse({ correo: "  Ana@Correo.COM ", nombre: "Ana Pérez", rol: "vendedor", sectores: ["3", "1", "3", "x", "-2"] });
    expect(r.success && r.data).toEqual({ correo: "ana@correo.com", nombre: "Ana Pérez", rol: "vendedor", sectores: [1, 3] });
  });

  it("rechaza correos, nombres y roles inválidos", () => {
    const base = { correo: "ana@correo.com", nombre: "Ana", rol: "editor", sectores: [] };
    expect(invitarSchema.safeParse({ ...base, correo: "ana" }).success).toBe(false);
    expect(invitarSchema.safeParse({ ...base, nombre: "A" }).success).toBe(false);
    expect(invitarSchema.safeParse({ ...base, rol: "superadmin" }).success).toBe(false);
    expect(invitarSchema.safeParse(base).success).toBe(true);
  });
});

describe("editarUsuarioSchema", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  it("acepta un usuario válido y rechaza un id que no es uuid", () => {
    expect(editarUsuarioSchema.safeParse({ id, nombre: "Ana", rol: "admin", activo: true, sectores: [] }).success).toBe(true);
    expect(editarUsuarioSchema.safeParse({ id: "1; drop", nombre: "Ana", rol: "admin", activo: true, sectores: [] }).success).toBe(false);
    expect(idUsuarioSchema.safeParse(id).success).toBe(true);
  });
});
