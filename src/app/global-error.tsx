"use client";

/** Último recurso: falla el marco raíz (no hay CSS de la app garantizado, por eso estilos en línea). */
export default function ErrorGlobal({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="es-CO">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", minHeight: "100vh", placeItems: "center", margin: 0, padding: 16, textAlign: "center" }}>
        <div>
          <h1 style={{ fontSize: 24 }}>EV Distribuidora</h1>
          <p style={{ color: "#555" }}>Tuvimos un problema al cargar el sitio. Intenta de nuevo en unos segundos.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ background: "#015bc1", color: "#fff", border: 0, borderRadius: 8, height: 44, padding: "0 24px", fontWeight: 600, cursor: "pointer" }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
