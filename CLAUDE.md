# CLAUDE.md — Plataforma Catálogo EV Distribuidora

Este archivo le da a Claude Code el contexto y las reglas del proyecto. Léelo completo al iniciar cada sesión.

## 1. Proyecto en una línea
Catálogo web con panel administrativo para **EV Distribuidora** (Quindío, Colombia): unas 1.700 referencias de víveres, útiles escolares, aseo, cuidado personal, farmacia básica y más. Los pedidos se envían por **WhatsApp** y se pagan **contraentrega**. El referente es la tienda de cempac.co/store.

**Lee siempre antes de cambiar algo importante:**
- `docs/00_DOCUMENTO_MADRE.md`: visión, alcance y decisiones
- `docs/01_REQUERIMIENTOS.md`: RF, RN, RNF, modelo de datos y fases (cítalos por ID: RF-24, RN-02…)

## 2. Con quién trabajas
- **Víctor**, desarrollador (tecnólogo SENA, nivel junior-intermedio), dirige la arquitectura y las decisiones.
- **Explica como profesor:** antes de cada bloque de código, di *qué* vas a hacer y *por qué*; después, resume lo que cambió y cómo probarlo. Explica los conceptos nuevos (RLS, Server Actions, tsvector, etc.) la primera vez que aparezcan.
- Idioma: **español** en conversación, comentarios, mensajes de commit y textos de la interfaz. Código (variables, funciones) en español o inglés de forma **consistente**: tablas y columnas en español (como en el modelo de datos); componentes y utilidades en inglés está bien.
- Entorno: **Windows + Git Bash**. Da los comandos compatibles con Git Bash (rutas con `/`, sin comandos exclusivos de PowerShell).

## 3. Reglas obligatorias (no negociables)
1. **No elimines ni muevas archivos** sin pedir confirmación explícita.
2. **No instales paquetes, dependencias ni herramientas** sin pedir permiso. Explica para qué sirve cada uno y si hay alternativa sin instalar nada.
3. **No hagas `git commit` ni `git push`** sin que Víctor lo confirme. Propón el mensaje de commit y espera.
4. Trabaja **solo dentro de la carpeta del proyecto**.
5. **Nunca** expongas secretos: la `SUPABASE_SERVICE_ROLE_KEY` solo se usa en código de servidor. No la imprimas ni la subas a git. `.env.local` está en `.gitignore`.
6. No cambies el modelo de datos, el stack ni el alcance sin proponerlo primero y actualizar `docs/`.
7. Antes de ejecutar migraciones en la base de datos **remota**, muestra el SQL y pide confirmación.
8. Si un requerimiento es ambiguo, **pregunta** en lugar de inventar. Las preguntas abiertas están en la sección 9 del documento madre.

## 4. Stack
| Capa | Tecnología |
|---|---|
| Framework | Next.js (App Router) + TypeScript estricto |
| UI | Tailwind CSS + shadcn/ui + lucide-react |
| Formularios / validación | react-hook-form + Zod (los esquemas se comparten entre cliente y servidor) |
| Tablas del admin | TanStack Table |
| Estado del carrito | Zustand con persistencia en localStorage |
| Base de datos / Auth / Storage | Supabase (PostgreSQL) con `@supabase/ssr` |
| Excel | SheetJS (`xlsx`) para importar y exportar |
| Pruebas | Vitest (unitarias) + Playwright (E2E) |
| Hosting | Vercel |

*(Las versiones exactas se fijan en `package.json` en la fase F0, usando las estables vigentes.)*

## 5. Estructura de carpetas
```
/
├─ CLAUDE.md
├─ docs/                      # documento madre, requerimientos, prompt inicial
├─ data/                      # catalogo_jd_borrador.csv y plantillas de importación
├─ scripts/                   # utilidades (extraer.py, seed, etc.)
├─ supabase/
│  ├─ migrations/             # SQL versionado: 0001_init.sql, 0002_rls.sql…
│  └─ seed.sql
├─ src/
│  ├─ app/
│  │  ├─ (tienda)/            # inicio, catalogo, producto/[slug], carrito, checkout, pedido/[numero]
│  │  ├─ admin/               # dashboard, productos, precios, importar, pedidos, zonas, config, usuarios
│  │  └─ api/                 # solo si hace falta (preferir Server Actions)
│  ├─ components/
│  │  ├─ ui/                  # shadcn
│  │  ├─ tienda/
│  │  └─ admin/
│  ├─ lib/
│  │  ├─ supabase/            # client.ts, server.ts, admin.ts (service role, solo servidor)
│  │  ├─ precios.ts           # cálculo de precios (RN-02 a RN-06): lógica PURA y probada
│  │  ├─ entregas.ts          # cálculo de la fecha de entrega (RF-07): lógica PURA y probada
│  │  ├─ whatsapp.ts          # armado del mensaje y del enlace wa.me
│  │  ├─ formato.ts           # formatCOP(), fechas en es-CO
│  │  └─ validaciones/        # esquemas Zod
│  ├─ stores/                 # carrito (Zustand)
│  └─ types/                  # database.types.ts (generado por Supabase)
└─ tests/                     # unit/ y e2e/
```

## 6. Convenciones de código
- **Server Components por defecto**; `"use client"` solo cuando haya interactividad.
- Mutaciones con **Server Actions**, validando con Zod y comprobando el rol en el servidor.
- **Precios en enteros COP** (`int`), nunca `float`. Muéstralos con `formatCOP()` → `$ 12.500`.
- Fechas de reparto siempre en la zona horaria `America/Bogota`.
- **Los pedidos se crean solo en el servidor:** se recibe `{variante_id, cantidad}[]`, se leen los precios de la base de datos y se aplica `lib/precios.ts`. Nunca se confía en los precios del cliente (RN-06).
- `pedido_items` guarda un snapshot (RN-08). Nunca se usa `DELETE` en pedidos, clientes ni productos con pedidos (RN-10).
- Nombres: componentes en `PascalCase`, archivos de componentes en `PascalCase.tsx`, utilidades en `camelCase.ts`, tablas y columnas SQL en `snake_case` en español.
- Componentes de máximo ~200 líneas. Si crece, se divide.
- Textos de interfaz en español colombiano, con tono cercano y claro.
- Accesibilidad: `label` en todos los inputs, `alt` en las imágenes y contraste AA.

## 7. Base de datos
- Toda modificación del esquema va en una **migración nueva** en `supabase/migrations/`. No se editan migraciones ya aplicadas.
- **RLS activado en todas las tablas.** Lectura pública solo de lo que permite RN-01. Escritura según la matriz de la sección 6 de los requerimientos.
- Después de cada migración, regenera los tipos: `npx supabase gen types typescript --project-id <id> > src/types/database.types.ts`
- Extensiones: `unaccent` y `pg_trgm` para la búsqueda (RF-04).

## 8. Identidad visual
- Marca: **EV Distribuidora**. Colores medidos del logo real (confirmar con el vectorial): **negro** `#06080C`, **azul** `#015BC1`, **dorado/champagne** `#CEB394` y **plata** `#C0BBB4`. Tokens en `globals.css`: `ev-negro`, `ev-azul`, `ev-dorado`, `ev-dorado-oscuro` (`#8A6D3B`, para dorado como *texto*), `ev-plata`, `ev-oferta`. Logo circular en `public/logo-ev.webp`; original en `docs/marca/logo-ev-original.webp`.
- **Azul** para las acciones principales (texto blanco encima, 6,4:1); **dorado** para el precio por mayor y acentos (texto negro encima, 10:1; como texto sobre blanco usar `ev-dorado-oscuro`); negro y plata para la estructura; rojo `#E53935` solo para la etiqueta "Oferta"; fondo claro. El gris de la interfaz es más oscuro que la plata para cumplir contraste AA.
- Tipografía sans legible (Inter o similar). Diseño **mobile-first**.

## 9. Comandos
```bash
npm run dev          # desarrollo en http://localhost:3000
npm run build        # compilación de producción
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test         # Vitest
npm run test:e2e     # Playwright
```

## 10. Definición de "terminado" para cada tarea
- [ ] Cumple los criterios del RF o la HU correspondiente
- [ ] `lint`, `typecheck` y `test` pasan
- [ ] Funciona en móvil (375 px) y escritorio
- [ ] Sin secretos en el código y con RLS verificado si toca la base de datos
- [ ] Explicaste a Víctor qué cambió y cómo probarlo
- [ ] Propusiste el mensaje de commit (**sin ejecutarlo**)

## 11. Flujo de trabajo por fase
1. Lee la fase en `docs/01_REQUERIMIENTOS.md` (sección 9).
2. Propón un **plan corto** (archivos a crear o modificar, y paquetes si se necesitan) y espera el visto bueno.
3. Implementa en pasos pequeños, explicando cada uno.
4. Verifica (lint, tipos, pruebas y revisión manual).
5. Resume, propón el commit y espera confirmación.

## 12. Estado actual
- [x] F0 Setup · [ ] F1 BD + Auth · [ ] F2 CRUD · [ ] F3 Importación + precios · [ ] F4 Tienda · [ ] F5 Carrito + pedido · [ ] F6 Admin pedidos · [ ] F7 QA + deploy

*(Actualiza esta lista al terminar cada fase.)*
