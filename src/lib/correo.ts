import "server-only";

/**
 * Envío de correos con Resend (API REST, sin instalar paquetes). SOLO servidor.
 * Variables de entorno (ver .env.example):
 *   RESEND_API_KEY        clave de Resend (secreta). Sin ella no se envía nada.
 *   CORREO_REMITENTE      «EV Distribuidora <pedidos@tu-dominio.co>» (dominio verificado en Resend).
 *   CORREO_AVISO_PEDIDOS  quién recibe el aviso de pedido nuevo (uno o varios, separados por coma).
 *
 * Un correo que falla NUNCA debe tumbar un pedido: aquí se atrapa todo y solo se deja registro.
 */

export type CorreoSaliente = { para: string[]; asunto: string; texto: string; html: string };

export async function enviarCorreo(c: CorreoSaliente): Promise<boolean> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave || c.para.length === 0) return false;
  try {
    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.CORREO_REMITENTE || "EV Distribuidora <onboarding@resend.dev>",
        to: c.para,
        subject: c.asunto,
        text: c.texto,
        html: c.html,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!respuesta.ok) {
      console.error("[correo] Resend respondió", respuesta.status);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[correo] no se pudo enviar:", e instanceof Error ? e.message : e);
    return false;
  }
}
