# Prompt inicial para Claude Code — Distribuidora JD

## Antes de pegar el prompt (lo haces tú, Víctor)
1. Crea la carpeta del proyecto, por ejemplo `C:\Users\Victor\Proyectos\distribuidora-jd`.
2. Copia dentro: `CLAUDE.md` (en la raíz), la carpeta `docs/`, la carpeta `data/` (con `catalogo_jd_borrador.csv`) y `scripts/`.
3. Abre Git Bash en esa carpeta y ejecuta `git init`.
4. Crea el proyecto en Supabase (región más cercana: `sa-east-1` São Paulo o `us-east-1`) y ten a mano: URL del proyecto, `anon key` y `service_role key`.
5. Abre Claude Code en esa carpeta (`claude`) y pega el prompt de abajo.

---

## Prompt (copiar desde aquí)

```
Hola Claude. Vamos a construir la Plataforma Catálogo de Distribuidora JD.

1) Lee completos, en este orden:
   - CLAUDE.md
   - docs/00_DOCUMENTO_MADRE.md
   - docs/01_REQUERIMIENTOS.md
   Revisa también las primeras 30 filas de data/catalogo_jd_borrador.csv para entender cómo vienen los datos del catálogo.

2) Hazme un resumen corto (máx. 10 líneas) de lo que entendiste: qué construimos, para quién, el alcance del MVP y las reglas de trabajo que debes respetar conmigo. Si ves contradicciones o vacíos en los documentos, dímelos.

3) Vamos a arrancar la FASE F0 (setup). Antes de tocar nada, preséntame un plan con:
   - Los comandos exactos (compatibles con Git Bash en Windows) para crear el proyecto Next.js con TypeScript, Tailwind, ESLint, App Router y carpeta src/, DENTRO de esta carpeta sin borrar lo que ya existe (CLAUDE.md, docs/, data/, scripts/).
   - La lista de paquetes que vas a instalar en F0, para qué sirve cada uno y si es imprescindible ahora o puede esperar a otra fase.
   - Los archivos que vas a crear: estructura de carpetas de CLAUDE.md §5, lib/supabase (client, server, admin), .env.example, .gitignore, scripts de package.json (dev, build, lint, typecheck, test), configuración de shadcn/ui y los colores de la marca JD en Tailwind.
   - Cómo vamos a verificar que F0 quedó bien (página de prueba que lea la conexión a Supabase, lint y typecheck).

4) Espera mi aprobación del plan. No instales nada, no muevas ni borres archivos y no hagas commit sin que te lo confirme.

5) Cuando lo apruebe, ejecútalo paso a paso explicándome como profesor qué hace cada comando y cada archivo (mi nivel es junior-intermedio). Al final dame:
   - Qué quedó hecho y cómo lo pruebo
   - Las variables que debo poner en .env.local (sin pedirme que te pegue las keys en el chat)
   - El mensaje de commit propuesto
   - Qué sigue en la fase F1
```

---

## Prompts para las siguientes fases (plantilla)

```
Seguimos con la FASE F[N] según docs/01_REQUERIMIENTOS.md §9.
Requerimientos que cubre: [RF-xx, RF-yy, RN-zz].
1) Propón el plan (archivos, migraciones, paquetes) y espera mi OK.
2) Implementa paso a paso explicándome.
3) Verifica con lint, typecheck y tests. Muéstrame cómo probarlo a mano.
4) Actualiza el "Estado actual" en CLAUDE.md y propón el commit (sin ejecutarlo).
```

### Notas por fase
- **F1:** pide que muestre el SQL completo de `0001_init.sql` y `0002_rls.sql` antes de aplicarlos. Revisa que las columnas de precio sean `int` y que RLS quede activado en todas las tablas.
- **F2:** prueba crear un producto con 2 variantes **sin precio** y verifica que no aparezca en la tienda (RN-01).
- **F3:** primero limpia `data/catalogo_jd_borrador.csv` (nombres cortados, marca y presentación mezcladas, categoría según la tabla del documento madre §7). Pide un script que lo convierta a la plantilla de importación y revisa la vista previa antes de confirmar. Después carga los precios desde la vista rápida o desde Excel.
- **F3 (opcional):** script para extraer las ~1.777 imágenes del PDF por página (`pdfimages`) y asociarlas a los productos por `fuente_pagina_pdf`. Toca revisarlas a mano.
- **F5:** pide pruebas unitarias de `lib/precios.ts` y `lib/entregas.ts` **antes** de construir el checkout.
