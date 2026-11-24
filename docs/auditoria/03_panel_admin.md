# Auditoría 03 — Panel administrativo (`/admin`)

Alcance: `src/app/admin/**` (sin pedidos, zonas ni imprimir), `src/components/admin/**`, `src/lib/{auth,permisos,config-admin,origen}.ts`, `src/lib/{catalogo,importacion,validaciones}/**`, `src/proxy.ts`, y lo que toca el panel en `supabase/migrations`. Solo lectura; no se modificó código ni base de datos.

---

## 1) Resumen

1. **Veredicto: no se puede lanzar hoy tal cual, pero está cerca.** La parte difícil (permisos en servidor, RLS, costos privados) está bien hecha; lo que falta son arreglos pequeños y de "red de seguridad".
2. **Lo que lo impide:** una página de diagnóstico pública (`/estado`) que el propio código dice que se borra antes de publicar (A-01), y dos riesgos de pérdida de datos que un usuario no técnico va a encontrar en la primera semana: perder ediciones de la cuadrícula de precios al paginar (A-02) y que guardar un producto con el formulario viejo borre presentaciones creadas por otra persona (A-03).
3. **Permisos:** todas las Server Actions del área revisada comprueban el rol en el servidor (`requerirRol` / `requerirSeccion`), las funciones SQL lo vuelven a comprobar y los costos están protegidos por RLS. Un editor o vendedor no llega por URL a lo que no debe.
4. **Faltan redes de seguridad para errores humanos:** acciones de gran alcance con un solo clic (desactivar categoría, desactivar 200 productos), sin historial de cambios de precio ni deshacer, y sin protección contra cambios sin guardar en el formulario de producto.
5. **Recomendación:** corregir A-01 a A-05 (unas 6 a 8 horas en total), configurar Supabase Auth y encabezados de seguridad (A-09 a A-11) y lanzar; el resto puede ir en la primera iteración posterior.

Conteo: 1 BLOQUEANTE · 5 ALTA · 13 MEDIA · 10 BAJA = 29 hallazgos.

---

## 2) Hallazgos

### BLOQUEANTE

#### A-01 — Página pública `/estado` de la fase F0 sigue en el código
- **Severidad:** BLOQUEANTE
- **Qué pasa:** existe la ruta pública `/estado` (fuera de `/admin`, así que el proxy no la protege). Sin iniciar sesión, cualquiera ve qué variables de entorno existen, si RLS está bien configurado y cuántos perfiles hay (`La service_role lee perfiles: N`). Además, cada visita ejecuta consultas con la `service_role`. El propio archivo dice "Se elimina antes de publicar".
- **Dónde:** `src/app/estado/page.tsx:7-9` (comentario), `:80-96` (consulta con service_role), `:150` (ruta pública).
- **Por qué importa:** regala a un atacante un mapa de cómo está configurado el sistema y permite que cualquiera dispare consultas privilegiadas a la base de datos de la empresa sin límite.
- **Cómo arreglarlo:** borrar la carpeta `src/app/estado/` (pedir confirmación a Víctor, regla de CLAUDE.md §3.1). Si se quiere conservar una comprobación de salud, ponerla dentro de `/admin` con `requerirRol(["admin"])`.
- **Esfuerzo:** S

---

### ALTA

#### A-02 — La cuadrícula de precios pierde las ediciones al paginar, filtrar o usar el menú
- **Severidad:** ALTA
- **Qué pasa:** el aviso de "cambios sin guardar" solo usa `beforeunload` (cerrar o recargar la pestaña). Pasar a la página siguiente, aplicar un filtro, entrar a otra sección del menú o el botón "atrás" son navegaciones internas de Next y **no** disparan `beforeunload`: las filas editadas se descartan en silencio. El comentario del código afirma lo contrario ("el navegador avisa antes"). Además la tabla se reinicia por `key` al cambiar de página.
- **Dónde:** `src/components/admin/CuadriculaPrecios.tsx:68-75` (solo `beforeunload`), `src/app/admin/(panel)/precios/page.tsx:116-121` (comentario falso y `key`), `src/components/admin/Paginacion.tsx` (enlaces normales).
- **Por qué importa:** con 66 páginas de 50 filas, quien carga precios a mano teclea 30 filas, pulsa "Siguiente" y las pierde sin aviso. Es la pantalla que más se usará los primeros días.
- **Cómo arreglarlo:** (a) lo mínimo: antes de cambiar de página, si hay filas modificadas, mostrar confirmación; (b) mejor: guardar automáticamente las filas válidas al pulsar "Siguiente/Anterior" o hacer que la barra inferior ofrezca "Guardar y seguir"; (c) corregir el comentario. Mientras tanto, subir `POR_PAGINA_PRECIOS` a 100 (el tope de `MAX_FILAS` ya es 100).
- **Esfuerzo:** M

#### A-03 — Guardar el formulario de producto borra presentaciones nuevas y pisa precios hechos por otra persona
- **Severidad:** ALTA
- **Qué pasa:** `guardar_producto` trata el formulario como la verdad completa: actualiza todas las presentaciones con lo que trae y **borra** las que no vienen en la lista. No hay control de versión (no se envía `updated_at`). Si una persona abre el producto, y mientras tanto otra importa una presentación nueva, cambia un precio en la cuadrícula o duplica algo, al guardar el primero: (1) se elimina la presentación nueva (si no tiene pedidos) y (2) los precios vuelven a los valores viejos del formulario.
- **Dónde:** `supabase/migrations/0005_productos_admin.sql:245-256` (borrado de "las que ya no vienen"), `:206-226` (UPDATE de precios con lo del formulario); `src/lib/catalogo/producto-form.ts` (el payload no lleva versión); `src/app/admin/(panel)/productos/[id]/page.tsx:132` (la `key` solo mira `producto.updated_at`, que no cambia cuando se editan precios).
- **Por qué importa:** pérdida silenciosa de datos y de precios en una tienda con varias personas editando (admin + editor + importaciones masivas). Nadie se entera hasta que un cliente ve un precio equivocado.
- **Cómo arreglarlo:** enviar un `version` (el `updated_at` mayor del producto y sus variantes) en el formulario; en `guardar_producto`, si no coincide, lanzar `P0002` con "Alguien más cambió este producto. Recarga la página". Alternativa mínima: no borrar presentaciones ausentes salvo que el formulario las haya quitado explícitamente (enviar lista `quitar_ids`).
- **Esfuerzo:** M

#### A-04 — Acciones de gran alcance con un solo clic y sin confirmar
- **Severidad:** ALTA
- **Qué pasa:** "Desactivar" una categoría oculta de la tienda todos sus productos y subcategorías con un clic, sin diálogo ni cantidad afectada. En la lista de productos, "Desactivar" y "Mover" aplican a hasta 200 productos seleccionados sin confirmar ni mostrar cuántos. En cambio "Eliminar" sí pide confirmación: la protección está en el lugar equivocado (lo borrable está protegido por llaves foráneas; lo que oculta medio catálogo, no). "Duplicar" tampoco confirma.
- **Dónde:** `src/components/admin/FilaCategoria.tsx:90-95` (formulario directo a `alternarCategoria`), `src/components/admin/AccionesMasivas.tsx:62-93` (botones Activar/Desactivar/Mover directos), `src/app/admin/(panel)/productos/actions.ts:147` (hasta 200 ids).
- **Por qué importa:** un toque equivocado desde el celular deja la tienda sin "Víveres" (cientos de productos) hasta que alguien lo note; no hay deshacer ni historial.
- **Cómo arreglarlo:** reutilizar `BotonEliminar` (AlertDialog) como `BotonConfirmar`: "¿Desactivar «Aseo»? Se ocultarán N productos de la tienda". En masivas, confirmar con el número exacto ("Vas a desactivar 37 productos"). Contar productos afectados con una consulta `count` antes de abrir el diálogo.
- **Esfuerzo:** M

#### A-05 — Cargas de precios sin red de seguridad (importación y cuadrícula)
- **Severidad:** ALTA
- **Qué pasa:** (1) La importación en modo "solo precios" puede sobrescribir hasta 3.300 precios y no ofrece respaldo previo, ni alerta de variaciones grandes (p. ej. precios que cambian más de 40 %, o que quedan bajo el costo), ni forma de revertir; la vista previa es una tabla de miles de filas. (2) En la cuadrícula, vaciar una celda de precio **borra el precio** y por tanto oculta el producto de la tienda, sin ninguna advertencia (el comentario lo documenta como intencional). (3) No hay validación de "sentido común" (3200 → 320 pasa sin avisar).
- **Dónde:** `src/components/admin/importar/Importador.tsx` (flujo sin resumen de riesgo ni respaldo), `src/components/admin/importar/useImportacion.ts:132-176`, `src/lib/validaciones/precios.ts:11` y `src/components/admin/CuadriculaPrecios.tsx:128-150`.
- **Por qué importa:** un Excel mal armado (columnas corridas, miles con coma) cambia todos los precios de la tienda en minutos, y los pedidos entran con precios errados antes de que alguien lo vea.
- **Cómo arreglarlo:** en la vista previa de precios, mostrar un resumen "N precios suben, M bajan, K cambian más de 40 %, J quedan bajo el costo" y exigir marcar "Descargué una copia" (enlace a *Precios actuales*); en la cuadrícula, marcar la fila en rojo/ámbar cuando el precio se vacía ("Quedará sin precio y se ocultará") o cambia más de 50 %.
- **Esfuerzo:** M

#### A-06 — Sin pantalla de error ni de "no encontrado" en el panel
- **Severidad:** ALTA
- **Qué pasa:** no existe ningún `error.tsx`, `global-error.tsx` ni `not-found.tsx` bajo `src/app/admin` (solo hay uno en `(tienda)`). Si Supabase falla o una consulta lanza una excepción, la persona ve la pantalla genérica de Next, en inglés y sin menú; `notFound()` (producto inexistente) y rutas como `/admin/xyz` muestran el 404 genérico fuera del panel.
- **Dónde:** ausencia de archivos en `src/app/admin/`; `src/app/admin/(panel)/productos/[id]/page.tsx:49,81` usan `notFound()`.
- **Por qué importa:** usuarios no técnicos se quedan "sin saber qué hacer" ante un fallo momentáneo y llaman al desarrollador; en producción un error de red es normal.
- **Cómo arreglarlo:** agregar `src/app/admin/(panel)/error.tsx` (cliente, con botón "Reintentar" y enlace a Inicio, texto en español) y `src/app/admin/not-found.tsx` con el mismo marco. Verificar con la guía local de Next 16 (`node_modules/next/dist/docs/`) el patrón con `cacheComponents`.
- **Esfuerzo:** S

---

### MEDIA

#### A-07 — Enlaces de acceso de un solo uso se gastan con solo "visitarlos" (GET con efecto)
- **Severidad:** MEDIA
- **Qué pasa:** el enlace que el admin copia y envía (por WhatsApp, según el propio texto) consume el token en una petición `GET` (`verifyOtp`). WhatsApp, correo y antivirus generan vistas previas con un GET al enlace; si lo hacen antes que la persona, ella verá "Ese enlace ya no sirve". Además, si el admin abre el enlace en su propio navegador para probarlo, queda con la sesión del usuario nuevo en lugar de la suya.
- **Dónde:** `src/app/admin/auth/confirmar/route.ts:13-22`; texto de entrega en `src/components/admin/usuarios/EnlaceAcceso.tsx:36-40`.
- **Por qué importa:** una persona nueva no puede entrar el primer día y el admin pierde tiempo generando enlaces.
- **Cómo arreglarlo:** hacer que el enlace abra una página intermedia con un botón "Crear mi contraseña" (el `verifyOtp` ocurre en una Server Action `POST`, no en el GET). Añadir al texto "No lo abras tú: reenvíaselo".
- **Esfuerzo:** M

#### A-08 — La recuperación por correo falla si se abre en otro dispositivo, con un mensaje engañoso
- **Severidad:** MEDIA
- **Qué pasa:** `resetPasswordForEmail` usa PKCE: el código solo se canjea en el mismo navegador que lo pidió. Una persona que lo solicita en el computador y abre el correo en el celular (muy común) recibe "Ese enlace ya no sirve (venció o ya se usó)". El propio código lo reconoce en un comentario. Si es el único admin, queda bloqueado hasta que alguien entre a Supabase.
- **Dónde:** `src/app/admin/auth/callback/route.ts:3-20`, `src/app/admin/auth/confirmar/route.ts:3-12` (comentario), `src/components/admin/FormularioLogin.tsx:21-24` (mensaje).
- **Por qué importa:** bloqueo de cuentas y llamadas de soporte; para la cuenta admin única, riesgo operativo real.
- **Cómo arreglarlo:** (a) en el mensaje, decir "Ábrelo en el mismo dispositivo y navegador donde lo pediste"; (b) mejor, usar el flujo de `token_hash` (el mismo de `/admin/auth/confirmar`) también para el correo, configurando la plantilla de correo de Supabase; (c) tener al menos dos administradores.
- **Esfuerzo:** M

#### A-09 — Sin encabezados de seguridad en el panel (clickjacking)
- **Severidad:** MEDIA
- **Qué pasa:** `next.config.ts` y el proyecto no definen `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy` ni CSP. Nadie impide que otra página incruste `/admin` en un `<iframe>` invisible y engañe a un usuario con sesión para pulsar botones (desactivar, eliminar).
- **Dónde:** `next.config.ts:10-34` (no hay `headers()`); no existe `vercel.json`.
- **Por qué importa:** con sesión abierta, un enlace malicioso puede inducir acciones destructivas por clic.
- **Cómo arreglarlo:** añadir `async headers()` en `next.config.ts` para `/admin/:path*` con `X-Frame-Options: DENY` (o `Content-Security-Policy: frame-ancestors 'none'`), `X-Content-Type-Options: nosniff` y `Referrer-Policy: strict-origin-when-cross-origin`.
- **Esfuerzo:** S

#### A-10 — Cookies de sesión legibles por JavaScript, sin `Secure` y de 400 días
- **Severidad:** MEDIA
- **Qué pasa:** el cliente de Supabase usa las opciones por defecto (`httpOnly: false`, sin `secure`, `maxAge` de 400 días); el proyecto no las sobrescribe. `httpOnly:false` es necesario porque el navegador sube imágenes con la sesión, pero entonces cualquier XSS futuro roba la sesión de un admin, y la cookie no exige HTTPS.
- **Dónde:** `node_modules/@supabase/ssr/dist/main/utils/constants.js:4-11` (valores por defecto), `src/lib/supabase/server.ts:22-27` y `src/lib/supabase/proxy.ts:26-34` (pasan las opciones sin cambios); no existe `cookieOptions` en `src/`.
- **Por qué importa:** el panel maneja costos y usuarios; el robo de una sesión de admin es el peor escenario.
- **Cómo arreglarlo:** pasar `cookieOptions: { secure: process.env.NODE_ENV === "production", sameSite: "lax" }` en los tres `createServerClient`/`createBrowserClient`; reducir `maxAge`; y confirmar en Supabase (Auth → Sessions) "Time-box" y "Inactivity timeout" (p. ej. 7 días / 8 h).
- **Esfuerzo:** S

#### A-11 — Configuración de Supabase Auth necesaria para producción y no versionada
- **Severidad:** MEDIA
- **Qué pasa:** el código depende de ajustes que no están en el repositorio (no hay `supabase/config.toml`): lista de *Redirect URLs* con el dominio de producción, vencimiento del enlace (OTP), límite de correos (el SMTP por defecto de Supabase envía muy pocos al día), protección contra contraseñas filtradas, duración de sesión. La política de contraseñas del propio panel es solo "8 a 72 caracteres".
- **Dónde:** `src/lib/validaciones/auth.ts:14-17`; `src/app/admin/(auth)/actions.ts:82-85` (`redirectTo`); `src/app/admin/(auth)/actions.ts:93-96` (maneja `over_email_send_rate_limit`, lo que confirma que ya se topó con el límite).
- **Por qué importa:** si el dominio de producción no está permitido, la recuperación de contraseña falla el día del lanzamiento; con el SMTP por defecto los correos no llegan.
- **Cómo arreglarlo:** checklist previo al lanzamiento: agregar `https://<dominio>/admin/auth/callback` en Redirect URLs, configurar SMTP propio, activar "leaked password protection", fijar Site URL y vencimiento de OTP (3600 s), y documentarlo en `docs/`.
- **Esfuerzo:** S

#### A-12 — El formulario de producto no protege los cambios sin guardar
- **Severidad:** MEDIA
- **Qué pasa:** `FormularioProducto` no usa `isDirty`, `beforeunload` ni bloqueo de navegación; "Cancelar", el menú o el botón "atrás" descartan todo lo escrito (hasta 30 presentaciones con muchos campos). Además "Quitar" presentación solo la saca de la pantalla hasta guardar, sin avisar de que al guardar se borra.
- **Dónde:** `src/components/admin/FormularioProducto.tsx:78-101` (sin `isDirty`), `:273-278` (Cancelar es un enlace directo); solo existen guardas `beforeunload` en la cuadrícula y las fotos en lote (`grep beforeunload`).
- **Por qué importa:** perder 10 minutos de captura por un toque accidental en el celular.
- **Cómo arreglarlo:** `useEffect` con `beforeunload` cuando `formState.isDirty`, y confirmar en "Cancelar" si hay cambios. Mostrar en "Quitar" un texto "Se eliminará al guardar".
- **Esfuerzo:** S

#### A-13 — "Duplicar" puede crear copias dobles y da un error engañoso
- **Severidad:** MEDIA
- **Qué pasa:** "Duplicar" es un formulario directo a una Server Action, sin estado de espera ni confirmación; un doble toque (común en celular o con conexión lenta) crea dos copias "(copia)". Si el producto no tiene presentaciones, redirige con `error=permiso` ("No tienes permiso…"), un mensaje falso.
- **Dónde:** `src/components/admin/TablaProductos.tsx:249-262`, `src/app/admin/(panel)/productos/[id]/page.tsx:104-112`, `src/app/admin/(panel)/productos/actions.ts:107-119`.
- **Por qué importa:** catálogo con basura duplicada (inactiva, pero ensucia listas) y soporte confundido por el mensaje.
- **Cómo arreglarlo:** botón cliente con `useFormStatus` (deshabilitar al enviar) y código de error propio (`sin-presentaciones`).
- **Esfuerzo:** S

#### A-14 — No hay historial de quién cambió precios, productos o usuarios
- **Severidad:** MEDIA
- **Qué pasa:** solo hay trazabilidad en pedidos (`pedido_historial`), importaciones (cuyos conteos los envía el propio navegador) y `configuracion.updated_by`. Los cambios de precio, activar/desactivar, categorías y generación de enlaces de acceso (se puede generar uno para **cualquier** usuario, incluidos otros admins) no dejan registro de quién ni cuándo.
- **Dónde:** `supabase/migrations/0001_init.sql` (tablas sin auditoría; solo `configuracion.updated_by` en `:389`); `src/app/admin/(panel)/usuarios/actions.ts:92-102` (`generarEnlaceUsuario` sin registro); `src/components/admin/importar/useImportacion.ts:166-179` (cifras enviadas por el cliente).
- **Por qué importa:** cuando un precio aparezca mal, no se podrá saber quién ni qué valor tenía antes; tampoco quién entregó acceso a una cuenta.
- **Cómo arreglarlo:** tabla `auditoria(usuario_id, tabla, registro_id, antes, despues, created_at)` con un disparador sobre `variantes` (precios), `productos`, `categorias`; registrar `generarEnlace` y cambios de rol. Mover el conteo de `cerrarImportacion` al servidor.
- **Esfuerzo:** L

#### A-15 — El inventario no se puede editar a mano (RF-32) y su texto es inexacto
- **Severidad:** MEDIA
- **Qué pasa:** RF-32 dice que el stock se actualiza "al importar o al editarlo a mano". La pantalla `/admin/inventario` es de solo lectura y la cuadrícula de precios no tiene columna de existencias; la única vía es subir un Excel. Además el texto dice que "solo los ve la administración" cuando también lo ve el rol editor.
- **Dónde:** `src/components/admin/inventario/TablaInventario.tsx:32` (solo lectura), `src/app/admin/(panel)/inventario/page.tsx:93-95` (texto), `docs/01_REQUERIMIENTOS.md` RF-32.
- **Por qué importa:** para corregir un stock hay que armar un archivo; el requerimiento queda incumplido.
- **Cómo arreglarlo:** campo "Existencias" editable por fila (usa `guardar_costos`, que ya acepta `stock`) o, como mínimo, ajustar el RF y el texto ("administradores y editores").
- **Esfuerzo:** M

#### A-16 — Buscadores incoherentes entre Productos y Precios
- **Severidad:** MEDIA
- **Qué pasa:** en Precios e Inventario cada palabra se busca por separado ("arroz diana" encuentra "Arroz Premium Diana"); en Productos se busca la frase completa, así que la misma búsqueda no devuelve resultados.
- **Dónde:** `src/app/admin/(panel)/productos/page.tsx:58-64` frente a `src/app/admin/(panel)/precios/page.tsx:49-52` e `inventario/page.tsx:51-54`.
- **Por qué importa:** la gente concluye "el producto no existe" y lo crea de nuevo (duplicados).
- **Cómo arreglarlo:** copiar el bucle por palabras de Precios a Productos (o extraer un helper `aplicarBusqueda(consulta, q)` en `filtros-productos.ts`).
- **Esfuerzo:** S

#### A-17 — Confirmación de guardado en Configuración puede quedar fuera de la vista
- **Severidad:** MEDIA
- **Qué pasa:** las cuatro tarjetas de Configuración muestran errores dentro de la tarjeta, pero el éxito solo aparece arriba de la página tras redirigir. Quien guarda "Datos de la empresa" (última tarjeta) puede no ver el aviso. Además el número de WhatsApp (donde llegan los pedidos) se cambia sin confirmación ni prueba.
- **Dónde:** `src/components/admin/config/FormulariosConfig.tsx:42` (solo `estado.error`), `src/app/admin/(panel)/config/page.tsx:45` (aviso arriba), `src/app/admin/(panel)/config/actions.ts:51` (`redirect`).
- **Por qué importa:** la persona repite el guardado sin saber si funcionó y un error de dígito en el WhatsApp envía los pedidos a un número ajeno.
- **Cómo arreglarlo:** devolver `mensaje` en lugar de redirigir y mostrarlo dentro de cada tarjeta; junto al campo de WhatsApp, mostrar un enlace "Probar" (`wa.me/57…`).
- **Esfuerzo:** S

#### A-18 — Los enlaces de correo se arman con cabeceras de la petición
- **Severidad:** MEDIA
- **Qué pasa:** `obtenerOrigen()` toma la URL base de las cabeceras `origin`/`host`/`x-forwarded-*` para el enlace de recuperación y el enlace que se entrega a un nuevo usuario. Hoy lo protege la lista de Redirect URLs de Supabase (A-11), pero si esa lista se configura con comodín el correo podría apuntar a otro dominio.
- **Dónde:** `src/lib/origen.ts:5-11`, `src/app/admin/(auth)/actions.ts:79-85`, `src/app/admin/(panel)/usuarios/actions.ts:30-31`.
- **Por qué importa:** defensa en profundidad contra envenenamiento del enlace de restablecimiento.
- **Cómo arreglarlo:** leer una variable fija `NEXT_PUBLIC_SITE_URL` (con la cabecera solo como respaldo en desarrollo).
- **Esfuerzo:** S

#### A-19 — Sin "Mi cuenta": nadie puede cambiar su contraseña desde el panel
- **Severidad:** MEDIA
- **Qué pasa:** no hay una pantalla para cambiar la contraseña ni el nombre propio (el admin solo puede cambiar nombre vía Usuarios). La única vía es "Olvidé mi contraseña" o que el admin genere un enlace. No hay enlace "Ver tienda" en el menú. Cerrar sesión cierra **todas** las sesiones del usuario (alcance global por defecto).
- **Dónde:** `src/components/admin/BarraAdmin.tsx:136-146` (solo nombre, rol y cerrar sesión), `src/app/admin/actions.ts:9` (`signOut()` sin `scope`).
- **Por qué importa:** una contraseña que le pasaron por WhatsApp queda como definitiva; si se filtra, no hay forma sencilla de cambiarla; salir en el celular cierra también el computador.
- **Cómo arreglarlo:** página `/admin/cuenta` (nombre y contraseña nueva reutilizando `restablecerContrasena` con la contraseña actual) y `signOut({ scope: "local" })`.
- **Esfuerzo:** M

---

### BAJA

#### A-20 — Restos de desarrollo en el panel: "Próximamente", "Pronto" y fases
- **Severidad:** BAJA
- **Qué pasa:** el inicio y el menú tienen código para secciones "Próximamente/Pronto" con "Fase F6" que hoy nunca se muestra (todas están disponibles), y `permisos.ts` conserva campos `disponible` y `fase`. Si alguien pone `disponible: false`, el cliente vería "Fase RF-32".
- **Dónde:** `src/app/admin/(panel)/page.tsx:97,205-224`, `src/components/admin/BarraAdmin.tsx:106-126`, `src/lib/permisos.ts:41-45` y cada sección.
- **Por qué importa:** ruido y riesgo de mostrar jerga interna al personal.
- **Cómo arreglarlo:** eliminar la rama `disponible`, la tarjeta "Próximamente" y los campos `fase`.
- **Esfuerzo:** S

#### A-21 — Los botones "Eliminar" y "Desactivar" no se distinguen de las acciones normales
- **Severidad:** BAJA
- **Qué pasa:** en listas (categorías, marcas, banners, imágenes) "Eliminar" tiene el mismo estilo `outline` que "Editar"; solo el botón final del diálogo es rojo. No hay un criterio único: primario azul, secundario outline, destructivo rojo.
- **Dónde:** `src/components/admin/BotonEliminar.tsx:45-52`, `src/components/admin/FilaMarca.tsx:36-48`, `FilaCategoria.tsx:98-110`.
- **Por qué importa:** consistencia visual y menos toques erróneos.
- **Cómo arreglarlo:** darle al disparador `text-destructive` / `variant="outline"` con borde rojo.
- **Esfuerzo:** S

#### A-22 — `marcarImagenPrincipal` no es atómica
- **Severidad:** BAJA
- **Qué pasa:** primero quita la principal y luego asigna la nueva en dos llamadas; si la segunda falla, el producto queda sin imagen principal. Igual con mover (varias actualizaciones sueltas).
- **Dónde:** `src/app/admin/(panel)/productos/imagenes-actions.ts:137-147`, `:174-186`.
- **Por qué importa:** producto con foto principal ausente en la tienda tras un error de red.
- **Cómo arreglarlo:** una función SQL que haga el cambio en una transacción.
- **Esfuerzo:** S

#### A-23 — Campos opcionales marcados como `required` para lectores de pantalla
- **Severidad:** BAJA
- **Qué pasa:** el componente `Campo` siempre pone `required`, incluso en campos "(opcional)" como NIT, dirección o redes (el formulario usa `noValidate`, por eso no bloquea, pero el lector de pantalla dice "obligatorio").
- **Dónde:** `src/components/admin/Campo.tsx:56`, usado en `FormulariosConfig.tsx:121-128`.
- **Por qué importa:** accesibilidad (WCAG) y mensajes contradictorios.
- **Cómo arreglarlo:** prop `requerido` (por defecto `true`) y pasar `false` en los opcionales.
- **Esfuerzo:** S

#### A-24 — Mensajes de Zod sin traducción global
- **Severidad:** BAJA
- **Qué pasa:** el proyecto escribe los mensajes a mano, pero no configura el idioma de Zod (`z.config`); cualquier regla sin mensaje propio (p. ej. un tipo inesperado) saldría en inglés.
- **Dónde:** ausencia de `z.config` en `src/` (búsqueda negativa); esquemas en `src/lib/validaciones/*.ts`.
- **Por qué importa:** coherencia de idioma en errores raros.
- **Cómo arreglarlo:** `z.config(z.locales.es())` en un módulo común importado por las acciones.
- **Esfuerzo:** S

#### A-25 — Los avisos `?ok=` se repiten al recargar o volver atrás
- **Severidad:** BAJA
- **Qué pasa:** el mensaje de éxito vive en la URL (`?ok=producto-guardado`), así que reaparece al recargar y al volver desde otra pantalla.
- **Dónde:** `src/lib/avisos.ts`, `src/components/admin/AvisoPagina.tsx:7-13`.
- **Por qué importa:** confunde ("¿otra vez lo guardé?"). Menor.
- **Cómo arreglarlo:** limpiar el parámetro con `router.replace` tras mostrarlo (componente cliente pequeño).
- **Esfuerzo:** S

#### A-26 — Importación: historial corto y acciones masivas de RF-24 incompletas
- **Severidad:** BAJA
- **Qué pasa:** (a) el historial de importaciones muestra solo las últimas 8 y sin detalle de errores; (b) RF-24 pide "marcar oferta" en acciones masivas y fecha en el listado, y RF-22 pide arrastrar y soltar el orden (hay flechas); ninguno está.
- **Dónde:** `src/app/admin/(panel)/importar/page.tsx:40`, `src/components/admin/AccionesMasivas.tsx`, `docs/01_REQUERIMIENTOS.md` RF-22, RF-24.
- **Por qué importa:** brechas menores contra el documento de requerimientos.
- **Cómo arreglarlo:** paginar el historial con enlace "ver errores"; documentar las diferencias o agregarlas en la fase 2.
- **Esfuerzo:** M

#### A-27 — Fotos en lote: "No omitir" duplica fotos y la consulta de SKU lee todo el catálogo
- **Severidad:** BAJA
- **Qué pasa:** desmarcar "Omitir los productos que ya tienen foto" vuelve a subir y suma (no reemplaza). `consultarProductosPorSku` lee todas las presentaciones y todas las imágenes del catálogo en cada selección (4 a 20 consultas de 1.000 filas).
- **Dónde:** `src/components/admin/importar/SubidorFotosLote.tsx:170-177`, `src/app/admin/(panel)/importar/fotos-actions.ts:29-58`.
- **Por qué importa:** fotos repetidas hasta el máximo de 10 y consultas innecesarias; funciona con el volumen actual.
- **Cómo arreglarlo:** filtrar con `.in("sku", …)` por tandas y mostrar aviso "se agregarán a las existentes".
- **Esfuerzo:** M

#### A-28 — Exportación sin protección contra fórmulas de Excel
- **Severidad:** BAJA
- **Qué pasa:** los nombres de producto y marcas se escriben tal cual en el Excel/CSV; un texto que empiece con `=`, `+`, `-` o `@` se interpreta como fórmula al abrirlo.
- **Dónde:** `src/lib/importacion/exportar.ts` (sin saneamiento), `src/app/admin/(panel)/importar/descargar/route.ts:85-107`.
- **Por qué importa:** riesgo bajo (datos propios), pero se evita con una línea.
- **Cómo arreglarlo:** anteponer `'` a textos que empiecen por esos caracteres.
- **Esfuerzo:** S

#### A-29 — Móvil: tablas anchas y menú sin teclado
- **Severidad:** BAJA
- **Qué pasa:** inventario (`min-w-[56rem]`), lista de productos (`min-w-[40rem]`, oculta categoría) y vista previa de importación obligan a desplazar de lado, sin pista visual; el menú móvil empuja el contenido hacia abajo (no es un panel superpuesto), no se cierra con Escape y no devuelve el foco al botón. La cuadrícula de precios sí se adapta bien (tarjetas en móvil).
- **Dónde:** `src/components/admin/inventario/TablaInventario.tsx:34`, `src/components/admin/TablaProductos.tsx:109`, `src/components/admin/BarraAdmin.tsx:57-100`.
- **Por qué importa:** uso desde celular por vendedores y bodega.
- **Cómo arreglarlo:** sombra/degradado en el borde del contenedor desplazable, convertir filas de inventario a tarjetas en < 640 px, cerrar el menú con Escape.
- **Esfuerzo:** M

---

## 3) Lo que está bien

- **Autorización en el servidor, completa y por capas:** cada Server Action (categorías, marcas, banners, config, usuarios, productos, imágenes, precios, importar, fotos) llama a `requerirRol`/`requerirSeccion`; el handler de descargas bloquea al vendedor; las funciones SQL (`guardar_producto`, `guardar_precios`, `guardar_costos`, `importar_catalogo`, `resumen_costos`) vuelven a validar el rol y revocan `anon`/`public`.
- **Costos privados bien aislados (RF-32/RN-14):** `variante_costos` y `pedido_item_costos` con RLS solo admin/editor, vistas `security_invoker`, la exportación de catálogo no incluye costos, y las listas de proveedores están en `.gitignore`.
- **Sesión y redirecciones sólidas:** el proxy valida la firma con `getClaims`, `getUser()` en servidor detecta sesiones revocadas, un usuario desactivado queda fuera en la siguiente petición, y `rutaAdminSegura` evita redirecciones abiertas.
- **Integridad de datos del catálogo:** no se borran pedidos ni productos con pedidos, categorías y marcas con uso solo se desactivan, la última cuenta admin no se puede degradar, y el producto indica con claridad por qué no es visible (RN-01).
- **Rendimiento adecuado para 1.900 productos / 3.300 presentaciones:** paginación en servidor (25 y 50 por página), filtros en la URL, importación y exportación por lotes (300–500 filas, 1.000 por consulta), vista previa por tandas, y subida de fotos con compresión en el navegador y concurrencia limitada.
- **Importación con vista previa y reglas "una celda vacía no borra":** valida en navegador y de nuevo en servidor, agrupa productos sin partirlos entre lotes, avisa SKU repetidos y queda registrada en `importaciones`.
- **Formularios accesibles en lo esencial:** etiquetas asociadas, `aria-invalid`/`aria-describedby`, áreas táctiles de 44 px, `role="alert"` en errores, tabla con `caption` y `scope`, avisos en español claro y sin texto libre en la URL (códigos de aviso).
- **Cuadrícula de precios pensada para el trabajo real:** filas modificadas resaltadas, Enter baja a la fila siguiente, ganancia y margen en vivo con alerta bajo el costo, barra de guardado fija y guardado parcial con errores por fila.
