# Auditoría 01: Tienda pública (EV Distribuidora)

Fecha: 24 de noviembre de 2026 · Alcance: lo que ve el cliente (`src/app/(tienda)/**`, `src/components/tienda/**`, `src/lib/tienda/**`, `src/app/api/sugerencias`, layout raíz, metadatos, 404, páginas legales, `/estado`). Revisión solo de lectura: no se modificó código.

**Cómo se verificó:** lectura del código real (archivo:línea), lectura de las guías locales de Next 16 (`node_modules/next/dist/docs`) y de la fuente de Next para metadatos, y consultas de **solo lectura** a la API pública de Supabase (con la clave pública, la misma que usa el navegador) para ver el estado real de los datos y medir tiempos. **No** se ejecutó `next build`, ni Lighthouse, ni un navegador, ni un pedido real; los contrastes se calcularon a mano. Lo que no pude confirmar está marcado como tal.

---

## 1) Resumen

1. **Veredicto: hoy NO se puede lanzar.** El código de la tienda está bastante sólido, pero hay tres bloqueos: la política de datos aún dice "Texto provisional" (T-01), la única zona de entrega activa es un sector de prueba "prueba Centro" con envío de $ 3.000 (T-02) y sigue publicada la página de diagnóstico `/estado` (T-03).
2. Además faltan cosas que un lanzamiento serio necesita: `sitemap.xml` y `robots.txt` (T-08), datos de la empresa (dirección, horarios, NIT) y dirección de la bodega (T-04), hora de corte y festivos (T-05), y enlaces legales en el pie (T-09).
3. El rendimiento en frío es el mayor riesgo técnico: medí 1,5 a 3,6 s por consulta a Supabase y la caché es de solo 30 a 120 s (T-06). Una falla de la base se guarda en caché como "catálogo vacío" y no hay `error.tsx` (T-07).
4. Hay 14 ajustes de severidad media (404, compartir en WhatsApp, botones de 36 px en el carrito, contraste del rojo, accesibilidad de tarjetas) que conviene hacer antes o justo después del lanzamiento.
5. Esfuerzo estimado para quedar listo: los 3 bloqueantes son S o M en lo técnico (lo demás es dato y texto legal del dueño); las 6 altas suman aproximadamente un día de trabajo.

**Conteo:** 3 BLOQUEANTES · 6 ALTAS · 14 MEDIAS · 9 BAJAS = 32 hallazgos.

---

## 2) Hallazgos

### BLOQUEANTES

**T-01. La política de datos es un texto provisional y se muestra así al público**
- **Severidad:** BLOQUEANTE
- **Qué pasa:** La página `/politica-de-datos` muestra un aviso visible: "Texto provisional: pendiente de revisión legal antes de abrir la tienda al público". Solo tiene 3 párrafos y no identifica al responsable del tratamiento (razón social, NIT, domicilio, correo o teléfono de contacto), ni el procedimiento para ejercer derechos (consultas y reclamos), ni plazos ni vigencia. El checkout obliga a aceptarla (Ley 1581 de 2012).
- **Dónde:** `src/app/(tienda)/politica-de-datos/page.tsx:7-10` (comentario "TEXTO PROVISIONAL"), `:15-17` (aviso visible), `:19-29` (texto). Aceptación en `src/components/tienda/checkout/FormularioCheckout.tsx:202-208`.
- **Por qué importa:** Se le pide al cliente aceptar una política que dice de sí misma que no está terminada. Es un riesgo legal (RNF-09) y de confianza, y puede acarrear sanciones de la SIC por tratar datos sin una política completa.
- **Cómo arreglarlo:** Que el dueño o su asesor legal entreguen el texto final con los datos del responsable (los mismos de `configuracion.empresa`: nombre, NIT, dirección, correo/WhatsApp), finalidades, derechos del titular y canal para ejercerlos. Reemplazar el texto, quitar el recuadro "Texto provisional" y el comentario. Idealmente leer razón social y NIT de la configuración para no duplicarlos.
- **Esfuerzo:** M (el trabajo de código es S; lo demorado es el texto legal).

**T-02. La única zona de entrega activa es un sector de prueba**
- **Severidad:** BLOQUEANTE
- **Qué pasa:** Consulté hoy los datos públicos: hay 1 municipio activo (Calarcá) y 1 sector activo llamado **"prueba Centro"** (reparto jueves y viernes, envío $ 3.000). Los otros 11 municipios están inactivos. Un cliente real solo puede elegir ese sector de prueba o "Recogeré en bodega". (Dato leído en vivo; coincide con lo anotado en la memoria del proyecto.)
- **Dónde:** Datos en Supabase (tablas `municipios` y `sectores`); se muestran en `src/components/tienda/carrito/SelectorUbicacion.tsx:17-99` y `src/lib/tienda/datos.ts:36-68`.
- **Por qué importa:** Los pedidos saldrían con un destino y un costo de envío falsos, y fechas de entrega prometidas según un sector inexistente. El negocio no podría atender esos pedidos.
- **Cómo arreglarlo:** En `/admin/zonas`, crear los municipios y sectores reales con sus días de reparto y costos, activar solo los que se atienden y **desactivar "prueba Centro"**. No requiere código.
- **Esfuerzo:** M (depende de que el dueño defina zonas, días y costos).

**T-03. La página de diagnóstico `/estado` está publicada y llama a la base con la service_role**
- **Severidad:** BLOQUEANTE
- **Qué pasa:** `src/app/estado/page.tsx` es una página temporal de la fase F0 ("Se elimina antes de publicar", línea 8). No está protegida: el `proxy.ts` solo cubre `/admin/*` (`src/proxy.ts:37-39`). Cualquiera puede abrirla; en cada visita hace 4 llamadas a Supabase, una de ellas con `createAdminClient()` (service_role, `:82`), y muestra qué variables de entorno existen, cuántas claves de configuración hay y cuántos perfiles de personal hay. No imprime claves, pero es información interna y un punto de abuso (cada visita cuesta consultas a la base).
- **Dónde:** `src/app/estado/page.tsx:1-165` (`:8` aviso de borrado, `:82` service_role).
- **Por qué importa:** Revela la estructura interna a extraños y permite generar carga gratuita sobre la base y la service_role. Es contrario a la regla de CLAUDE.md sobre mantener la service_role fuera del alcance público.
- **Cómo arreglarlo:** Eliminar la carpeta `src/app/estado/` (requiere tu confirmación, regla 1 de CLAUDE.md). Si se quiere conservar para el equipo, moverla bajo `/admin` detrás del rol admin.
- **Esfuerzo:** S.

### ALTAS

**T-04. Datos de la empresa vacíos y la bodega no tiene dirección publicada**
- **Severidad:** ALTA
- **Qué pasa:** En la base, `empresa.direccion`, `empresa.horarios` y `empresa.nit` son `null` y `redes` está vacío (verificado hoy). El pie de página (RF-01) solo mostraría el WhatsApp, y en texto plano sin enlace: `+57…` sin formato y sin ser un enlace. Además el checkout ofrece "Recogeré en bodega" y la pantalla de confirmación dice "Puedes recogerlo el…", pero **en ningún lugar se dice dónde queda la bodega ni su horario**.
- **Dónde:** `src/components/tienda/PieTienda.tsx:8` (`sinContacto`), `:22-30` (contacto), `:25` (número sin enlace); `src/components/tienda/carrito/SelectorUbicacion.tsx:92-100`; `src/components/tienda/checkout/ConfirmacionPedido.tsx:63-76`. Config en `/admin/config`.
- **Por qué importa:** El cliente no sabe dónde recoger ni cuándo atienden; el pie queda pobre para una empresa que pide confianza para pagar contraentrega. También los datos legales de la política (T-01) salen de aquí.
- **Cómo arreglarlo:** (1) Cargar en `/admin/config` dirección, horarios, NIT y al menos una red social. (2) En `PieTienda`, mostrar el número con formato ("+57 314 …") y como enlace `https://wa.me/…`. (3) Mostrar la dirección y el horario de la bodega junto a la casilla "Recogeré en bodega" y en la confirmación.
- **Esfuerzo:** S (dato) + S (código).

**T-05. Hora de corte y festivos sin configurar: la fecha de entrega prometida puede caer en festivo**
- **Severidad:** ALTA
- **Qué pasa:** Hoy `hora_corte` es `null` (se usa 17:00 por defecto sin que nadie lo haya decidido), `dias_no_habiles` es `[]` y `pedido_minimo` es 0. El sistema promete "Tu pedido llega el viernes 25 de diciembre" si el sector reparte los viernes (el sector de prueba reparte jueves y viernes). Los festivos de las próximas semanas (por ejemplo 8 y 25 de diciembre, 1 y 11 de enero; verifica el calendario oficial) no están cargados.
- **Dónde:** `src/lib/tienda/config.ts:51-66` (valores por defecto), `src/lib/entregas.ts:17-21`. Se configura en `/admin/config`.
- **Por qué importa:** Una promesa de entrega en festivo genera reclamos justo en la temporada de más ventas.
- **Cómo arreglarlo:** Cargar los festivos de 2026-2027, confirmar con el dueño la hora de corte y el pedido mínimo (preguntas abiertas del documento madre) y guardarlos en `/admin/config`.
- **Esfuerzo:** S.

**T-06. Rendimiento: consultas en frío de 1,5 a 3,6 s, caché de 30 a 120 s y región de Vercel sin fijar**
- **Severidad:** ALTA
- **Qué pasa:** Medí desde esta máquina contra la API real: búsqueda `buscar_catalogo` 2,0 a 3,7 s; listado de 24 productos 1,5 s; `conteos_catalogo` 2,1 s (una tabla simple, 0,35 s). La memoria del proyecto ya lo explicaba (RLS evaluado fila por fila para el visitante anónimo). Todo está envuelto en `"use cache"` pero con `stale: 30, revalidate: 120`, así que en una tienda con poco tráfico casi cada ficha de producto, búsqueda o combinación de filtros se calcula en frío (varios segundos) para el cliente. No hay `vercel.json` ni región configurada, y Supabase está en `sa-east-1`; Vercel por defecto usa Washington, lo que añade latencia a cada consulta encadenada. (Mis tiempos incluyen mi propia red; el orden de magnitud es lo relevante.)
- **Dónde:** `src/lib/tienda/consultas.ts:47, 156, 189, 232, 300` (cacheLife); `src/lib/tienda/datos.ts:15, 26, 48`; migración `supabase/migrations/0002_rls.sql:93-110` (funciones `private.*` que se evalúan por fila). RNF-01 y RNF-03 no se cumplirían en frío.
- **Por qué importa:** El LCP objetivo es menor a 2,5 s y la búsqueda debe responder en menos de 300 ms (RNF-01, RNF-03). Un tendero con datos móviles abandona si la ficha tarda 4 s. Las sugerencias del buscador (que se piden con cada pausa al escribir) tardarían 2 a 3 s la primera vez.
- **Cómo arreglarlo:** (a) Como ya se invalida por etiqueta desde el panel, subir `cacheLife` a algo como `{ stale: 300, revalidate: 3600, expire: 86400 }` para listados, fichas y sugerencias. (b) Fijar la región de las funciones en São Paulo (`gru1`, por ejemplo `vercel.json` con `"regions": ["gru1"]`) para estar junto a Supabase. (c) Precalentar las páginas más vistas con `generateStaticParams`. (d) A mediano plazo, la migración que simplifica las funciones RLS (opción "a" ya anotada en la memoria). Medir de nuevo con una compilación de producción.
- **Esfuerzo:** M (a, b, c) · L (d).

**T-07. Un fallo de la base se guarda en caché como "catálogo vacío" y no existe `error.tsx`**
- **Severidad:** ALTA
- **Qué pasa:** Las funciones cacheadas ignoran los errores de Supabase y devuelven valores vacíos, que quedan en caché: `obtenerConfigTienda` devuelve valores por defecto (sin WhatsApp: desaparecen todos los botones), `obtenerCategoriasTienda` devuelve `[]` (menú vacío), `listarCatalogo` devuelve `VACIO` ("No hay productos para mostrar"). Si Supabase se pausa por inactividad (el proyecto está en plan gratuito, según la memoria) o falla un instante, el cliente ve una tienda vacía durante minutos. Además no hay `error.tsx`, `global-error.tsx` ni `app/not-found.tsx` (ver T-10).
- **Dónde:** `src/lib/tienda/datos.ts:19-20, 28-33` (`data ?? []` sin mirar `error`); `src/lib/tienda/consultas.ts:58, 101, 133` (`return VACIO`), `:160-176` (facetas); no existen archivos `error.tsx`.
- **Por qué importa:** Un fallo de segundos se convierte en una caída visible de minutos, y el visitante no tiene forma de saber que es temporal ni cómo contactar al negocio.
- **Cómo arreglarlo:** En esas funciones, si la respuesta trae `error`, lanzar una excepción (lo que lanza no se guarda en caché). Crear `src/app/(tienda)/error.tsx` con un mensaje amable y el botón "Intentar de nuevo" + enlace a WhatsApp, y un `global-error.tsx` mínimo. Verificar que `not-found` y `error` funcionen en una compilación de producción.
- **Esfuerzo:** M.

**T-08. No existen `sitemap.xml` ni `robots.txt`**
- **Severidad:** ALTA
- **Qué pasa:** No hay `src/app/sitemap.ts` ni `robots.ts` (ni archivos estáticos equivalentes). RNF-10 los exige. Sin sitemap, Google descubre 1.626 productos solo siguiendo enlaces; sin robots no hay forma de excluir `/admin`, `/api`, `/checkout`, `/carrito`, `/pedido` y `/estado` de los rastreadores (hoy solo algunas llevan `noindex`).
- **Dónde:** Búsqueda en `src/app/` (no hay `sitemap*`, `robots*`). `noindex` presente solo en `carrito/page.tsx:6`, `checkout/page.tsx:7`, `pedido/[numero]/page.tsx:8`, `estado/page.tsx:12`.
- **Por qué importa:** Es el canal principal para que un tendero nuevo encuentre el catálogo buscando "lentejas por mayor Quindío". Sin esto el lanzamiento no tiene visibilidad.
- **Cómo arreglarlo:** Crear `src/app/sitemap.ts` (inicio, `/catalogo`, categorías y los productos visibles con su fecha de modificación) y `src/app/robots.ts` con `disallow` para `/admin`, `/api`, `/checkout`, `/carrito`, `/pedido`, `/estado` y las búsquedas (`/catalogo?q=`), más la línea `Sitemap:`. Definir la URL pública en una variable de entorno (ver T-11).
- **Esfuerzo:** M.

**T-09. El pie no enlaza la política de datos ni hay páginas informativas (RF-01, RF-11)**
- **Severidad:** ALTA
- **Qué pasa:** El pie solo tiene "Ver catálogo" en la columna Compra. La política de datos solo se alcanza desde la casilla del checkout. No existen "Contáctanos", "Preguntas frecuentes" ni "Términos y condiciones" (RF-11, deseable) y RF-01 pide "enlaces legales" en el pie.
- **Dónde:** `src/components/tienda/PieTienda.tsx:34-48`; directorio `src/app/(tienda)/` (solo existen `politica-de-datos`, carrito, catálogo, checkout, pedido y producto).
- **Por qué importa:** La política de tratamiento de datos debe ser accesible en todo momento (Ley 1581 y Decreto 1377), no solo al comprar. Los clientes también buscan "¿cómo pago? ¿cuándo llega?" y hoy no hay respuesta.
- **Cómo arreglarlo:** Añadir al pie una columna "Información" con enlaces a Política de datos, Términos y condiciones, Preguntas frecuentes y Contacto. Crear al menos Términos y Preguntas frecuentes (cobertura de entrega, pago contraentrega, mínimo, devoluciones) como páginas estáticas simples.
- **Esfuerzo:** M.

### MEDIAS

**T-10. 404 sin marca para URLs desconocidas y "soft 404" en productos inexistentes**
- **Severidad:** MEDIA
- **Qué pasa:** (a) No existe `src/app/not-found.tsx` ni `global-not-found`; el `not-found.tsx` de `(tienda)` solo se usa cuando una página llama `notFound()`. Una URL mal escrita (por ejemplo `/catalog`) muestra la página 404 genérica de Next en inglés, sin encabezado ni pie. (b) Para `/producto/slug-que-no-existe`, la guía de Next 16 indica que con Cache Components la respuesta ya empezó a enviarse (el contenido está dentro de `<Suspense>` y lee `params`), así que **el código HTTP queda en 200**, aunque Next añade `<meta name="robots" content="noindex">`. No lo probé con una compilación real; es lo que dice la documentación local.
- **Dónde:** Ausencia de `src/app/not-found.tsx`; `src/app/(tienda)/producto/[slug]/page.tsx:40-52, 58, 61`; documentación: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md` ("Status codes"), `not-found.md`.
- **Por qué importa:** RF pide "páginas 404 reales" para producto inexistente. El `noindex` evita que se indexe, pero los reportes de Search Console lo clasificarán como "soft 404" y el cliente que llega por un enlace roto ve un mensaje en inglés.
- **Cómo arreglarlo:** Crear `src/app/not-found.tsx` en español con la marca (o `global-not-found.js`). Para el estado HTTP: comprobar existencia fuera de `Suspense` en una compilación de producción; si no se logra, aceptar el soft 404 con `noindex` como compromiso.
- **Esfuerzo:** S (a) / M (b).

**T-11. Compartir en WhatsApp y metadatos: sin `metadataBase`, sin imagen de vista previa para inicio/catálogo, canónica relativa**
- **Severidad:** MEDIA
- **Qué pasa:** El layout raíz no define `metadataBase`; en la ficha, `alternates.canonical` es relativo (`/producto/slug`); según el código de Next sin `metadataBase` se emite tal cual (relativo) o con el dominio de respaldo. No hay `opengraph-image` ni `twitter` para inicio, catálogo ni páginas generales: al pegar la dirección de la tienda en WhatsApp (el canal principal del negocio) no sale imagen ni título cuidado. La ficha pone `type: "website"`, no incluye `siteName`, `locale` ni `url`, y 469 productos (29 %) no tienen foto, por lo que no tendrán imagen al compartir. La descripción usa la del producto aunque sea de una palabra (en la base hay una "Choclo").
- **Dónde:** `src/app/layout.tsx:10-14`, `src/app/(tienda)/layout.tsx:13-15`, `src/app/(tienda)/producto/[slug]/page.tsx:25-35`, `src/lib/tienda/producto.ts:168-176` (`descripcionMeta`).
- **Por qué importa:** Cada vez que un vendedor o cliente comparte un producto o la tienda por WhatsApp, la vista previa es la "vitrina". Hoy sale vacía para inicio y catálogo.
- **Cómo arreglarlo:** (1) `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL)` en el layout raíz. (2) Añadir `src/app/opengraph-image.png` (logo + lema) como imagen por defecto; usarla también en productos sin foto. (3) En la ficha: `siteName`, `locale: "es_CO"`, `url` y `twitter: { card: "summary_large_image" }`. (4) En `descripcionMeta`, ignorar descripciones de menos de ~40 caracteres y usar la frase genérica.
- **Esfuerzo:** M.

**T-12. Catálogo: título y descripción iguales para todas las categorías, sin canónica ni `noindex` en búsquedas y filtros**
- **Severidad:** MEDIA
- **Qué pasa:** `/catalogo` tiene `metadata` estática ("Catálogo"). Una categoría (`?cat=granos`), una búsqueda (`?q=…`), cada página (`?page=3`) y toda combinación de filtros comparten título y descripción, sin `alternates.canonical` ni `noindex`. El nombre de la categoría solo aparece en el `<h1>`. Una página fuera de rango (`?page=999`) muestra la última sin redirigir. Una categoría inexistente (`?cat=xyz`) responde "No hay productos" con código 200.
- **Dónde:** `src/app/(tienda)/catalogo/page.tsx:21-25` (metadata estática), `:50-58` (resuelve la categoría ya dentro de `Suspense`), `src/lib/tienda/consultas.ts:129-136` (página fuera de rango).
- **Por qué importa:** Las páginas de categoría son las que mejor posicionan una tienda ("aseo del hogar mayoreo Armenia"). Hoy compiten decenas de URLs casi idénticas y las búsquedas internas pueden indexarse como contenido pobre.
- **Cómo arreglarlo:** Implementar `generateMetadata` en `/catalogo`: título "Nombre de la categoría" + descripción propia; `alternates.canonical` apuntando a la URL limpia (solo `cat`); `robots: { index: false, follow: true }` cuando haya `q`, filtros de marca, precio u ofertas, orden o página mayor que 1.
- **Esfuerzo:** M.

**T-13. En el celular, el encabezado fijo ocupa cerca de 175 px de la pantalla**
- **Severidad:** MEDIA
- **Qué pasa:** `header` con `sticky top-0` agrupa tres filas siempre visibles al hacer scroll: logo y carrito (48 px), buscador (44 px) y el menú de categorías (44 px + márgenes). En 375 px de ancho son unos 175 px (estimación por clases; no medí en un dispositivo real), lo que en un teléfono de 640 a 700 px de alto útil es más de la cuarta parte de la pantalla. La banda negra superior no es fija, pero el resto sí.
- **Dónde:** `src/components/tienda/EncabezadoTienda.tsx:26-33` (sticky + buscador en fila propia), `:53-75` (menú de categorías dentro del mismo `header` fijo).
- **Por qué importa:** En un catálogo de 1.600 productos el cliente pasa el tiempo haciendo scroll; ver solo 2 filas de tarjetas a la vez frustra y baja las ventas móviles.
- **Cómo arreglarlo:** Que solo la primera fila (logo, buscador, carrito) sea `sticky` en móvil, y que la barra de categorías no lo sea (o se oculte al bajar). Probar con 375 px.
- **Esfuerzo:** S.

**T-14. Carrito: botones de 36 px (menos de 44 px) y campo de cantidad que hace zoom en iPhone**
- **Severidad:** MEDIA
- **Qué pasa:** En cada línea del carrito, "quitar", "−", "+" y el campo de cantidad miden `size-9`/`h-9` (36 px). RNF-04 pide áreas táctiles de al menos 44 px. El campo de cantidad usa `text-sm` (14 px); iOS Safari hace zoom automático al enfocar campos de menos de 16 px.
- **Dónde:** `src/components/tienda/carrito/FilaCarrito.tsx:48` (quitar), `:66`, `:84` (±), `:78` (input).
- **Por qué importa:** El carrito es donde el tendero edita cantidades con el pulgar: errar el botón o ver la pantalla "saltar" por el zoom frustra justo antes de pagar.
- **Cómo arreglarlo:** Pasar a `size-11`/`h-11`, con el input en `text-base`, como ya se hace en `SelectorPresentacion.tsx:111-129`.
- **Esfuerzo:** S.

**T-15. El resumen del carrito no es fijo (RF-08)**
- **Severidad:** MEDIA
- **Qué pasa:** RF-08 pide una "barra de resumen fija" con subtotal, ahorro, total y progreso hacia el mínimo. En el panel y en `/carrito` el resumen y el botón "Finalizar pedido" van al final de la lista; con 15 productos hay que recorrer toda la lista para llegar. Además "Finalizar pedido" bloqueado es un `<span aria-disabled>` sin rol (un lector de pantalla no lo anuncia como botón) y el motivo se repite dos veces (texto de "motivo" y texto de la barra de progreso).
- **Dónde:** `src/components/tienda/carrito/ContenidoCarrito.tsx:69-141` (`:123` motivo, `:125-139` botón).
- **Por qué importa:** En el flujo principal de compra, el total y el botón deben estar siempre a la vista.
- **Cómo arreglarlo:** Dar a la zona de totales y botón `sticky bottom-0 bg-background` dentro del panel (y de la página `/carrito`); usar `<button disabled aria-describedby>` vinculado al motivo y quitar el texto duplicado.
- **Esfuerzo:** M.

**T-16. El buscador se vacía tras buscar y recarga toda la página**
- **Severidad:** MEDIA
- **Qué pasa:** `EncabezadoTienda` renderiza `<BuscadorTienda />` sin el valor inicial. Al buscar "jabón" y llegar a `/catalogo?q=jabon` la caja queda en blanco; solo el `<h1>` dice "Resultados para «jabon»". El envío del formulario es un GET nativo (`onSubmit` solo cierra la lista), es decir una carga completa de la página en lugar de una navegación suave (se pierde el estado en memoria y se vuelve a hidratar el carrito).
- **Dónde:** `src/components/tienda/EncabezadoTienda.tsx:33`; `src/components/tienda/BuscadorTienda.tsx:14-17` (`valorInicial` nunca se usa), `:80`.
- **Por qué importa:** Cuando no aparece lo buscado, el cliente quiere corregir una letra; hoy debe reescribir todo.
- **Cómo arreglarlo:** En `BuscadorTienda`, leer `useSearchParams().get("q")` (con `Suspense` en el encabezado) como valor inicial, e interceptar `onSubmit` con `router.push('/catalogo?q=...')`.
- **Esfuerzo:** S.

**T-17. `/api/sugerencias` es pública y sin límite; cada texto distinto abre una consulta de 2 a 3 s**
- **Severidad:** MEDIA
- **Qué pasa:** Cualquiera puede llamar a la ruta con textos distintos (de 2 a 60 caracteres) y cada uno genera 2 consultas y su propia entrada de caché (hasta 1 hora). No hay límite de uso. El buscador también la llama después de cada pausa de 300 ms al escribir.
- **Dónde:** `src/app/api/sugerencias/route.ts:9-20`; `src/lib/tienda/consultas.ts:187-206`; `src/components/tienda/BuscadorTienda.tsx:24-46`.
- **Por qué importa:** Un script puede saturar el plan gratuito de Supabase (que ya tarda segundos por consulta) y tumbar el catálogo para todos.
- **Cómo arreglarlo:** Activar las reglas de límite de tasa del firewall de Vercel sobre `/api/sugerencias` (unas 30 solicitudes por minuto por IP) y subir la caché de la ruta; el cliente ya se limita a ≥ 2 caracteres.
- **Esfuerzo:** S a M.

**T-18. Contraste del rojo de oferta y de errores: 4,2:1 (AA exige 4,5:1 en texto pequeño)**
- **Severidad:** MEDIA
- **Qué pasa:** El rojo `#E53935` sobre blanco da una relación de aproximadamente 4,2:1 (cálculo manual). Se usa como texto pequeño: etiqueta "Oferta" (blanco sobre rojo, `text-xs`), "Precio de oferta" (`text-sm`) y todos los mensajes de error del checkout y el carrito (`text-destructive`, mismo color). Incumple WCAG AA (RNF-06).
- **Dónde:** `src/components/tienda/TarjetaProducto.tsx:47`; `src/components/tienda/SelectorPresentacion.tsx:86`; `src/components/tienda/checkout/CampoCheckout.tsx:52`; `src/components/tienda/checkout/FormularioCheckout.tsx:157, 162, 211`; `src/components/tienda/carrito/FilaCarrito.tsx:55`; `src/app/globals.css` (`--color-ev-oferta`, `--destructive`).
- **Por qué importa:** Los mensajes de error son los que más importa poder leer bien; las personas con baja visión no distinguirán la etiqueta de oferta en pantallas con brillo.
- **Cómo arreglarlo:** Oscurecer el rojo a algo como `#C62828` (unos 5,6:1) para texto y la etiqueta, y actualizar CLAUDE.md §8.
- **Esfuerzo:** S.

**T-19. Tarjetas de producto: etiquetas ocultas a lectores de pantalla y 24 botones "Agregar" idénticos**
- **Severidad:** MEDIA
- **Qué pasa:** Las etiquetas "Oferta", "Nuevo" y "Agotado" están dentro del enlace de la imagen, que tiene `aria-hidden="true"` y `tabIndex={-1}`; un lector de pantalla nunca las anuncia (el cliente ciego no sabe que está agotado ni en oferta). Además, todos los botones dicen solo "Agregar" (y "Ver presentaciones"), sin el nombre del producto: en una lista de 24 son indistinguibles. El `h3` de las tarjetas también salta de nivel (h1 → h3) en el catálogo.
- **Dónde:** `src/components/tienda/TarjetaProducto.tsx:26-53` (enlace oculto con las etiquetas), `:89-94`; `src/components/tienda/carrito/BotonAgregar.tsx:37-43, 53-77`.
- **Por qué importa:** Accesibilidad básica de una tienda (RNF-06) y un riesgo legal creciente; además mejora las pruebas automatizadas.
- **Cómo arreglarlo:** Poner las etiquetas fuera del enlace oculto (o repetirlas con `sr-only` junto al nombre) y añadir `aria-label={`Agregar ${nombre} al carrito`}` y `aria-label` equivalente en "Ver presentaciones". Cambiar `h3` por `h2` en el catálogo o añadir un `h2` oculto.
- **Esfuerzo:** S.

**T-20. Carrusel de banners: sin `h1` en el inicio, sin texto alternativo y se descargan dos imágenes**
- **Severidad:** MEDIA (latente: hoy hay 0 banners, así que no se ve)
- **Qué pasa:** Cuando existan banners, el inicio **no tiene ningún `h1`** (el único está en el bloque de respaldo). Las imágenes del banner llevan `alt=""` y solo un `sr-only` "Ver promoción N", de modo que el mensaje del banner no es accesible. Si hay imagen móvil y de escritorio, ambas llevan `priority` y se ocultan con CSS (`md:hidden` / `hidden md:block`): el navegador descarga las dos, con lo que en el celular se baja también la imagen grande (daña el LCP). Las diapositivas fuera de pantalla siguen siendo enfocables con el teclado.
- **Dónde:** `src/app/(tienda)/page.tsx:38-63` (h1 solo en el bloque de respaldo), `src/components/tienda/CarruselBanners.tsx:44, 46, 53-55, 61-70`.
- **Por qué importa:** El administrador cargará banners en cuanto abra el panel; ahí aparecerán estos problemas (SEO sin h1, accesibilidad, velocidad en móvil).
- **Cómo arreglarlo:** Dejar un `<h1 className="sr-only">EV Distribuidora: víveres, aseo y más por mayor</h1>` siempre; cambiar a `<picture>` con `<source media>` (una sola descarga) o dejar `priority` solo en la que se ve; añadir un campo de texto alternativo en el banner y usarlo.
- **Esfuerzo:** M.

**T-21. RF-03: "Ver presentaciones" lleva a la ficha, no abre un selector rápido (227 productos)**
- **Severidad:** MEDIA
- **Qué pasa:** RF-03 dice que si el producto tiene varias variantes, "Agregar" abre un selector rápido. La implementación muestra un enlace "Ver presentaciones" que cambia de página. Hoy 227 productos (14 %) tienen más de una presentación visible; cada compra de esos añade un salto de página y de volver.
- **Dónde:** `src/components/tienda/carrito/BotonAgregar.tsx:37-43`; datos en `src/lib/tienda/tarjeta.ts:69` (`masPresentaciones`).
- **Por qué importa:** Un tendero que arma un pedido de 40 productos pierde mucho tiempo yendo y viniendo; es una desviación del requerimiento.
- **Cómo arreglarlo:** Abrir un `<dialog>` (patrón ya usado en `PanelCarrito`) con la lista de presentaciones y sus precios, y botón Agregar en cada una. O, si se decide mantener el comportamiento actual, documentarlo en `docs/01_REQUERIMIENTOS.md`.
- **Esfuerzo:** M.

**T-22. Contenido del catálogo incompleto para un lanzamiento**
- **Severidad:** MEDIA
- **Qué pasa:** Con los datos de hoy: 1.626 productos visibles; **469 (29 %) sin foto** (se muestra el logo gris), **1.380 (85 %) sin descripción**, **1.434 (88 %) sin marca** (el filtro de marcas solo cubre a 192 productos y lista 66 marcas), 0 banners, 0 productos "Nuevos" (la sección no aparece), solo 1 en oferta y ninguna categoría tiene ícono (el inicio repite el mismo ícono genérico `Package` en todas las tarjetas de categoría).
- **Dónde:** Datos en Supabase; `src/app/(tienda)/page.tsx:86-90` (ícono genérico).
- **Por qué importa:** Una tienda sin fotos para casi un tercio de los productos y sin banners se ve inacabada y vende menos; el filtro de marcas parece roto.
- **Cómo arreglarlo:** Subir fotos (importación de fotos en lote del panel), cargar 2 a 3 banners con ofertas reales, marcar productos "Nuevo" y asignar ícono o imagen a las categorías principales. No requiere código. Si es necesario, hacer que se oculte el filtro de marcas cuando cubra pocos productos.
- **Esfuerzo:** L (trabajo de contenido).

**T-23. Verificar variables de entorno de producción: si falta `NEXT_PUBLIC_SUPABASE_URL` al compilar, todas las imágenes se rompen**
- **Severidad:** MEDIA
- **Qué pasa:** `next.config.ts` construye `remotePatterns` desde `NEXT_PUBLIC_SUPABASE_URL`; si la variable no existe en el momento de compilar en Vercel, la lista queda vacía y `next/image` rechaza todas las fotos de producto (error por host no configurado). Solo las imágenes de banners e íconos pasan por `imagenPermitida`; las fotos de producto (tarjetas y fichas) no se filtran, así que una URL de otro host rompería la página en lugar de omitirse.
- **Dónde:** `next.config.ts:6-23`; `src/lib/tienda/tarjeta.ts:59, 81`; `src/lib/tienda/consultas.ts:277`.
- **Por qué importa:** Es un error clásico del primer despliegue y el resultado es una tienda sin imágenes o con la página rota.
- **Cómo arreglarlo:** Añadir al checklist de despliegue las tres variables en Vercel (Production y Preview) antes de la primera compilación. Aplicar `imagenPermitida` también a las fotos de producto, o hacer que falle el build si falta la variable.
- **Esfuerzo:** S.

### BAJAS

**T-24. Contenido promocional duplicado en la parte alta del inicio**
- **Severidad:** BAJA
- **Qué pasa:** La barra negra superior (configurable) dice "Compra por mayor y ahorra" y justo debajo el bloque de respaldo repite el mismo texto como título.
- **Dónde:** `src/components/tienda/BarraSuperior.tsx`, `src/app/(tienda)/page.tsx:44-46`; valor en `configuracion.mensaje_barra_superior`.
- **Por qué importa:** Se ve repetitivo y desperdicia la primera pantalla.
- **Cómo arreglarlo:** Cambiar el mensaje de la barra (por ejemplo "Entregamos en Calarcá y alrededores"), o el título del hero.
- **Esfuerzo:** S.

**T-25. El botón flotante de WhatsApp tapa contenido en el celular**
- **Severidad:** BAJA
- **Qué pasa:** Botón de 56 px fijo abajo a la derecha (`fixed right-4 bottom-4`) sobre el contenido: puede tapar "Siguiente →" de la paginación, el botón "Agregar" de la última fila y el texto del pie.
- **Dónde:** `src/components/tienda/BotonWhatsApp.tsx:19`.
- **Por qué importa:** Se pisa con acciones importantes al final de las listas.
- **Cómo arreglarlo:** Añadir `pb-20` al contenedor de contenido (o al pie) en móvil y evitar mostrarlo en `/checkout`.
- **Esfuerzo:** S.

**T-26. Selector de presentación: roles de radio sin navegación con flechas**
- **Severidad:** BAJA
- **Qué pasa:** Se marcan como `role="radio"` botones sueltos, cada uno tabulable, sin gestión de flechas (patrón ARIA incompleto) dentro de un `fieldset` con otro `radiogroup`.
- **Dónde:** `src/components/tienda/SelectorPresentacion.tsx:41-57`.
- **Por qué importa:** Un lector de pantalla anuncia "radio" y el usuario espera poder usar las flechas.
- **Cómo arreglarlo:** Usar `<input type="radio">` visualmente ocultos con `<label>` estilizada (navegación nativa) o quitar los roles y usar `aria-pressed` en botones.
- **Esfuerzo:** S.

**T-27. Sin enlace "Saltar al contenido" y el menú de 12 categorías precede a cada página**
- **Severidad:** BAJA
- **Qué pasa:** Quien navega con teclado debe pasar por logo, buscador, carrito y todas las categorías antes de llegar al contenido en cada página.
- **Dónde:** `src/app/(tienda)/layout.tsx:49-56`, `src/components/tienda/EncabezadoTienda.tsx`.
- **Por qué importa:** WCAG 2.4.1 (bloques de salto), RNF-06.
- **Cómo arreglarlo:** Añadir un enlace `sr-only focus:not-sr-only` al inicio del layout hacia `#contenido` y poner `id="contenido"` a cada `<main>`.
- **Esfuerzo:** S.

**T-28. `formatCOP` usa un espacio normal entre "$" y el valor**
- **Severidad:** BAJA
- **Qué pasa:** El formato `$ 12.500` usa un espacio común; en un contenedor angosto el navegador puede partir la línea entre "$" y el número.
- **Dónde:** `src/lib/formato.ts:18`.
- **Por qué importa:** Precios partidos en dos líneas se ven descuidados (tarjetas de 160 px, líneas del carrito).
- **Cómo arreglarlo:** Usar un espacio de no separación (U+00A0) en lugar del espacio normal; ajustar el test de `formato.test.ts` si compara el texto exacto.
- **Esfuerzo:** S.

**T-29. Filtros: se dibujan dos veces y los formularios recargan la página completa**
- **Severidad:** BAJA
- **Qué pasa:** El panel de filtros (con su lista de 66 marcas) se renderiza en el HTML dos veces (aside de escritorio y hoja móvil), aunque solo una se vea. El envío de "Aplicar filtros" es un GET nativo, con recarga completa. Además, las sugerencias del buscador consultan la imagen de cada producto, pero el desplegable no la muestra.
- **Dónde:** `src/app/(tienda)/catalogo/page.tsx:74-76, 95-97, 108-110`; `src/components/tienda/FiltrosCatalogo.tsx:75`; `src/lib/tienda/consultas.ts:203` (imagen no usada por `BuscadorTienda.tsx:125-132`).
- **Por qué importa:** HTML más pesado y navegación menos fluida; son mejoras menores.
- **Cómo arreglarlo:** Dibujar solo uno según el ancho (CSS no basta; usar el componente cliente `HojaFiltros` para móvil y renderizar el aside solo en `lg`), o aceptarlo con la recarga actual. Mostrar la miniatura en sugerencias o dejar de consultarla.
- **Esfuerzo:** M.

**T-30. Cabeceras de seguridad HTTP ausentes**
- **Severidad:** BAJA
- **Qué pasa:** `next.config.ts` no define `headers()` (sin `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors`, `Permissions-Policy`). El sitio puede incrustarse en un iframe de otro dominio.
- **Dónde:** `next.config.ts:9-34`.
- **Por qué importa:** Es una buena práctica de producción; el riesgo de "clickjacking" sobre el checkout es bajo pero evitable.
- **Cómo arreglarlo:** Añadir `async headers()` con esas cuatro cabeceras (la CSP completa puede venir después).
- **Esfuerzo:** S.

**T-31. Datos estructurados de producto incompletos**
- **Severidad:** BAJA
- **Qué pasa:** El `Offer` de schema.org lleva `url` relativo (`/producto/slug`), el precio de la primera presentación, sin `priceValidUntil` ni `itemCondition`; los productos con varias presentaciones deberían usar `AggregateOffer`. No hay datos estructurados de organización ni de migas de pan (`BreadcrumbList`).
- **Dónde:** `src/lib/tienda/producto.ts:179-207` (`:199` url), `src/app/(tienda)/producto/[slug]/page.tsx:65-74`.
- **Por qué importa:** Google puede ignorar o marcar advertencias en los resultados enriquecidos de precio y disponibilidad.
- **Cómo arreglarlo:** Con `metadataBase` definido, generar URL absolutas; usar `AggregateOffer` (`lowPrice`/`highPrice`/`offerCount`) cuando haya varias presentaciones; añadir `Organization` en el inicio y `BreadcrumbList` en la ficha.
- **Esfuerzo:** M.

**T-32. Pequeñas inconsistencias de mantenimiento en la caché**
- **Severidad:** BAJA
- **Qué pasa:** (a) El comentario de `datos.ts` dice que los productos y precios "se leen frescos en cada visita", pero `consultas.ts` los guarda en caché de 30 a 120 s. (b) La importación de fotos en lote escribe `producto_imagenes` pero no llama `invalidarTienda()`: las fotos nuevas tardan unos minutos en verse (el resto de acciones del panel sí invalidan). (c) La ficha pide `select("*")` de la vista y trae la columna interna `texto_busqueda` (todo el texto de búsqueda y SKU) que no se usa.
- **Dónde:** `src/lib/tienda/datos.ts:9`; `src/app/admin/(panel)/importar/fotos-actions.ts:52`; `src/lib/tienda/consultas.ts:238`.
- **Por qué importa:** Evita confusión futura y retrasos al cargar las 469 fotos faltantes.
- **Cómo arreglarlo:** Corregir el comentario, llamar `invalidarTienda()` al terminar la carga de fotos y listar las columnas de la ficha.
- **Esfuerzo:** S.

---

## 3) Lo que está bien (no tocar)

- **Cálculo y presentación de precios:** todo pasa por `formatCOP`; la lógica de mayoreo, oferta y mensajes ("Lleva 12 o más y paga $ X c/u") es coherente con RN-02 a RN-04, y el servidor recalcula y compara el total antes de crear el pedido.
- **URL como fuente de verdad del catálogo (RF-02):** filtros, orden, marcas y página en la URL, con parámetros saneados (`filtros-catalogo.ts`), 24 por página y paginación del lado del servidor.
- **Búsqueda sin tildes y tolerante a errores,** estado "sin resultados" con botón "Pregúntanos por WhatsApp" y teclado completo en el desplegable (flechas, Enter, Esc).
- **Formularios del checkout:** `label` en todos los campos, errores enlazados con `aria-describedby`, honeypot, mismo esquema Zod en cliente y servidor y campos de 16 px (sin zoom en iPhone).
- **Seguridad de contenido:** `enlaceSeguro` e `imagenPermitida` para banners e íconos, JSON-LD con escape de `<`, redes sociales solo con `https`, carrito y checkout con `noindex`, y confirmación del pedido leída del navegador (el número consecutivo no filtra datos de otros clientes).
- **Imágenes:** `next/image` con `sizes`, miniaturas de 400 px en listados, `aspect-ratio` reservado (sin saltos de diseño) y `priority` solo en las primeras tarjetas y el banner.
- **Carrito:** diálogo nativo (foco atrapado, Esc), `localStorage` con saneamiento y `try/catch`, revalidación de precios al abrir y avisos si algo cambió.
- **Caché con etiquetas e invalidación desde el panel** (`invalidarTienda`), identidad visual con tokens `ev-*`, tipografía legible y diseño mobile-first coherente con CLAUDE.md §8.

---

## No verificado (para ser honestos)

- No ejecuté `npm run build`, Lighthouse ni un navegador real: los tiempos son de la API, no del sitio desplegado; el comportamiento de "soft 404" (T-10) se basa en la documentación de Next 16, no en una prueba; el alto del encabezado en móvil (T-13) es una estimación por clases de Tailwind.
- No probé que el botón de WhatsApp abra el chat con el mensaje (pendiente anotado en la memoria desde F5).
- No existen pruebas E2E (la carpeta `tests/e2e/` está vacía; RNF-13 pendiente de F7).
- El panel `/admin` y la creación de pedidos se auditan en los informes 02 y 03.
