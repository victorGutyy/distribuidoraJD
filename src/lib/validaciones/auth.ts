import { z } from "zod";

/**
 * Esquemas de validación de la autenticación del panel (RF-20).
 * Se usan en las Server Actions. Los mensajes van en español colombiano.
 */

const correo = z
  .string()
  .trim()
  .min(1, "Escribe tu correo")
  .pipe(z.email("Ese correo no parece válido"))
  .transform((valor) => valor.toLowerCase());

// Supabase usa bcrypt, que solo considera los primeros 72 caracteres.
const contrasenaNueva = z
  .string()
  .min(8, "Debe tener al menos 8 caracteres")
  .max(72, "Debe tener máximo 72 caracteres");

export const loginSchema = z.object({
  correo,
  contrasena: z.string().min(1, "Escribe tu contraseña"),
  // Ruta a la que volver tras entrar; se valida aparte con rutaAdminSegura().
  next: z.string().optional(),
});

export const recuperarSchema = z.object({ correo });

export const restablecerSchema = z
  .object({
    contrasena: contrasenaNueva,
    confirmar: z.string().min(1, "Repite la contraseña"),
  })
  .refine((datos) => datos.contrasena === datos.confirmar, {
    path: ["confirmar"],
    message: "Las contraseñas no coinciden",
  });
