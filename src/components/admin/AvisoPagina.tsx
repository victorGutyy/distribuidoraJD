import { AvisoError, AvisoInfo } from "@/components/admin/Campo";
import { textoAvisoError, textoAvisoOk } from "@/lib/avisos";

/**
 * Muestra el resultado de la última acción (?ok=… o ?error=…, ver lib/avisos.ts).
 * Si no hay ninguno, no dibuja nada.
 */
export function AvisoPagina({ ok, error }: { ok?: string; error?: string }) {
  const textoError = textoAvisoError(error);
  if (textoError) return <AvisoError>{textoError}</AvisoError>;
  const textoOk = textoAvisoOk(ok);
  if (textoOk) return <AvisoInfo>{textoOk}</AvisoInfo>;
  return null;
}
