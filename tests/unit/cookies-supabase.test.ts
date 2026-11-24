import { describe, expect, it } from "vitest";
import { endurecerCookie } from "@/lib/supabase/cookies";

describe("endurecerCookie", () => {
  it("en producción marca Secure y SameSite=Lax y conserva lo demás", () => {
    expect(endurecerCookie({ maxAge: 100, httpOnly: true }, true)).toEqual({
      maxAge: 100,
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  });

  it("en desarrollo (http://localhost) NO marca Secure, o el navegador la descartaría", () => {
    const c = endurecerCookie(undefined, false);
    expect(c.secure).toBeUndefined();
    expect(c.sameSite).toBe("lax");
  });

  it("respeta la ruta que traiga la cookie", () => {
    expect(endurecerCookie({ path: "/admin" }, true).path).toBe("/admin");
  });
});
