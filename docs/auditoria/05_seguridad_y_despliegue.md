# Auditoría 05 — Seguridad, borde del sistema y preparación para producción

> Proyecto: EV Distribuidora (Next.js 16.4.6 + Supabase `koabdnqniwqygmsydwad` + Vercel) · Fecha: 24 de noviembre de 2026
> Alcance: migraciones y RLS, Storage, Auth, proxy, cabeceras, secretos, dependencias, variables de entorno, backups, observabilidad, cumplimiento (Ley 1581) y pruebas.
> Método: lectura del código, consultas SQL de solo lectura a la base remota (`SELECT`/`EXPLAIN`), `get_advisors` (security y performance), peticiones GET con la clave pública contra la API REST, `npm audit`, `lint`, `typecheck`, `vitest`, y revisión del historial de git. No se modificó código ni base de datos. No se ejecutó `next build` porque hay un servidor de desarrollo activo en el puerto 3000 (el build habría chocado con su carpeta `.next`).

---

## 1) Resumen

1. **Veredicto: NO se puede lanzar hoy tal cual.** La parte técnica de seguridad de datos está sólida (RLS en las 18 tablas, costos inaccesibles al público, sin secretos en git), pero hay 2 bloqueantes de negocio/legal y varios riesgos altos de operación.
2. **Lo que lo impide:** (a) la base de producción aún tiene datos de prueba y la única zona de entrega activa es «prueba Centro», con NIT, dirección, horarios y hora de corte vacíos (S-01); (b) la política de tratamiento de datos es un texto provisional y no se guarda evidencia del consentimiento (S-02).
3. **Riesgos altos que conviene cerrar el mismo día (todos de esfuerzo S o M):** la página pública `/estado` (S-03), la búsqueda de 2,2 s con índices sin usar (S-04), cero cabeceras de seguridad (S-05), planes gratuitos sin backups ni uso comercial permitido (S-06, S-07), sin límite real de pedidos ni antibots (S-08) y sin forma de enterarse de los errores (S-09).
4. Calidad de código: `lint` OK, `typecheck` OK, `vitest` 344/344 en 30 archivos. `npm audit --omit=dev`: 4 vulnerabilidades moderadas, ninguna alta ni crítica. No hay pruebas E2E.
5. Aún no existe proyecto de Vercel para este repositorio (la cuenta solo tiene `yo-lo-hago1` y `maranatha`): el despliegue es un primer despliegue, y las variables y el dominio se configuran desde cero.

**Conteo:** BLOQUEANTE 2 · ALTA 7 · MEDIA 11 · BAJA 7 (27 hallazgos).

---

## 2) Hallazgos

### BLOQUEANTES

#### S-01 — Datos de prueba y configuración del negocio sin terminar en la base de producción
- **Severidad:** BLOQUEANTE
- **Qué pasa:** La base que usará la tienda real todavía contiene: 2 pedidos de prueba (`EV-000001` cancelado, `EV-000002` en estado `confirmado` por $62.000, cliente de prueba), 1 cliente de prueba, y un único sector, «prueba Centro» (Calarcá, $3.000 de envío, activo). Los otros 11 municipios están inactivos. En la configuración: `hora_corte = null`, `empresa` con NIT, dirección, horarios y redes vacíos. Hay 0 banners.
- **Dónde/Evidencia:**
  - `select numero, estado, total from pedidos` devuelve `EV-000001 cancelado 13000` y `EV-000002 confirmado 62000`.
  - `select s.nombre, m.nombre from sectores s join municipios m ...` devuelve una sola fila: `prueba Centro / Calarcá`.
  - `select clave, valor from configuracion` devuelve `empresa = {"nit": null, "redes": {}, "horarios": null, "direccion": null, ...}` y `hora_corte = null`.
  - Conteos: `banners = 0`, `importaciones = 7`.
  - El pie de la tienda mostrará «Muy pronto publicaremos nuestros datos de contacto» (`src/components/tienda/PieTienda.tsx`, rama `sinContacto`).
- **Por qué importa:** Un cliente real solo vería «Calarcá – prueba Centro» o «Recoger en bodega», y la fecha de entrega saldría sin hora de corte. El pedido `EV-000002` aparecería en el tablero y en la ruta de reparto como si fuera real, y el cliente de prueba conserva un celular.
- **Cómo arreglarlo:**
  1. Cargar las zonas reales desde `/admin/zonas` (pregunta abierta #4 del documento madre), activar los municipios que se atienden y desactivar o renombrar «prueba Centro». Los sectores y municipios no se borran si tienen pedidos (RN-10); para un pedido de prueba se puede cancelar.
  2. Cancelar `EV-000002` con motivo «prueba». Si se quiere dejar la base limpia antes de abrir, que Víctor autorice una limpieza puntual de los 2 pedidos y el cliente de prueba. RN-10 prohíbe borrar pedidos en operación, pero esta limpieza se hace una sola vez antes del lanzamiento y debe ser decisión explícita de Víctor. Después, reiniciar la secuencia del número para que el primer pedido real sea `EV-000001`.
  3. Completar en `/admin/config`: NIT, dirección, horarios, hora de corte, redes, un banner y el pedido mínimo.
  4. Verificar el número de WhatsApp (hoy empieza por `57314…`; confirmar que es el del negocio y no el de pruebas).
- **Esfuerzo:** S (con los datos del cliente a la mano)

#### S-02 — Política de datos provisional, sin evidencia de consentimiento y sin páginas legales
- **Severidad:** BLOQUEANTE (cumplimiento Ley 1581 de 2012, RNF-09 y RF-11)
- **Qué pasa:** `/politica-de-datos` muestra un cuadro que dice «Texto provisional: pendiente de revisión legal antes de abrir la tienda al público». El texto tiene 3 párrafos y no identifica al responsable. La casilla de aceptación del checkout se valida (`acepta_datos: z.literal(true)`), pero **no se guarda en ningún lado**: el aceptar no deja fecha, versión de la política ni IP asociada al pedido. No existen las páginas de Contáctanos, Preguntas frecuentes ni Términos y condiciones (RF-11), y el pie de la tienda no enlaza a la política (el único enlace está dentro del checkout).
- **Dónde/Evidencia:**
  - `src/app/(tienda)/politica-de-datos/page.tsx:8-9` (comentario «TEXTO PROVISIONAL») y `:15-17` (aviso visible al público).
  - `src/lib/validaciones/pedido.ts:58` define `acepta_datos`; `src/app/(tienda)/checkout/actions.ts:131-167` no lo envía a `crear_pedido`; la tabla `pedidos` no tiene columna de consentimiento.
  - `src/components/tienda/PieTienda.tsx` no tiene enlaces legales (RF-01 pide «enlaces legales» en el pie).
  - Faltan en la política: razón social y NIT del responsable, dirección, correo y teléfono de contacto, finalidades específicas, derechos del titular (conocer, actualizar, rectificar, suprimir, revocar, reclamar), procedimiento y plazos para consultas y reclamos (10 y 15 días hábiles), mención de la SIC, y aviso de que se guarda la IP y los datos del negocio.
- **Por qué importa:** Se recopilan nombre, celular, dirección y cédula o NIT sin una política definitiva ni prueba de autorización. La SIC puede sancionar por esto, y si un cliente reclama, el negocio no puede demostrar que aceptó.
- **Cómo arreglarlo:**
  1. Redactar el texto definitivo con el asesor legal y completar los datos del responsable.
  2. Guardar la prueba: nueva migración que agregue a `pedidos` las columnas `acepto_politica_at timestamptz` y `version_politica text` (o equivalente), y que `crear_pedido` las rellene. Cambia el modelo de datos, así que según CLAUDE.md §3.6 primero se propone y se actualiza `docs/`.
  3. Agregar al pie los enlaces a Política de datos y a Términos; crear las páginas mínimas de Términos y de Contacto.
  4. Definir cómo se atiende un pedido de supresión (ver S-18).
- **Esfuerzo:** M (técnico) + el tiempo del asesor legal

---

### ALTAS

#### S-03 — Página de diagnóstico `/estado` expuesta al público
- **Severidad:** ALTA
- **Qué pasa:** `/estado` responde 200 a cualquiera, sin sesión. Muestra qué variables de entorno existen, si la `service_role` funciona y cuántos perfiles hay. Cada visita hace 3 llamadas a Supabase (una con la clave de servicio). El propio archivo dice «Se elimina antes de publicar».
- **Dónde/Evidencia:** `src/app/estado/page.tsx:6-8` (comentario) y `:116-145`; no está en el matcher del proxy (`src/proxy.ts`, solo `/admin/:path*`). Comprobado con `curl http://localhost:3000/estado` → HTTP 200 y el contenido «La service_role lee perfiles: 1».
- **Por qué importa:** Le da a un atacante información de reconocimiento (qué claves están configuradas, que el servidor usa `service_role`, cuántos usuarios hay) y permite generar carga contra la base con llamadas baratas para él.
- **Cómo arreglarlo:** Borrar `src/app/estado/` antes del despliegue (requiere la confirmación de Víctor por CLAUDE.md §3.1). Si se quiere conservar para diagnóstico, moverlo detrás de `requerirSeccion("config")` en `/admin/estado`.
- **Esfuerzo:** S

#### S-04 — La búsqueda y el listado tardan más de 2 s; los índices de búsqueda no se usan
- **Severidad:** ALTA
- **Qué pasa:** `buscar_catalogo('lentejas', 6)` ejecutada con el rol `anon` tarda **2.177 ms**; contar la vista `v_tienda_productos` tarda **1.719 ms**. El requisito RNF-03 pide menos de 300 ms. Los dos índices diseñados para la búsqueda (`productos_busqueda_idx` GIN y `productos_nombre_trgm_idx`) aparecen como «no usados» en el advisor de rendimiento. El rol `anon` tiene `statement_timeout = 3s`, de modo que dos o tres búsquedas simultáneas sin caché pueden fallar con timeout.
- **Dónde/Evidencia:**
  - `supabase/migrations/0008_tienda.sql:79-108`: la función recorre toda la vista, calcula `texto_busqueda` por fila (con `f_unaccent`, `concat_ws`, un `string_agg` de SKUs) y evalúa `word_similarity` en cada fila: es un recorrido completo (`Seq Scan on productos`), y por cada producto se ejecutan subconsultas de RLS (`producto_visible`, `categoria_publica`…).
  - `EXPLAIN ANALYZE` de la vista: `Seq Scan on productos p … Filter: (activo AND (SubPlan 4))`, `Execution Time: 1718.890 ms`.
  - `select rolname, rolconfig from pg_roles` → `anon: statement_timeout=3s`.
  - Advisor de rendimiento: `Index productos_busqueda_idx … has not been used` y `productos_nombre_trgm_idx … has not been used`.
  - La caché (`"use cache"`, `src/lib/tienda/consultas.ts:46-48`, `:155-157`, `:187-190`) ayuda con consultas repetidas, pero cada texto distinto es una consulta nueva de ~2 s.
- **Por qué importa:** La búsqueda y los filtros son el corazón de la tienda. Con la base pequeña de hoy (22 MB) ya tarda 2 s; con tráfico real o una persona que escriba textos distintos (ver S-08) la base se satura. El endpoint público `/api/sugerencias` llama a esta función en cada pulsación.
- **Cómo arreglarlo:** Guardar el texto de búsqueda ya normalizado en una columna indexada (por ejemplo, una columna generada o mantenida por trigger en `productos`, con índice GIN `gin_trgm_ops`), y hacer que `buscar_catalogo` filtre primero sobre esa tabla indexada y solo después aplique la visibilidad (RN-01). Medir de nuevo con `EXPLAIN ANALYZE` hasta bajar de 300 ms. Mientras tanto, si no hay tiempo hoy, dejar la búsqueda activa pero con el límite de tasa de S-08, y subir el rendimiento de la instancia (S-06). Hay que hacerlo en una migración nueva (no se editan las aplicadas) y pedir confirmación antes de aplicarla a la base remota (CLAUDE.md §3.7).
- **Esfuerzo:** L

#### S-05 — No hay ninguna cabecera de seguridad HTTP (CSP, anti-clickjacking, HSTS, etc.)
- **Severidad:** ALTA
- **Qué pasa:** `next.config.ts` no define `headers()`. Una petición a la tienda devuelve solo `X-Powered-By: Next.js`: sin `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy` ni `X-Content-Type-Options`.
- **Dónde/Evidencia:** `next.config.ts` (33 líneas, solo `cacheComponents`, `images`, `turbopack`); `curl -I http://localhost:3000/` muestra únicamente `X-Powered-By`. (En Vercel, HTTPS y HSTS en el dominio los gestiona la plataforma; el resto sigue sin definirse.)
- **Por qué importa:** El panel `/admin` puede incrustarse en una página ajena (clickjacking) y engañar al administrador para pulsar botones. Sin CSP, cualquier fallo de XSS futuro podría robar la sesión (las cookies de sesión son legibles por JavaScript, ver S-10).
- **Cómo arreglarlo:** Agregar `headers()` en `next.config.ts` y `poweredByHeader: false`. Una política realista y compatible con Cache Components (la guía local de Next indica que los nonces obligan a renderizado dinámico y son incompatibles con PPR, `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md` líneas 38 y 385-397, así que se usa la variante «sin nonces»):
  - `Content-Security-Policy`: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://koabdnqniwqygmsydwad.supabase.co; font-src 'self'; connect-src 'self' https://koabdnqniwqygmsydwad.supabase.co wss://koabdnqniwqygmsydwad.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`
  - `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Strict-Transport-Security: max-age=63072000; includeSubDomains` (solo cuando el dominio ya sirva todo por HTTPS).
  - Probar primero en modo `Content-Security-Policy-Report-Only` y revisar la consola de las pantallas del panel (subida de imágenes, importación) antes de hacerlo obligatorio. La fuente Inter de `next/font/google` se autoalberga, así que `font-src 'self'` basta.
- **Esfuerzo:** M

#### S-06 — Supabase en plan gratuito: sin backups y con pausa por inactividad
- **Severidad:** ALTA
- **Qué pasa:** El proyecto ya se pausó una vez. RNF-11 exige «base de datos con backup diario». En Supabase los backups diarios descargables y la restauración a un punto en el tiempo (PITR) son de planes de pago (Pro en adelante); el plan gratuito no los incluye y pausa los proyectos con una semana sin actividad. La base tiene hoy 22 MB y el bucket 63 MB (3.042 objetos), muy por debajo de los límites, por lo que el motivo para pagar no es el espacio sino la continuidad.
- **Dónde/Evidencia:** `get_project` → `status ACTIVE_HEALTHY`, región `sa-east-1`, Postgres 17.11; `select pg_size_pretty(pg_database_size(...))` → 22 MB; suma de `storage.objects` → 63 MB. Los pedidos, clientes y costos (ganancia del negocio) solo existen en esa base.
- **Por qué importa:** Si la base se pausa, la tienda se cae y los pedidos no entran. Si se corrompe o alguien borra datos por error, no hay a qué volver. Es la única copia de los pedidos y de los costos.
- **Cómo arreglarlo:**
  1. Pasar el proyecto a **Pro** (US$25/mes aprox.) antes de abrir al público; confirmar el precio vigente en la consola de Supabase.
  2. Activar y verificar los backups diarios, y evaluar el complemento PITR si el negocio no tolera perder más de un día de pedidos.
  3. Mientras tanto, usar la exportación a Excel (`/admin/importar/descargar?tipo=catalogo`) para el catálogo y acordar una exportación periódica de pedidos (hoy no existe una exportación de pedidos y clientes).
  4. Habilitar también la protección de contraseñas filtradas (S-11), que en Supabase requiere plan Pro.
- **Esfuerzo:** S

#### S-07 — Vercel: cuenta de tipo personal (Hobby) para un negocio
- **Severidad:** ALTA (riesgo de uso no permitido y de límites)
- **Qué pasa:** Solo existe el equipo personal `victorgutyy's projects` (id `team_4BwyEDkbGlJQ7UB82YYabq8K`), que contiene los proyectos `yo-lo-hago1` y `maranatha`; no hay proyecto para este repositorio. El plan Hobby de Vercel es para uso personal y no comercial, según sus términos; una tienda de un negocio es uso comercial.
- **Dónde/Evidencia:** `list_teams` y `list_projects` de Vercel (solo lectura). No se puede ver el plan exacto desde la herramienta; confirmar en Vercel → Settings → Billing.
- **Por qué importa:** Vercel puede suspender un proyecto comercial en Hobby, y las funciones tienen límites de duración, memoria y cuotas menores. Una suspensión en plena temporada de pedidos sería peor que el costo del plan.
- **Cómo arreglarlo:** Crear el proyecto bajo un equipo en plan **Pro** (US$20/usuario/mes aprox., confirmar vigente) o usar un equipo del negocio. Crear el proyecto desde el repositorio `victorGutyy/distribuidoraJD`, rama `main`.
- **Esfuerzo:** S

#### S-08 — Sin límite de tasa real ni antibots en endpoints públicos
- **Severidad:** ALTA
- **Qué pasa:**
  - **Crear pedido:** el único freno es el de la base: máximo 5 pedidos por celular o IP en 10 minutos (`0010_pedidos_admin.sql:84-92`). No hay CAPTCHA. El campo trampa (`web`) es opcional en el esquema (`z.string().max(0).optional().default("")`, `pedido.ts:60`) y la Server Action se puede llamar directo sin pasar por el formulario, así que un bot lo omite. Un atacante con varias IP, o simplemente cambiando de celular y de IP, puede llenar el panel de pedidos falsos, cada uno con hasta 50 líneas. Con una IP: 5 cada 10 min ≈ 720 por día.
  - **Sugerencias:** `/api/sugerencias` (`src/app/api/sugerencias/route.ts`) no tiene límite de tasa. Cada texto distinto es una caché fallida y una consulta de ~2 s a la base (ver S-04), y la respuesta dice `Cache-Control: public, s-maxage=60`, con lo que además se llena la caché con textos aleatorios.
  - **IP de origen:** se toma el primer valor de `x-forwarded-for` (`checkout/actions.ts:42-46`). En Vercel esa cabecera la fija la plataforma y es confiable; fuera de Vercel se podría falsificar. Si no llega ninguna IP, la comprobación por IP se omite (`v_ip is not null`).
  - **Sobrescritura de clientes:** quien conozca el celular de un cliente puede enviar un pedido con ese número y cambiar el nombre, el negocio, el documento y la dirección guardados (`on conflict (celular) do update`, `0010_pedidos_admin.sql:126`). Es el comportamiento de RN-11, pero no hay verificación del celular.
- **Por qué importa:** Un competidor o un bot puede saturar la base, inundar la operación de pedidos falsos o ensuciar la ficha de los clientes. La base gratuita (S-06) no aguantaría una ráfaga.
- **Cómo arreglarlo:**
  1. En Vercel → Firewall: regla de límite de tasa por IP para `POST` a la ruta del checkout y para `/api/sugerencias` (por ejemplo 30 req/min), y activar el modo «Attack Challenge» solo si hay un ataque. Confirmar qué reglas incluye el plan.
  2. Agregar Cloudflare Turnstile o Vercel BotID al checkout (la versión gratuita de Turnstile basta).
  3. Hacer obligatorio el honeypot en el servidor (devolver error si el campo no vino) y exigir un tiempo mínimo de llenado.
  4. Si la IP viene vacía, rechazar o limitar por celular con un tope más bajo.
  5. En `/api/sugerencias`, limitar el largo y la frecuencia, y no cachear en el CDN consultas arbitrarias.
  6. No sobrescribir los datos de un cliente existente desde el checkout si el nombre difiere; guardar el cambio solo en el pedido (`direccion_entrega` ya se guarda aparte).
- **Esfuerzo:** M

#### S-09 — No hay forma de enterarse de los errores en producción
- **Severidad:** ALTA
- **Qué pasa:** No existe `error.tsx`, `global-error.tsx`, ni integración con Sentry u otro servicio; no hay `instrumentation`. En todo el código hay un solo `console.error` (`src/app/admin/(auth)/actions.ts:97`). Cuando falla la creación de un pedido por un motivo distinto de «LIMITE» o «ZONA», la Server Action responde con un mensaje genérico y **no registra nada**.
- **Dónde/Evidencia:** `src/app/(tienda)/checkout/actions.ts:170-178` (`error?.message` se descarta sin log); `find src -name "error.tsx" -o -name "global-error.tsx" -o -name "instrumentation*"` no devuelve archivos; solo `src/app/(tienda)/not-found.tsx`.
- **Por qué importa:** Si la base responde con timeout (ver S-04) o falla una validación, el cliente ve «No pudimos crear tu pedido» y el negocio pierde la venta sin enterarse. Un error de renderizado muestra la pantalla genérica de Next.
- **Cómo arreglarlo:**
  1. Añadir `console.error` con el código y el mensaje de Supabase (sin datos del cliente) en las rutas de error del checkout, de los pedidos del panel y de la importación; los logs de ejecución de Vercel los guardan.
  2. Crear `src/app/error.tsx` y `src/app/global-error.tsx` en español.
  3. Integrar Sentry (plan gratuito) o, como mínimo, activar un Log Drain de Vercel; configurar una alerta por correo cuando haya errores en el checkout.
  4. Agregar un monitor externo gratuito (por ejemplo UptimeRobot) sobre `/` y sobre `/catalogo`.
- **Esfuerzo:** M

---

### MEDIAS

#### S-10 — Cookies de sesión del panel: sin `Secure`, legibles por JavaScript y válidas 400 días
- **Severidad:** MEDIA
- **Qué pasa:** `@supabase/ssr` 0.12.7 usa por defecto `path "/"`, `sameSite "lax"`, `httpOnly false` y `maxAge` de 400 días, y no marca `Secure`. El código pasa las opciones tal como llegan (`src/lib/supabase/server.ts:22-31`, `src/lib/supabase/proxy.ts:25-34`) y no define `cookieOptions`. `httpOnly` no se puede activar porque el navegador sube las imágenes directamente a Storage con la sesión (`src/lib/supabase/client.ts`, usado por `SubidorImagenes`, `SubidorBanner` y `SubidorFotosLote`).
- **Dónde/Evidencia:** `node_modules/@supabase/ssr/dist/main/utils/constants.js` líneas 4-10.
- **Por qué importa:** Sumado a la falta de CSP (S-05), un XSS se llevaría la sesión del administrador. Un teléfono o computador perdido mantendría la sesión abierta mucho tiempo (el vencimiento por inactividad o duración máxima de sesión es una función del plan Pro de Supabase).
- **Cómo arreglarlo:** Pasar `cookieOptions: { secure: true, sameSite: "lax", maxAge: 60*60*24*7 }` en los tres `createServerClient`/`createBrowserClient` (en desarrollo local con `http` poner `secure` según `NODE_ENV`). Resolver S-05 con CSP para reducir el riesgo de XSS. En Supabase Pro, configurar tiempo máximo de sesión e inactividad.
- **Esfuerzo:** S

#### S-11 — Autenticación del admin: sin protección de contraseñas filtradas, sin MFA y sin bloqueo propio por intentos
- **Severidad:** MEDIA
- **Qué pasa:** El advisor de seguridad avisa `auth_leaked_password_protection`: desactivada. La regla propia exige solo 8 caracteres (`src/lib/validaciones/auth.ts:16-19`). No hay segundo factor (el flujo de login solo usa `signInWithPassword`, `actions.ts:37-40`) ni límite propio de intentos; solo cuentan los límites de Supabase Auth. Hay un único usuario (admin) y su correo está publicado en el repositorio (S-19). La recuperación de contraseña (`solicitarRecuperacion`) es pública y se puede usar para llenarle el correo al administrador.
- **Dónde/Evidencia:** `get_advisors` (security) → `auth_leaked_password_protection`; `select ... from perfiles join auth.users` → un solo perfil `admin`, activo. `https://<proyecto>.supabase.co/auth/v1/settings` confirma `disable_signup: true` (bien), `mailer_autoconfirm: false`, solo proveedor `email`.
- **Por qué importa:** Es el acceso a precios, costos, márgenes y todos los pedidos. Se conoce el correo y la única defensa es una contraseña de al menos 8 caracteres.
- **Cómo arreglarlo:** (1) Activar la protección de contraseñas filtradas (requiere Pro, ver S-06); (2) subir el mínimo a 12 caracteres en Supabase Auth y en Zod; (3) activar MFA TOTP para el admin (Supabase lo incluye) o, como mínimo, CAPTCHA (Turnstile) en login y recuperación; (4) crear un segundo administrador de respaldo con otro correo para no depender de una sola cuenta; (5) el límite de peticiones de Auth se revisa en Supabase → Auth → Rate Limits.
- **Esfuerzo:** M

#### S-12 — URL del sitio y redirecciones de Auth: sin definir para producción, y el origen sale de cabeceras de la petición
- **Severidad:** MEDIA
- **Qué pasa:** `obtenerOrigen()` arma los enlaces de recuperación e invitación con la cabecera `Origin`, o con `x-forwarded-host`/`host` (`src/lib/origen.ts:5-12`). No hay una variable fija del sitio. Los enlaces se aceptan solo si la URL está en la lista de «Redirect URLs» de Supabase; si en Supabase siguen solo `localhost` y la «Site URL» por defecto, la recuperación de contraseña en producción enviará al administrador a un enlace roto o a localhost. No se puede leer esa configuración con las herramientas disponibles (no verificado).
- **Dónde/Evidencia:** `src/lib/origen.ts:5-12`; `src/app/admin/(auth)/actions.ts:80-85` (`redirectTo`); `src/app/admin/(panel)/usuarios/actions.ts:27-33` (enlace de invitación con `${origen}/admin/auth/confirmar?token_hash=…`).
- **Por qué importa:** Si el administrador olvida su contraseña el día del lanzamiento y la recuperación está mal configurada, queda fuera del panel. Además, derivar enlaces de cabeceras permite, en configuraciones flojas, que un enlace de recuperación apunte a otro dominio.
- **Cómo arreglarlo:** Crear la variable `NEXT_PUBLIC_SITE_URL` (por ejemplo `https://dominio-real.com`) y usarla en `obtenerOrigen()` con respaldo local solo en desarrollo. En Supabase → Auth → URL Configuration: poner la «Site URL» de producción y en «Redirect URLs» solo `https://dominio-real.com/admin/auth/callback` y `https://dominio-real.com/admin/auth/confirmar` (sin comodines amplios). Probar la recuperación de contraseña en producción antes de dar por cerrado el despliegue.
- **Esfuerzo:** S

#### S-13 — Correo de Auth sin SMTP propio
- **Severidad:** MEDIA
- **Qué pasa:** No se pudo verificar la configuración de correo de Auth. El servicio de correo integrado de Supabase está pensado para pruebas: tiene un tope muy bajo de mensajes por hora y, en proyectos nuevos, solo envía a direcciones del equipo de la organización. La recuperación de contraseña del admin depende de él.
- **Dónde/Evidencia:** `src/app/admin/(auth)/actions.ts:80-101` (usa `resetPasswordForEmail` y el manejo de `over_email_send_rate_limit`). Pendiente de verificar en Supabase → Auth → SMTP.
- **Por qué importa:** Si el correo no sale, nadie recupera una contraseña olvidada.
- **Cómo arreglarlo:** Configurar SMTP propio (Resend, Brevo, el correo del dominio) y personalizar los textos en español.
- **Esfuerzo:** M

#### S-14 — Sin `robots.txt`, `sitemap.xml` ni `metadataBase` (RNF-10)
- **Severidad:** MEDIA
- **Qué pasa:** `/robots.txt` y `/sitemap.xml` responden 404. Solo la ficha de producto define `openGraph` y `canonical`; el sitio no tiene `metadataBase`, así que las imágenes y enlaces de Open Graph quedan relativos. El panel y `/estado` se excluyen solo con `<meta robots>`, no con `robots.txt`. Los archivos de la plantilla de Next (`public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) siguen en `public/`.
- **Dónde/Evidencia:** `curl` a `/robots.txt` y `/sitemap.xml` → 404; `src/app/layout.tsx:10-14` (sin `metadataBase`); `find src -name "robots*" -o -name "sitemap*" -o -name "manifest*"` → vacío.
- **Por qué importa:** Sin sitemap Google tarda en descubrir ~1.600 productos; sin `metadataBase` las vistas previas al compartir por WhatsApp pueden salir sin imagen.
- **Cómo arreglarlo:** Crear `src/app/robots.ts` (permitir `/`, bloquear `/admin`, `/api`, `/carrito`, `/checkout`, `/pedido`, `/estado`), `src/app/sitemap.ts` (categorías y productos visibles; con ~1.700 URLs conviene un solo archivo) y `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL)` en el layout raíz. Borrar los SVG de la plantilla (con permiso).
- **Esfuerzo:** M

#### S-15 — Pruebas: solo unitarias; no hay E2E ni pruebas de RLS ni integración continua
- **Severidad:** MEDIA
- **Qué pasa:** `vitest` pasa 344 pruebas en 30 archivos, pero todas son de lógica pura (`tests/unit/*.test.ts`: precios, entregas, validaciones, importación, permisos, carrito). `tests/e2e/` está vacío, Playwright no está instalado y `package.json` no tiene el script `test:e2e` que menciona CLAUDE.md §9 (RNF-13 lo exige para el flujo de compra). No hay pruebas de RLS, de las Server Actions, del proxy ni de las funciones SQL (`crear_pedido`, `cambiar_estado_pedido`, `editar_items_pedido`). No existe `.github/` (sin CI): nada impide mergear código que no pase `lint`/`typecheck`/`test`.
- **Dónde/Evidencia:** `ls tests/e2e` vacío; `ls node_modules/@playwright` no existe; `vitest.config.mts:12-14` («las E2E irán en tests/e2e en la fase F7»); sin `.github/workflows`.
- **Por qué importa:** Los cambios de última hora a RLS, precios o checkout no tienen red de seguridad. La fase F7 (CLAUDE.md §12) sigue sin marcarse como hecha.
- **Cómo arreglarlo:** Con permiso para instalar Playwright: una prueba E2E mínima del flujo «buscar → agregar → checkout → pedido» contra la base de pruebas (ver S-16) y otra de acceso al panel. Pruebas de RLS escritas como script SQL que se ejecute contra una rama de Supabase. Un workflow de GitHub Actions con `npm ci`, `lint`, `typecheck` y `test`.
- **Esfuerzo:** L

#### S-16 — Desarrollo y producción comparten la misma base de datos
- **Severidad:** MEDIA
- **Qué pasa:** Hay un único proyecto de Supabase (`distribuidora-jd`) y `.env.local` apunta a él; el servidor de desarrollo activo en el puerto 3000 también. Los pedidos de prueba de S-01 salieron de ahí. Con la tienda abierta, cualquier prueba local, importación de ensayo o edición de precios afectará datos reales. Además, las vistas previas de Vercel (`Preview`) usarían la misma base si se les copian las variables de producción.
- **Dónde/Evidencia:** `.env.local` (cabecera «Proyecto Supabase: distribuidora-jd (sa-east-1)»; valores no impresos); `get_project` muestra un solo proyecto de la organización relevante; pedidos de prueba presentes en la base.
- **Por qué importa:** Una prueba mal hecha puede cancelar un pedido real, cambiar precios en vivo o saturar la base.
- **Cómo arreglarlo:** Crear un segundo proyecto (o una rama de Supabase) para desarrollo y pruebas, aplicar las 12 migraciones y el `seed.sql`, y usar variables distintas en `Preview`/local. En Vercel, no definir las claves de producción en el entorno `Preview`.
- **Esfuerzo:** M

#### S-17 — Región: Vercel por defecto en EE. UU., Supabase en São Paulo
- **Severidad:** MEDIA
- **Qué pasa:** La base está en `sa-east-1` (São Paulo). Si no se fija, las funciones de Vercel corren por defecto en `iad1` (Washington D. C.), así que cada consulta a la base cruza el continente (≈ 100-150 ms de ida y vuelta), y una página o acción con varias consultas en secuencia (el checkout lee precios, zona y crea el pedido) las multiplica. No hay `vercel.json` ni configuración de región.
- **Dónde/Evidencia:** `get_project` → `region: sa-east-1`; no existe `vercel.json`.
- **Por qué importa:** Contra el objetivo de LCP < 2,5 s en 4G (RNF-01) y la experiencia del tendero en el celular.
- **Cómo arreglarlo:** En Vercel → Project Settings → Functions → región `gru1` (São Paulo) o `vercel.json` con `"regions": ["gru1"]`. Verificar que el plan permita elegir esa región.
- **Esfuerzo:** S

#### S-18 — Las cuentas de datos del titular no se pueden suprimir en la práctica (derechos Ley 1581 vs. RN-10)
- **Severidad:** MEDIA
- **Qué pasa:** La política promete que el cliente puede pedir la eliminación de sus datos, pero el modelo lo impide: un disparador bloquea el borrado de clientes y de pedidos (`clientes_no_borrar`, `pedidos_no_borrar`, función `private.bloquear_borrado`) conforme a RN-10. No existe un procedimiento de anonimización. Además se guarda la IP de cada pedido (`pedidos.ip_origen`), que también es dato personal y no se menciona en la política.
- **Dónde/Evidencia:** `select tgname ... from pg_trigger` → `clientes_no_borrar`, `pedidos_no_borrar`; `supabase/migrations/0010_pedidos_admin.sql:84-92` y `checkout/actions.ts:151` (IP).
- **Por qué importa:** Cuando un cliente ejerza su derecho de supresión, el negocio no podrá cumplirlo con las herramientas del panel y quedará incumpliendo la política que publicó.
- **Cómo arreglarlo:** Definir con el asesor legal el procedimiento: anonimizar (reemplazar nombre, celular, documento y dirección por valores genéricos y vaciar `ip_origen`) conservando el pedido por razones contables. Implementarlo como una función de administrador `anonimizar_cliente(id)` en una migración nueva, con confirmación de Víctor antes de aplicarla. Definir también por cuánto tiempo se guardan las IP y borrarlas pasado ese plazo.
- **Esfuerzo:** M

#### S-19 — Correo personal del dueño publicado en el repositorio público
- **Severidad:** MEDIA (BAJA si el correo se cambia por uno del negocio)
- **Qué pasa:** `supabase/seed.sql:16` contiene el correo del administrador (`u.email = '…@gmail.com'`) en un repositorio público de GitHub. Es el único usuario del panel.
- **Dónde/Evidencia:** `git grep -n "gmail.com" supabase/seed.sql`.
- **Por qué importa:** Un atacante sabe qué cuenta atacar (fuerza bruta, phishing de «recuperación de contraseña»). Combinado con S-11 reduce el esfuerzo del ataque.
- **Cómo arreglarlo:** Cambiar el seed para que reciba el correo por parámetro o variable (`:'admin_email'`), y como el correo ya está en el historial de git, asumirlo conocido: activar MFA y contraseña larga (S-11) y, si se puede, usar un correo del negocio distinto del personal para el rol de administrador. Reescribir el historial de git solo si Víctor lo decide, ya que no elimina las copias ya indexadas.
- **Esfuerzo:** S

#### S-20 — `shadcn` está en `dependencies`; `npm audit` reporta 4 vulnerabilidades moderadas
- **Severidad:** MEDIA (impacto real BAJO)
- **Qué pasa:** `npm audit --omit=dev` reporta 4 vulnerabilidades moderadas en cadena: `minimatch` (DoS por amplificación de globs, GHSA-g3hv-75wg-m249) ← `@ts-morph/common` ← `ts-morph` ← `shadcn`. No hay altas ni críticas. `shadcn` es una herramienta de línea de comandos y figura como dependencia de producción (`package.json`, `"shadcn": "^4.23.0"`), por lo que se instala en Vercel y entra al reporte. La corrección automática (`npm audit fix --force`) instalaría `shadcn@1.0.0`, que es un cambio incompatible: no se recomienda.
- **Dónde/Evidencia:** `npm audit --omit=dev` → «4 moderate severity vulnerabilities»; `package.json` línea de `shadcn`.
- **Por qué importa:** La vulnerabilidad no se ejecuta en el servidor de la tienda (es una herramienta de desarrollo), pero ensucia el reporte y agrega peso al despliegue.
- **Cómo arreglarlo:** Mover `shadcn` a `devDependencies` (o quitarlo y usarlo con `npx`) con permiso de Víctor. Revisar con `npm audit` después. Los paquetes `xlsx` (SheetJS 0.20.3 desde `cdn.sheetjs.com`, con `integrity` fijada en `package-lock.json`) no los cubre `npm audit`: es la versión corregida de las vulnerabilidades conocidas, pero debe actualizarse a mano.
- **Esfuerzo:** S

---

### BAJAS

#### S-21 — Funciones `SECURITY DEFINER` ejecutables por usuarios autenticados (advisor 0029)
- **Severidad:** BAJA (riesgo aceptado; verificado)
- **Qué pasa:** El advisor marca `cambiar_estado_pedido` y `editar_items_pedido` como ejecutables por `authenticated` vía `/rest/v1/rpc/...`. Ambas validan el rol dentro de la función: la primera usa `private.rol_actual()` y exige admin, o vendedor con sector asignado (`0010_pedidos_admin.sql:~225-245`); la segunda exige `tiene_rol(['admin'])` (`:~290-292`). `anon` no puede ejecutarlas (`has_function_privilege('anon', ...)` = false). `crear_pedido` solo la puede ejecutar `service_role`.
- **Dónde/Evidencia:** `get_advisors` security; consulta a `pg_proc` con `has_function_privilege`.
- **Por qué importa:** Es el diseño correcto (RLS no restringe columnas), pero conviene documentarlo como excepción consciente.
- **Cómo arreglarlo:** Dejar una nota en `docs/` y una prueba SQL que confirme que un usuario inactivo o un vendedor de otro sector recibe error.
- **Esfuerzo:** S

#### S-22 — Funciones del esquema `private` con `EXECUTE` para `PUBLIC`
- **Severidad:** BAJA
- **Qué pasa:** Todas las funciones de `private` (`es_staff`, `rol_actual`, `tiene_rol`, `pedido_editable`, …) son `SECURITY DEFINER` y tienen `EXECUTE` para `PUBLIC`, y `anon` y `authenticated` tienen `USAGE` en el esquema `private`. Hoy no se pueden llamar desde la API REST porque el esquema `private` no está entre los «Exposed schemas» (valor por defecto de Supabase: `public`, `graphql_public`; no se pudo leer ese ajuste con las herramientas, por lo que queda por verificar).
- **Dónde/Evidencia:** consulta a `pg_proc` en `private`; `has_schema_privilege('anon','private','USAGE')` = true.
- **Por qué importa:** Si alguien agrega `private` a los esquemas expuestos, todas esas funciones quedarían accesibles. Solo devuelven datos sobre quien llama, pero es una puerta que mejor tener cerrada.
- **Cómo arreglarlo:** Verificar en Supabase → API Settings que «Exposed schemas» sea solo `public`. En una migración futura, `revoke execute ... from public` sobre las funciones de `private`, dejando solo lo necesario para las políticas.
- **Esfuerzo:** S

#### S-23 — La configuración pública expone `updated_by` (id del administrador)
- **Severidad:** BAJA
- **Qué pasa:** La política `configuracion_leer_publico` filtra por clave, no por columna: un visitante puede consultar `/rest/v1/configuracion?select=*` y recibe también `updated_at` y `updated_by`. Hoy `updated_by` es `null`, pero al guardar la configuración desde el panel contendrá el UUID del administrador.
- **Dónde/Evidencia:** `curl` con la clave pública a `/rest/v1/configuracion?select=*&limit=1` → columnas `clave, valor, updated_at, updated_by`.
- **Por qué importa:** Entrega un identificador interno del único usuario del panel. Poca gravedad, pero sobra.
- **Cómo arreglarlo:** Retirar el `SELECT` de tabla para `anon` y dar `GRANT SELECT (clave, valor) ON configuracion TO anon` (el RLS por clave se mantiene).
- **Esfuerzo:** S

#### S-24 — Políticas RLS permisivas duplicadas (9 tablas) e índices sin uso
- **Severidad:** BAJA
- **Qué pasa:** El advisor de rendimiento avisa de 9 tablas (`banners`, `categorias`, `configuracion`, `marcas`, `municipios`, `producto_imagenes`, `productos`, `sectores`, `variantes`) con dos políticas `SELECT` permisivas para `authenticated` (la pública y la de personal), que se evalúan juntas en cada consulta. También lista 14 índices «sin uso»; casi todos solo porque la base aún no tiene tráfico (los dos de búsqueda sí son un problema real, ver S-04). No se detectaron claves foráneas sin índice.
- **Dónde/Evidencia:** `get_advisors` performance (`multiple_permissive_policies`, `unused_index`).
- **Por qué importa:** Un pequeño costo extra por consulta del personal; no urgente.
- **Cómo arreglarlo:** Unificar cada par en una sola política `SELECT` (`using (activo or es_staff())`). No borrar los índices hasta que haya tráfico real durante algunas semanas.
- **Esfuerzo:** M

#### S-25 — Árbol de trabajo con cambios sin guardar y README de plantilla
- **Severidad:** BAJA
- **Qué pasa:** `git status` muestra 8 archivos modificados sin commit (5 componentes de la tienda y el panel y 2 scripts de Python, entre otros). Vercel despliega desde GitHub, así que esos cambios no estarían en el despliegue. El `README.md` es el de `create-next-app` y no explica cómo desplegar, qué variables hacen falta ni cómo restaurar. `package.json` no define `engines` (versión de Node) ni existe `.nvmrc`; el desarrollo usa Node 24.19.
- **Dónde/Evidencia:** `git status --short`; `README.md`; `package.json`.
- **Por qué importa:** Se puede desplegar una versión distinta de la que se probó localmente, y quien herede el proyecto no sabe cómo levantarlo.
- **Cómo arreglarlo:** Confirmar con Víctor qué hacer con los cambios (commit propuesto, no ejecutado); agregar `"engines": { "node": ">=24" }`; reescribir el README con los pasos de la sección 4.
- **Esfuerzo:** S

#### S-26 — Optimización de imágenes de Vercel y dependencia de variable en el build
- **Severidad:** BAJA
- **Qué pasa:** `next.config.ts:7-9` lee `NEXT_PUBLIC_SUPABASE_URL` al compilar para autorizar el host de las imágenes; si la variable no está disponible durante el build en Vercel, `remotePatterns` queda vacío y todas las imágenes de productos fallan. Además hay 1.521 imágenes de producto (más miniaturas) que pasan por el optimizador de imágenes de Vercel, cuyas cuotas gratuitas son limitadas. Los archivos ya están en WebP y pesan en promedio 21 KB (máx. 195 KB).
- **Dónde/Evidencia:** `next.config.ts:7-23`; `select avg(size) from storage.objects` → promedio 21,6 KB.
- **Por qué importa:** Un build sin esa variable deja la tienda sin fotos, y un exceso de cuota del optimizador puede generar costos o errores 402 en imágenes.
- **Cómo arreglarlo:** Definir `NEXT_PUBLIC_SUPABASE_URL` en Production y Preview antes del primer build, y revisar el uso del optimizador en Vercel durante la primera semana; si crece, evaluar `unoptimized` para las miniaturas (que ya vienen reducidas).
- **Esfuerzo:** S

#### S-27 — Pedidos: texto libre y datos del cliente en el mensaje de WhatsApp
- **Severidad:** BAJA
- **Qué pasa:** El mensaje que se envía por WhatsApp incluye nombre, celular, dirección y notas del cliente. El texto lo escribe el propio cliente, se arma en el servidor (`src/lib/whatsapp.ts`) y se envía a un número configurable. No hay riesgo de inyección en el servidor (se usa `encodeURIComponent`), pero el panel muestra esas notas y direcciones a quien las revisa.
- **Dónde/Evidencia:** `src/lib/whatsapp.ts`; `checkout/actions.ts:186-200`; React escapa el texto y la única `dangerouslySetInnerHTML` (JSON-LD de producto, `producto/[slug]/page.tsx:81`) escapa `<`.
- **Por qué importa:** Sin hallazgo explotable; se registra como revisado.
- **Cómo arreglarlo:** Nada urgente. Mantener el escape actual si se agregan correos o plantillas HTML.
- **Esfuerzo:** S

---

## 3) Lista de variables de entorno para Vercel

El código solo lee estas tres variables (`grep process.env src`). Las `NEXT_PUBLIC_*` se incrustan en el JavaScript al compilar: deben estar definidas **antes** del build y cambiarlas obliga a volver a desplegar.

| Variable | Tipo | Dónde se usa | Valor / formato | Entornos |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Pública | `src/lib/supabase/env.ts:13`; `next.config.ts:7` (autoriza imágenes en el build); `(tienda)/page.tsx:33`; `lib/tienda/consultas.ts:305`; `banners/actions.ts:40,134`; `productos/imagenes-actions.ts:22` | `https://koabdnqniwqygmsydwad.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Pública (clave «publishable», formato `sb_publishable_…`) | `src/lib/supabase/env.ts:14` → clientes de navegador, servidor y proxy | Se copia de Supabase → Project Settings → API Keys. La seguridad la da RLS | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | **SECRETA** (formato `sb_secret_…`) | `src/lib/supabase/env.ts:26` → `admin.ts` → `checkout/actions.ts:131` (crear pedido), `usuarios/actions.ts` y `usuarios/page.tsx:40` (crear usuarios y enlaces), `estado/page.tsx` | Se copia de Supabase → API Keys. Omite RLS. Marcar como **Sensitive** en Vercel; **no** definirla en Preview ni Development | Solo **Production** |
| `NEXT_PUBLIC_SITE_URL` *(a crear, ver S-12 y S-14)* | Pública | `lib/origen.ts`, `metadataBase`, `robots.ts`, `sitemap.ts` | `https://dominio-real.com` (sin barra final) | Production (y la URL de preview en Preview) |

No se necesitan: `NODE_ENV` (lo fija Next), variables de Sentry (solo si se integra, S-09), ni claves de WhatsApp (se usa el enlace `wa.me`; el número se guarda en la tabla `configuracion`).

Notas:
- `.env.example` documenta las tres variables actuales; hay que agregar `NEXT_PUBLIC_SITE_URL` cuando se cree. `.gitignore` excluye `.env*` salvo `.env.example` (verificado).
- Las claves tienen el formato nuevo de Supabase (`sb_publishable_`/`sb_secret_`), no los JWT antiguos de larga vida: es lo recomendable.
- Después de pegar las variables en Vercel, rotar la clave secreta si alguna vez se compartió por chat, correo o capturas.

**Configuración de build y runtime**
- Framework: Next.js 16.4.6, comando de instalación `npm ci`, build `next build`, salida por defecto. Node: 24.x (la versión con que se desarrolla; fijarla con `engines`, S-25).
- Región de las funciones: `gru1` (S-17).
- Dominio: dominio propio (pregunta abierta #9 del documento madre) añadido en Vercel → Domains. Elegir uno canónico (por ejemplo `www.` o el dominio raíz) y redirigir el otro con 308; HTTPS y certificado automáticos de Vercel.
- Uso comercial: cuenta en plan Pro (S-07).

---

## 4) Lista de verificación de despliegue

**A. Antes de tocar Vercel**
- [ ] Decidir qué pasa con los 8 archivos modificados sin commit; commit propuesto por Claude y confirmado por Víctor; `git push` a `main` (S-25).
- [ ] Confirmar con Víctor la eliminación de `src/app/estado/` (S-03) o moverla detrás de `requerirSeccion("config")`.
- [ ] Agregar `headers()` y `poweredByHeader: false` en `next.config.ts` (primero en modo solo reporte) (S-05).
- [ ] Fijar `cookieOptions` con `secure` y `maxAge` corto (S-10); crear `NEXT_PUBLIC_SITE_URL` y usarla en `origen.ts` (S-12).
- [ ] Crear `error.tsx`, `global-error.tsx`, `robots.ts`, `sitemap.ts` y `metadataBase` (S-09, S-14).
- [ ] Añadir `console.error` con el código en `checkout/actions.ts:170-178` (S-09).
- [ ] Ejecutar `npm run lint`, `npm run typecheck`, `npm run test` (hoy pasan) y **`npm run build`** con el servidor de desarrollo detenido; resolver cualquier error de build (no se ejecutó en esta auditoría).

**B. Supabase (consola)**
- [ ] Pasar el proyecto a Pro; confirmar que los backups diarios están activos y anotar el día de la última copia (S-06).
- [ ] Auth → URL Configuration: «Site URL» de producción y «Redirect URLs» exactas (`/admin/auth/callback`, `/admin/auth/confirmar`) (S-12).
- [ ] Auth → Providers: confirmar que el registro público sigue desactivado (hoy `disable_signup: true`).
- [ ] Auth → Passwords: mínimo 12 caracteres y protección de contraseñas filtradas activada (S-11).
- [ ] Auth → MFA: activar TOTP y registrar el segundo factor del administrador (S-11).
- [ ] Auth → SMTP: configurar un remitente propio y probar el correo de recuperación (S-13).
- [ ] Auth → Rate limits y, si se usa, CAPTCHA (Turnstile) (S-11).
- [ ] API Settings → «Exposed schemas» = solo `public` (S-22).
- [ ] Correr de nuevo `get_advisors` (security y performance) y confirmar que solo quedan las advertencias aceptadas (S-21, S-24).
- [ ] Crear el proyecto/rama de desarrollo separado (S-16).

**C. Datos del negocio (S-01)**
- [ ] Cargar zonas reales, activar municipios y desactivar «prueba Centro».
- [ ] Cancelar `EV-000002` (motivo «prueba»); decidir con Víctor la limpieza de los pedidos y del cliente de prueba.
- [ ] Completar NIT, dirección, horarios, redes, hora de corte, pedido mínimo, regla de mayoreo y al menos un banner.
- [ ] Confirmar el número de WhatsApp del negocio.
- [ ] Revisar los precios y costos cargados (hoy 2.942 de 3.323 presentaciones tienen precio y 1.731 de 1.923 productos están activos; confirmar cuáles quedan sin precio y por tanto sin publicar).
- [ ] Crear el segundo usuario administrador (S-11) y probar un usuario `vendedor` con un sector asignado.

**D. Legal (S-02, S-18)**
- [ ] Texto definitivo de la política de datos, términos y contacto; enlaces en el pie.
- [ ] Guardar la evidencia de aceptación en el pedido (migración propuesta y confirmada).
- [ ] Definir el procedimiento de supresión/anonimización y el plazo de conservación de IP.

**E. Vercel**
- [ ] Equipo con plan Pro; importar el repositorio `victorGutyy/distribuidoraJD`, rama `main` (S-07).
- [ ] Definir las variables de la sección 3 (marcar la `service_role` como Sensitive y solo en Production).
- [ ] Región `gru1`; Node 24.x (S-17, S-25).
- [ ] Agregar el dominio, elegir el canónico y redirigir el otro; verificar HTTPS (candado) y la cabecera HSTS.
- [ ] Firewall: reglas de límite de tasa para el checkout y `/api/sugerencias` (S-08).
- [ ] Proteger los despliegues de vista previa (Deployment Protection) para que no expongan el panel.
- [ ] Activar Observabilidad/Logs y alertas por correo; agregar Sentry o un Log Drain (S-09).

**F. Pruebas en producción (después del primer despliegue)**
- [ ] `/`, `/catalogo`, una ficha de producto y la búsqueda cargan y las fotos se ven.
- [ ] `/estado` responde 404 y `/robots.txt` y `/sitemap.xml` responden 200.
- [ ] `curl -I https://dominio/` muestra CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options` y HSTS; `/admin` no se puede incrustar en un `<iframe>`.
- [ ] Hacer un pedido real de prueba (con un celular del equipo), comprobar que llega al panel, que el mensaje de WhatsApp sale bien y cancelarlo; después limpiar según lo acordado.
- [ ] Login del admin con MFA, recuperación de contraseña por correo, y cierre de sesión.
- [ ] Con la clave pública, confirmar que `pedidos`, `clientes`, `variante_costos` y las vistas `v_*_admin` siguen devolviendo 401 (hoy lo hacen).
- [ ] Revisar los logs de Vercel y de Supabase 24 horas después.

**G. Después del lanzamiento**
- [ ] Una prueba de restauración del backup en un proyecto aparte (una vez al mes).
- [ ] Monitor externo (UptimeRobot) sobre `/` y `/catalogo`.
- [ ] Planificar la mejora de la búsqueda (S-04) y las pruebas E2E (S-15) como primeras tareas de la fase F7.

---

## 5) Lo que está bien

- **RLS en las 18 tablas del esquema `public`**, con políticas separadas por operación y por rol, y las vistas con `security_invoker = true` (7 de 7). Verificado con `pg_class`/`pg_policy` y con las pruebas anónimas por la API: `pedidos`, `clientes`, `perfiles`, `variante_costos`, `pedido_item_costos`, `importaciones` y las vistas `v_ganancia_pedidos`, `v_inventario_admin`, `v_pedidos_admin`, `v_precios_admin` devuelven 401 con la clave pública (RN-14 cumplida). `anon` solo tiene `SELECT` sobre catálogo, zonas y configuración.
- **Los costos y márgenes viven en tablas aparte** (`variante_costos`, `pedido_item_costos`) legibles solo por admin y editor; el vendedor y el público no los ven. El repositorio no contiene costos ni la carpeta `data/precios_ev/` (nunca se subió; verificado en el historial con `git log --all`).
- **Sin secretos en el código ni en el historial:** `.env.local` está ignorado y nunca estuvo versionado; las búsquedas de `service_role`, `eyJ`, `sb_secret_` y `sk_` en todo el historial solo hallan el nombre de la variable en `.env.example` (vacía) y un hash `sha512` de `package-lock.json`. La clave de servicio solo se importa desde código de servidor (`admin.ts` con comprobación de `window`, usado en 3 archivos de servidor y `/estado`).
- **Creación de pedidos blindada:** `crear_pedido` solo la puede ejecutar `service_role` (y revalida el rol dentro de la función), los precios, el envío y la fecha se recalculan en el servidor (RN-06), hay validación con Zod en cliente y servidor, y la pantalla «Pedido recibido» lee de `localStorage`, de modo que el número consecutivo no sirve para espiar pedidos ajenos. El registro público de usuarios está desactivado y los perfiles nuevos nacen inactivos.
- **Autorización por capas en el panel:** el proxy exige sesión, el layout y cada página y Server Action vuelven a comprobar rol y perfil activo (en las 12 archivos de Server Actions del panel, cada función exportada llama a `requerirSeccion`/`requerirRol`, directamente o por un ayudante común en `config/actions.ts`; la ruta de descarga valida sesión y rol), `getUser()` detecta sesiones revocadas, los destinos de redirección están en lista cerrada (`rutaAdminSegura`, `auth/callback`) y el mensaje de error del login es genérico.
- **Storage bien cerrado:** el bucket `catalogo` es público solo para leer; subir, actualizar y borrar exige rol admin o editor; el listado solo lo ve el personal; límite de 2 MB y solo `image/webp`, `jpeg` y `png` (sin SVG). Las imágenes remotas de `next/image` se limitan al host y la ruta de ese bucket.
- **Integridad de datos:** disparadores que impiden borrar pedidos, clientes y productos con pedidos (RN-10), historial automático de estados (RN-09), `search_path` fijo en todas las funciones y funciones `SECURITY DEFINER` con comprobación interna del rol.
- **Calidad del código de base:** `lint` y `typecheck` limpios, `vitest` 344/344 en 30 archivos, TypeScript estricto, la lógica de precios, fechas, permisos e importación con pruebas, y 12 migraciones versionadas aplicadas y consistentes con la base remota.
