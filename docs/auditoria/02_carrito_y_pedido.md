# Auditoría 02 — Carrito, checkout y creación del pedido

Fecha: 2026-11-24. Auditor: revisión de solo lectura (sin modificar código). Alcance: `src/stores/carrito.ts`, `src/components/tienda/{carrito,checkout}/**`, `src/app/(tienda)/{carrito,checkout,pedido}`, `src/lib/{precios,entregas,carrito,ubicacion,whatsapp,pedidos,validaciones/pedido}.ts`, `src/lib/tienda/config.ts` y la función SQL `crear_pedido` (migraciones 0009, 0010, 0011).

Evidencia ejecutada: `npx vitest run tests/unit/precios.test.ts tests/unit/entregas.test.ts tests/unit/carrito-pedido.test.ts` → 65 pruebas pasan. También hice consultas de SOLO LECTURA a la base remota (`distribuidora-jd`) para ver la configuración real; no escribí nada.

---

## 1) Resumen

- **Veredicto: NO se puede lanzar hoy.** La lógica de cálculo y la seguridad del servidor son sólidas, pero hay dos bloqueos de negocio y tres fallos de experiencia que cuestan dinero o clientes.
- **Bloqueo 1 (precios):** 2.700 de las 2.942 presentaciones con precio tienen "precio por mayor" pero NINGUNA cantidad mínima (solo 2 la tienen). Con la regla actual, el precio por mayor se cobra desde la primera unidad: casi todo se vende un 6,8 % más barato que el precio al detal (C-01).
- **Bloqueo 2 (configuración):** en la base real solo hay 1 municipio y 1 sector ("prueba Centro", jueves/viernes, envío $3.000), cero festivos cargados, hora de corte sin definir (usa 17:00 por defecto) y pedido mínimo en 0 (C-02).
- **Fallos graves de uso:** borrar la cantidad en el carrito para escribir otra QUITA el producto (C-04); un pedido puede duplicarse si se cae la conexión justo al enviar (C-03); y nadie recibe aviso automático de un pedido nuevo si el cliente no toca "Enviar por WhatsApp" (C-05).

---

## 2) Hallazgos

### BLOQUEANTES

#### C-01 — El precio por mayor se cobra desde la primera unidad en casi todo el catálogo
- **Severidad:** BLOQUEANTE
- **Qué pasa:** `alcanzaMayorPorCantidad` devuelve `true` para cualquier cantidad cuando la presentación tiene `precio_mayor` y `cantidad_min_mayor` es nula (`cantidad >= (cantidadMinMayor ?? 1)`). Consulté la base real: de 2.942 presentaciones con precio, 2.700 tienen `precio_mayor` y solo 2 tienen cantidad mínima. El descuento promedio mayor vs. detal es 6,8 %. Resultado: un cliente que compra 1 unidad paga el precio de mayorista, y en el carrito toda línea sale marcada "por mayor". La prueba `precios.test.ts:56` consagra este comportamiento como intencional, pero el propio `memory/precios-excel-ev.md` lista "cantidad mínima para mayor (el Excel no la trae)" como pendiente sin resolver.
- **Dónde:** `src/lib/precios.ts:75-77` (comentario en 70-73); `tests/unit/precios.test.ts:56`; datos: tabla `variantes` remota.
- **Por qué importa:** es margen perdido en cada venta y, además, destruye la diferencia entre "detal" y "mayor" que es el corazón del negocio. Los clientes pequeños pagan precio de mayorista y los grandes no tienen incentivo para comprar más.
- **Cómo arreglarlo:** decidir con el dueño UNA de dos políticas antes de abrir: (a) cargar la cantidad mínima por presentación (o un valor por defecto global, p. ej. 6 o 12, aplicado a las 2.698 presentaciones sin mínimo, vía importación/cuadrícula de precios); o (b) cambiar `alcanzaMayorPorCantidad` para que sin mínimo NO aplique mayor por cantidad (y exigir mínimo en el formulario/importación). Ajustar la prueba de `precios.test.ts:56` según la decisión. La tarjeta/ficha de producto (`tienda/producto.ts:110`, `tarjeta.ts:66`) debe mostrar la misma regla.
- **Esfuerzo:** M (decisión de negocio + 1 migración de datos o cambio de 3 líneas + prueba).

#### C-02 — La configuración de producción no está lista para vender
- **Severidad:** BLOQUEANTE
- **Qué pasa:** consultas de solo lectura a la base real muestran: `municipios` activos = 1 y `sectores` activos = 1 (un sector llamado "prueba Centro", `dias_reparto={4,5}`, envío $3.000); `dias_no_habiles = []`; `hora_corte = null` (el código cae en "17:00" por defecto, `config.ts:61`); `pedido_minimo = 0`; `regla_mayoreo = por_cantidad`; `whatsapp_pedidos` sí está configurado (57314…). Solo hay 2 pedidos (pruebas). Según la memoria del proyecto también quedan un producto de prueba visible ("DETERGENTE EN POLVO", id 5).
- **Dónde:** tablas `configuracion`, `sectores`, `municipios` (remota); `src/lib/tienda/config.ts:61-66`; `supabase/seed.sql:44-50`.
- **Por qué importa:** los clientes que no estén en "prueba Centro" solo pueden recoger en bodega; se prometerían entregas en festivos; sin pedido mínimo se aceptan pedidos de $500 que cuestan más repartir de lo que dejan.
- **Cómo arreglarlo:** cargar en el panel (Zonas y Configuración) los municipios/sectores reales con sus días de reparto y costo de envío, la hora de corte real, el pedido mínimo acordado y los festivos de 2026-2027 (Colombia). Desactivar el sector de prueba y el producto de prueba. Hacer un pedido real de prueba de punta a punta y cancelarlo.
- **Esfuerzo:** M (trabajo de datos; no de código).

---

### ALTAS

#### C-03 — Un pedido puede duplicarse (sin idempotencia) y el mensaje de error es engañoso
- **Severidad:** ALTA
- **Qué pasa:** `enviar()` llama a la Server Action y, si lanza una excepción (corte de red, timeout de la función, error de Supabase), muestra "Se perdió la conexión. Tu pedido no se envió" aunque el servidor ya haya hecho el `INSERT`. La persona reintenta y se crea un segundo pedido (otro número, otro mensaje de WhatsApp). No hay clave de idempotencia ni ninguna comprobación de duplicados: `crear_pedido` solo cuenta pedidos para el límite de 5 en 10 min. Además, `createAdminClient()` u otra excepción dentro de la acción se propagan al mismo `catch`.
- **Dónde:** `src/components/tienda/checkout/FormularioCheckout.tsx:108-146` (mensaje en 143; botón se rehabilita en `finally`, 145); `src/app/(tienda)/checkout/actions.ts:131-179`; `supabase/migrations/0011_costos_inventario.sql:137-144` (solo el límite).
- **Por qué importa:** en zonas con 4G inestable (Quindío rural) es plausible. Un pedido duplicado de un cliente = doble preparación, despacho y posible devolución; el despachador no sabe cuál es el bueno.
- **Cómo arreglarlo:** (1) En `crear_pedido` (nueva migración 0013, `create or replace`, no cambia tablas): antes de insertar, buscar un pedido del mismo `cliente_id`, mismo `total`, mismo número de ítems, estado `nuevo` y creado en los últimos 2-3 minutos; si existe, devolver su `numero` en vez de crear otro. (2) Cambiar el texto del `catch` a "No pudimos confirmar si tu pedido llegó. Antes de reintentar, escríbenos por WhatsApp o espera un minuto" y no vaciar el carrito.
- **Esfuerzo:** M.

#### C-04 — Borrar la cantidad en el carrito quita el producto
- **Severidad:** ALTA
- **Qué pasa:** el campo de cantidad hace `onChange → cambiar(id, Number(e.target.value))`. Al borrar el "1" para escribir "24", el valor es "" → `Number("")` = 0 → `cambiarCantidad` ve `cantidad < 1` y llama `quitarItem`. El producto desaparece del carrito. Pasa igual con cualquier valor no numérico.
- **Dónde:** `src/components/tienda/carrito/FilaCarrito.tsx:77`; `src/lib/carrito.ts:69` (`if (!Number.isFinite(cantidad) || cantidad < 1) return quitarItem(...)`).
- **Por qué importa:** los clientes son tiendas que piden 12, 24, 48 unidades y teclean cantidades. Cada vez que corrijan el número perderán la línea y tendrán que volver al catálogo; muchos abandonarán el pedido.
- **Cómo arreglarlo:** mantener un estado local de texto en el input y confirmar la cantidad en `onBlur`/Enter; si queda vacío o 0 al salir, restaurar la cantidad anterior (la papelera ya sirve para quitar). Solo `-` con cantidad 1 debería quitar (o pedir confirmación).
- **Esfuerzo:** S.

#### C-05 — El pedido existe pero nadie se entera si el cliente no envía el WhatsApp
- **Severidad:** ALTA
- **Qué pasa:** `crearPedido` guarda el pedido y solo después la persona ve el botón "Enviar por WhatsApp"; el texto dice "Envíalo por WhatsApp para que lo confirmemos". No encontré ningún envío automático al negocio (búsqueda de resend/nodemailer/webhook/notificar en `src` sin resultados). Si el cliente cierra la pestaña, WhatsApp no abre o se arrepiente, el pedido queda "nuevo" en el panel sin aviso, y el cliente cree que está confirmado ("¡Pedido recibido!").
- **Dónde:** `src/components/tienda/checkout/ConfirmacionPedido.tsx:69-75, 82-100`; `src/app/(tienda)/checkout/actions.ts:131-216`.
- **Por qué importa:** pedidos que nadie atiende = clientes molestos y ventas perdidas. No pude verificar si el panel de pedidos tiene alerta sonora/contador de nuevos (fuera de mi área); si no la tiene, el problema es mayor.
- **Cómo arreglarlo:** (mínimo) que el panel muestre el contador de pedidos "nuevo" y que el equipo lo revise varias veces al día + cambiar el texto a "Tu pedido quedó registrado; envíalo por WhatsApp para agilizar la confirmación". (Mejor) enviar al negocio un correo o mensaje automático al crear el pedido (requiere decidir servicio; es una dependencia nueva, hay que pedir permiso).
- **Esfuerzo:** S (texto + contador) / L (notificación automática).

---

### MEDIAS

#### C-06 — Cualquiera puede sobrescribir los datos de un cliente existente usando su celular
- **Severidad:** MEDIA
- **Qué pasa:** `crear_pedido` hace `insert … on conflict (celular) do update` con `nombre = excluded.nombre` y completa el resto con `coalesce`. Nadie verifica que el celular sea de quien pide. La tabla `pedidos` no guarda nombre del cliente (solo `cliente_id`, `direccion_entrega`), así que cambiar el nombre/negocio/documento en `clientes` cambia lo que el panel muestra en TODOS los pedidos anteriores de ese celular. Además un empleado que pide con su propio nombre pisa el del dueño del negocio.
- **Dónde:** `supabase/migrations/0011_costos_inventario.sql:167-184`; `supabase/migrations/0001_init.sql:236-258` (pedidos sin snapshot del cliente).
- **Por qué importa:** historial contaminado, documentos (cédula/NIT) equivocados en despacho y posible suplantación. RN-11 pide actualizar, pero no un snapshot.
- **Cómo arreglarlo:** guardar un snapshot del nombre/negocio/celular/documento en el pedido (columnas nuevas, migración con aprobación) y mostrarlo en el panel; o no sobrescribir `nombre`/`documento` si ya existen (solo completar vacíos).
- **Esfuerzo:** M.

#### C-07 — Antiabuso débil: el honeypot no frena bots que llaman la acción y no hay CAPTCHA
- **Severidad:** MEDIA
- **Qué pasa:** `crearPedido` es un endpoint público; un script puede enviar `web: ""` y saltarse el honeypot. La única defensa real es RN-13 (5 pedidos por celular o IP cada 10 min). Con celulares inventados distintos, un solo IP puede crear hasta ~720 pedidos falsos por día y otros tantos "clientes" (el upsert crea la fila). El conteo del límite además no tiene bloqueo (peticiones concurrentes pueden pasar de 5) y IPv6 permite rotar direcciones. Contrapunto: un negocio detrás de una misma IP (CGNAT móvil) comparte el cupo de 5.
- **Dónde:** `src/app/(tienda)/checkout/actions.ts:55-60`; `supabase/migrations/0011_costos_inventario.sql:137-144`; `FormularioCheckout.tsx:183-187`.
- **Por qué importa:** pedidos basura saturan al despachador y ensucian la base de clientes; es la forma más fácil de molestar a un negocio pequeño.
- **Cómo arreglarlo:** añadir un reto invisible (Cloudflare Turnstile o similar; requiere permiso para la dependencia) y/o límite global (p. ej. máx. 30 pedidos por hora) y rechazar pedidos cuyo total sea inferior al mínimo (ver C-02). Limitar por /64 en IPv6.
- **Esfuerzo:** M.

#### C-08 — En el checkout no se ven los avisos ni se pueden quitar productos agotados
- **Severidad:** MEDIA
- **Qué pasa:** la revalidación de precios y disponibilidad solo corre al abrir el carrito (`ContenidoCarrito`), no al entrar a `/checkout`. Si la persona llega directo al checkout (o deja la pestaña abierta), el servidor rechaza con "Algunos productos ya no están disponibles" y actualiza el estado, pero los `avisos` solo se pintan en `ContenidoCarrito` (nunca en el checkout). Un producto que "ya no está a la venta" desaparece del resumen sin explicación y el total cambia; uno agotado deja el botón bloqueado con "Quita los productos agotados de tu carrito" pero `ResumenCheckout` no lo marca ni ofrece quitarlo; hay que ir a "Editar carrito".
- **Dónde:** `ContenidoCarrito.tsx:23, 71-79` (avisos solo aquí); `ResumenCheckout.tsx:31-47` (sin marca de agotado); `FormularioCheckout.tsx:96-105, 146-155`.
- **Por qué importa:** el cliente ve un total distinto sin saber por qué, desconfía y abandona.
- **Cómo arreglarlo:** mostrar `avisos` también en el checkout, marcar "Agotado" en `ResumenCheckout` con botón "Quitar", y llamar `consultarVigentes` una vez al montar el formulario.
- **Esfuerzo:** S-M.

#### C-09 — Límite de 50 productos distintos sin explicación (y es un límite real para mayoristas)
- **Severidad:** MEDIA
- **Qué pasa:** `agregarItem` rechaza el producto 51 con `motivo: "lleno"`; `BotonAgregar` solo abre el panel (`abrirPanel()`) sin ningún mensaje. El zod (`max(MAX_ITEMS_CARRITO)`) y la función SQL (`between 1 and 50`) repiten el límite.
- **Dónde:** `src/lib/carrito.ts:14, 59`; `src/components/tienda/carrito/BotonAgregar.tsx:55-59`; `validaciones/pedido.ts:61`; `0011_costos_inventario.sql:117`.
- **Por qué importa:** un cliente que arma un pedido grande no entiende por qué "Agregar" dejó de funcionar. Con 1.700 referencias, 50 líneas es alcanzable para una tienda.
- **Cómo arreglarlo:** mostrar el aviso "Tu carrito tiene el máximo de 50 productos distintos; envía este pedido y haz otro" y decidir con el dueño si 50 alcanza (si no, subir el límite en los tres sitios a la vez).
- **Esfuerzo:** S.

#### C-10 — Fecha de entrega: días no hábiles y corte no cubren todos los casos
- **Severidad:** MEDIA
- **Qué pasa:** (a) `fechaEntregaSector` solo excluye festivos como día de ENTREGA, no como día de CORTE: un pedido el sábado a las 20:00 se acepta para el lunes aunque el corte "domingo 17:00" ya sea inaplicable o el domingo/festivo no se trabaje. (b) `fechaEntregaBodega` ignora la hora de corte: un pedido a las 23:00 promete bodega mañana. (c) `diasBodega` está fijo en lunes–sábado en servidor y cliente (`CONFIG_ENTREGA_POR_DEFECTO`), no es configurable. (d) Con `dias_no_habiles` vacío en producción (C-02) se prometen entregas en festivos. La aritmética de zona horaria en sí es correcta (UTC-5 fijo, probada).
- **Dónde:** `src/lib/entregas.ts:81-90, 99-105`; `checkout/actions.ts:89-93`; `(tienda)/layout.tsx` (`diasBodega: CONFIG_ENTREGA_POR_DEFECTO.diasBodega`).
- **Por qué importa:** promesas de entrega que no se pueden cumplir generan llamadas y reclamos.
- **Cómo arreglarlo:** cargar festivos (C-02); definir con el negocio si el día de corte debe ser hábil y, de ser así, retroceder hasta el día hábil anterior; aplicar la hora de corte también a bodega si la preparación lo requiere; guardar `dias_bodega` en configuración.
- **Esfuerzo:** M.

#### C-11 — Si el navegador bloquea localStorage, la confirmación queda sin botón de WhatsApp
- **Severidad:** MEDIA
- **Qué pasa:** el resumen y el mensaje de WhatsApp se guardan SOLO en `localStorage` (`ev-ultimo-pedido`). Si `setItem` falla (modo privado restrictivo, cuota llena, bloqueo de datos del sitio), el `catch` lo ignora, se vacía el carrito y la pantalla muestra solo "Guarda este número…" sin botón de enviar ni mensaje para copiar.
- **Dónde:** `FormularioCheckout.tsx:113-135`; `ConfirmacionPedido.tsx:30-32, 145-151`.
- **Por qué importa:** el pedido queda creado pero el cliente no puede mandarlo; combinado con C-05, nadie lo atiende.
- **Cómo arreglarlo:** además de `localStorage`, guardar el `PedidoConfirmado` en el almacén en memoria (Zustand) o `sessionStorage` y usarlo como respaldo en `ConfirmacionPedido`; como último recurso, mostrar el botón con un mensaje mínimo ("Pedido EV-000123") aunque no se tenga el detalle.
- **Esfuerzo:** S.

#### C-12 — Cliente con pestaña abierta mucho tiempo puede quedar atascado ("los precios cambiaron" sin cambio visible)
- **Severidad:** MEDIA
- **Qué pasa:** zonas, costo de envío, pedido mínimo y reglas de mayoreo llegan al navegador una sola vez desde el layout (`ProveedorTienda`). Si el administrador cambia el costo de envío o la regla mientras la pestaña está abierta, el servidor recalcula con el valor nuevo, ve `total !== total_visto` y responde "Los precios o el envío cambiaron… confirma otra vez", pero lo único que devuelve son `vigentes` (precios de productos); el total del navegador no cambia, así que cada reintento falla igual hasta recargar la página. El mensaje no dice que hay que recargar.
- **Dónde:** `checkout/actions.ts:123-128`; `(tienda)/layout.tsx:36-58`; `ProveedorTienda.tsx:34-55`.
- **Por qué importa:** cliente decidido que no logra comprar y no sabe por qué.
- **Cómo arreglarlo:** cuando el error sea por total distinto y `vigentes` no cambie nada, llamar `router.refresh()` o indicar "Recarga la página para ver el total actualizado"; idealmente devolver también el costo de envío vigente.
- **Esfuerzo:** S.

#### C-13 — Política de datos en texto provisional y sin forma de "olvidar mis datos"
- **Severidad:** MEDIA
- **Qué pasa:** `/politica-de-datos` dice "Texto provisional: pendiente de revisión legal antes de abrir la tienda". El checkout obliga a aceptarla (Ley 1581). Además se guardan en localStorage, sin caducidad, nombre, celular, cédula/NIT, dirección y el último pedido completo (`ev-cliente`, `ev-ultimo-pedido`), sin opción de borrarlos ni de "no recordar", en equipos que pueden ser compartidos (café internet, computador del negocio).
- **Dónde:** `src/app/(tienda)/politica-de-datos/page.tsx`; `FormularioCheckout.tsx:114-128`; `src/lib/ultimo-pedido.ts:35-40`.
- **Por qué importa:** riesgo legal (RNF-09) y de privacidad de clientes reales.
- **Cómo arreglarlo:** revisión legal del texto con responsable y canal de reclamos; casilla "Recordar mis datos en este dispositivo" (apagada por defecto) y borrar `ev-ultimo-pedido` tras unos días; no guardar la cédula.
- **Esfuerzo:** M (legal) / S (código).

#### C-14 — No hay pruebas E2E del flujo de compra
- **Severidad:** MEDIA
- **Qué pasa:** `tests/e2e/` está vacío (RNF-13 lo exige). Las pruebas unitarias cubren precios, fechas, carrito y mensaje, pero nadie prueba la Server Action `crearPedido`, la función SQL, ni el flujo carrito → checkout → confirmación con el navegador.
- **Dónde:** `tests/e2e/` (vacío); sin prueba de `src/app/(tienda)/checkout/actions.ts`.
- **Por qué importa:** los bugs C-03, C-04, C-08 y C-11 son justo de los que se ven solo recorriendo el flujo.
- **Cómo arreglarlo:** un Playwright mínimo: agregar producto, cambiar cantidad escribiendo, elegir zona, enviar, ver confirmación, verificar el enlace `wa.me`; y una prueba de integración de `crear_pedido` (límite 5, zona inactiva, cuentas que no cuadran).
- **Esfuerzo:** L.

---

### BAJAS

#### C-15 — El mensaje de WhatsApp se recorta a ~20 productos y no incluye el documento
- **Severidad:** BAJA
- **Qué pasa:** `armarMensajePedido` corta el texto en 1.500 caracteres y escribe "… y N productos más (ver el pedido EV-…)"; con líneas de ~70 caracteres caben unas 20. Probé con una línea tipo: 22 líneas dan ~1.840 caracteres y ~3.140 una vez codificado en la URL; los 1.500 recortados quedan ~2.600, aceptable para wa.me. El mensaje no trae cédula/NIT ni sector (solo lugar). La referencia sí va dentro de la dirección.
- **Dónde:** `src/lib/whatsapp.ts:60-103`; `checkout/actions.ts:186-200`.
- **Por qué importa:** el despachador debe abrir el panel para pedidos grandes; es manejable pero conviene que lo sepa. Sin número configurado el enlace es `wa.me/?text=` (el cliente elige a quién escribir), pero hoy el número SÍ está configurado.
- **Cómo arreglarlo:** dejar claro en la capacitación que el panel es la fuente de verdad; opcional: incluir documento si existe y subir el límite a ~2.500 caracteres.
- **Esfuerzo:** S.

#### C-16 — Caracteres de control o saltos de línea en nombre/notas/dirección
- **Severidad:** BAJA
- **Qué pasa:** `checkoutSchema` solo hace `trim` y largo máximo. Llamando la acción directamente se pueden meter saltos de línea o texto con formato (`*`, `_`) que se inyectan en el mensaje (por ejemplo, una línea falsa "Total: $1"). El mensaje además es editable por el propio cliente en WhatsApp. En el panel React escapa el HTML, así que no hay XSS.
- **Dónde:** `src/lib/validaciones/pedido.ts:16-24, 48-61`; `whatsapp.ts:61-69`.
- **Por qué importa:** confusión al despachador si lee solo el mensaje; no hay daño directo porque el total real está en la base.
- **Cómo arreglarlo:** en `texto()`/`textoOpcional()` reemplazar `\r\n\t` y caracteres de control por espacio (excepto en `notas`, donde se pueden conservar saltos pero eliminar el resto), y no tomar totales del mensaje como verdad.
- **Esfuerzo:** S.

#### C-17 — El campo trampa puede bloquear en silencio a una persona real
- **Severidad:** BAJA
- **Qué pasa:** si un autocompletado o extensión llena `#web`, el esquema marca error en `web`, pero ese error no se pinta en ninguna parte (solo `nombre`, `celular`, etc.) y `errorGeneral` queda vacío: el botón "Confirmar pedido" parece no hacer nada.
- **Dónde:** `FormularioCheckout.tsx:67-79, 183-187`; `validaciones/pedido.ts:60`.
- **Por qué importa:** clientes que "no pueden comprar" sin mensaje.
- **Cómo arreglarlo:** poner un nombre/atributos menos autocompletables (p. ej. `name="sitio_alterno"`, `autoComplete="new-password"` no; mejor `data-lpignore`) y, si falla `web`, mostrar un mensaje general "No pudimos procesar tu pedido. Recarga la página e inténtalo de nuevo".
- **Esfuerzo:** S.

#### C-18 — La fecha del carrito se calcula con el reloj del dispositivo y no se refresca
- **Severidad:** BAJA
- **Qué pasa:** `resolverEntrega(..., new Date(), ...)` se evalúa en el navegador dentro de un `useMemo` sin dependencia del tiempo. Un dispositivo con hora mal puesta, o una pestaña abierta pasada la hora de corte, muestra una fecha distinta de la que calcula el servidor al confirmar; la confirmación sí muestra la fecha del servidor.
- **Dónde:** `src/components/tienda/carrito/useResumenCarrito.ts:27-30`; `checkout/actions.ts:88`.
- **Por qué importa:** diferencia de un día entre lo mostrado y lo prometido; reclamos menores.
- **Cómo arreglarlo:** recalcular al montar el checkout y en el envío; si la fecha del servidor difiere de la mostrada, informarlo antes de crear el pedido (o mostrar "fecha estimada").
- **Esfuerzo:** S.

#### C-19 — Sin tope razonable por línea ni confirmación de cantidades enormes
- **Severidad:** BAJA
- **Qué pasa:** la cantidad máxima por línea es 9.999 y `total_visto` hasta 1.000 millones; no hay monto máximo ni aviso. Un 9 de más al teclear ("120" → "1200") crea un pedido de millones sin advertencia.
- **Dónde:** `src/lib/carrito.ts:13`; `validaciones/pedido.ts:43, 66`.
- **Por qué importa:** pedidos absurdos que el despachador debe depurar a mano.
- **Cómo arreglarlo:** confirmar en el checkout cuando una línea supere un umbral (p. ej. 500 unidades o $5.000.000) y bajar `MAX_CANTIDAD_ITEM` a un valor realista.
- **Esfuerzo:** S.

#### C-20 — IP de origen: confía en el primer valor de `x-forwarded-for`
- **Severidad:** BAJA
- **Qué pasa:** `ipDeOrigen` toma el primer elemento de `x-forwarded-for`. En Vercel este encabezado lo reescribe la plataforma con la IP del cliente, así que es correcto; si algún día se pone otro proxy delante (Cloudflare, etc.) o se hospeda en otro lado, el cliente podría falsear la IP y saltarse el límite por IP. No pude verificarlo en producción (no hay despliegue).
- **Dónde:** `src/app/(tienda)/checkout/actions.ts:42-46`.
- **Por qué importa:** el límite por IP es la defensa principal (ver C-07).
- **Cómo arreglarlo:** usar `x-vercel-forwarded-for`/`x-real-ip` con prioridad y documentar que la app debe ir directo en Vercel; probar con un pedido real después del despliegue que `pedidos.ip_origen` guarda una IP pública.
- **Esfuerzo:** S.

#### C-21 — La confirmación de bodega no dice dónde ni a qué hora recoger
- **Severidad:** BAJA
- **Qué pasa:** para "Recoger en bodega" la pantalla dice "Lo puedes recoger el …" pero no muestra la dirección ni el horario de la bodega (están en `config.empresa`, solo se usan en el pie). Tampoco hay forma de consultar luego el estado del pedido (por diseño, para proteger la privacidad: `/pedido/[numero]` no devuelve datos de la base).
- **Dónde:** `ConfirmacionPedido.tsx:84-96`; `src/lib/tienda/config.ts:22-27`.
- **Por qué importa:** llamadas innecesarias y clientes que llegan fuera de horario.
- **Cómo arreglarlo:** mostrar `empresa.direccion` y `empresa.horarios` cuando el lugar sea "Recoger en bodega" e incluirlos en el mensaje de WhatsApp.
- **Esfuerzo:** S.

#### C-22 — Accesibilidad menor en carrito y checkout
- **Severidad:** BAJA
- **Qué pasa:** (a) el texto que explica por qué el botón "Confirmar" está deshabilitado (`bloqueo`) no está enlazado al botón con `aria-describedby`; (b) el botón "Finalizar pedido" bloqueado es un `<span aria-disabled>` no enfocable, sin anunciar el motivo a lectores de pantalla (el motivo sí está en un párrafo cercano); (c) los `avisos` usan `role="status"` bien, pero no hay resumen de errores ni foco al primer campo con error en errores del servidor (los de cliente sí enfocan vía react-hook-form); (d) si el servidor devuelve un error de `items`, el mensaje general dice "Revisa los datos marcados" sin que haya nada marcado.
- **Dónde:** `FormularioCheckout.tsx:96-105, 217-227, 142`; `ContenidoCarrito.tsx:114-130`.
- **Por qué importa:** WCAG 2.1 AA (RNF-06) y claridad.
- **Cómo arreglarlo:** `aria-describedby` hacia el párrafo de motivo, mover el foco a `role="alert"` cuando aparezca `errorGeneral`, y mensaje específico para errores sin campo.
- **Esfuerzo:** S.

#### C-23 — `createAdminClient` solo protege con una comprobación en tiempo de ejecución
- **Severidad:** BAJA
- **Qué pasa:** `src/lib/supabase/admin.ts` no importa `"server-only"`; solo lanza un error si `window` existe. La clave de servicio no se importa hoy desde componentes de cliente (verificado en esta ruta: `actions.ts` es `"use server"`), pero un import accidental desde un componente cliente se detectaría tarde.
- **Dónde:** `src/lib/supabase/admin.ts:1-20`.
- **Por qué importa:** defensa en profundidad de la `SERVICE_ROLE_KEY` (CLAUDE.md §3.5). Nota: `server-only` ya se usa en `lib/tienda/vigentes.ts`.
- **Cómo arreglarlo:** añadir `import "server-only";` al inicio (el paquete ya está en uso, no es una dependencia nueva).
- **Esfuerzo:** S.

---

## 3) Lo que está bien

- **El servidor recalcula todo (RN-06):** `crearPedido` recibe solo ids y cantidades, lee precios y disponibilidad frescos de la base (sin caché) y compara contra `total_visto`; si difiere, no crea nada y devuelve los datos nuevos. `crear_pedido` en SQL vuelve a verificar que las cuentas cuadren, la zona esté activa y el envío coincida (`checkout/actions.ts:64-128`, `0011…sql:98-165`).
- **Cálculo de precios limpio y probado:** enteros COP, mayor solo si es estrictamente más barato (RN-04), ambas reglas de mayoreo (cantidad/monto/ambas) y el pedido mínimo se comparan igual en cliente y servidor (`precios.ts`); 65 pruebas pasan, incluida fecha en America/Bogota.
- **Función `crear_pedido` bien blindada:** transaccional, `search_path=''`, ejecución revocada a `anon`/`authenticated` y comprobación de rol, límite RN-13, snapshot de ítems (RN-08) y copia del costo (RN-15) en la misma transacción; confirmé en la base remota que está desplegada la versión de 0011.
- **Privacidad de `/pedido/[numero]`:** la pantalla de confirmación sale del navegador de quien pidió, no de la base; el número consecutivo no permite ver datos ajenos. El formato del número se valida (`^EV-\d{6}$`) y la página no se indexa.
- **Carrito en localStorage resistente:** `skipHydration`, `sanitizarItems/Ubicación` descartan datos dañados o alterados, `almacenSeguro` tolera storage bloqueado, y el servidor nunca confía en lo guardado.
- **Validación Zod compartida cliente/servidor** (celular colombiano normalizado, documento, límites de longitud, `acepta_datos` obligatorio) y errores del servidor mapeados a campos.
- **El carrito se revalida al abrirse** y avisa de cambios de precio, agotados y productos retirados; "Agotado" bloquea el avance (RN-12).
- **Mensaje de WhatsApp completo y seguro de enviar:** trae productos, cantidades, precio unitario, ahorro, envío, total, dirección con referencia, fecha corta y forma de pago; el texto va con `encodeURIComponent`, se recorta de forma controlada y el pedido siempre queda guardado aunque WhatsApp no abra (con botones de copiar).
