# Auditoría 04 — Gestión de pedidos y reparto

Alcance: `src/app/admin/(panel)/pedidos/**`, `zonas/**`, `src/app/admin/imprimir/[id]`, `src/components/admin/pedidos/**`, `FilaSector`, `FormularioSector`, `src/lib/{pedidos,filtros-pedidos,entregas,ubicacion}.ts`, `validaciones/zonas.ts`, y las migraciones `0010`/`0011` (funciones `cambiar_estado_pedido`, `editar_items_pedido`, vista `v_pedidos_admin`).
Método: solo lectura del código real. No se tocó la base de datos de producción: lo que depende de datos (zonas, festivos, número de WhatsApp, perfiles) se marca como "verificar en producción". Las pruebas `pedidos-admin` y `entregas` pasan (31/31), pero solo cubren lógica pura; las funciones SQL y las pantallas no tienen ninguna prueba (`tests/e2e` está vacío).

---

## 1) Resumen

1. **Veredicto: se puede operar mañana, pero solo si el administrador hace casi todo el trabajo y el equipo acepta varios atajos manuales.** No hay un fallo que tumbe el flujo `nuevo → confirmado → en preparación → despachado → entregado`; las reglas de estado, el motivo al cancelar y el historial funcionan y están protegidos en la base de datos.
2. **Lo que más duele en la operación diaria:** (a) nadie recibe aviso de un pedido nuevo; depende de que el cliente envíe el WhatsApp o de que alguien abra el panel; (b) el pedido no se puede reprogramar ni corregir (fecha, dirección, sector), y un pedido atrasado desaparece de la vista "Por ruta"; (c) no hay hoja de ruta ni consolidado de productos, y la orden de alistamiento se imprime de a una; (d) los botones "Despachado" y "Entregado" no piden confirmación ni se pueden deshacer, y un pedido despachado que no se entrega no tiene salida.
3. **Roles:** el sistema solo tiene admin / editor / vendedor. No existe bodeguero ni repartidor: el editor solo mira, y los pedidos "recoge en bodega" solo los puede mover el admin. Hay además un hueco SQL (P-10) que deja a un vendedor cambiar el estado de esos pedidos si llama la función directamente.
4. **Antes de abrir (datos, no código):** el `seed.sql` deja todos los municipios inactivos, sin número de WhatsApp, sin festivos y con la hora de corte vacía (se usa 17:00 por defecto). Si eso no se configuró en producción, el cliente no puede elegir zona y el botón "Enviar por WhatsApp" no tiene destino (P-12).
5. **Conteo:** 0 bloqueantes · 7 altas · 13 medias · 12 bajas (32 hallazgos). P-12 pasa a bloqueante si los datos de arranque no están cargados en producción.

---

## 2) Hallazgos

### ALTA

#### P-01 — Un pedido no se puede reprogramar ni corregir; el atrasado desaparece de la ruta
- **Severidad:** ALTA
- **Qué pasa:** Las únicas dos acciones sobre un pedido son cambiar de estado y cambiar cantidades de ítems. No existe ninguna forma de cambiar la fecha de entrega, el sector, la dirección, las notas ni de agregar un producto. Además, la vista "Por ruta" solo muestra pedidos cuya `fecha_entrega_estimada` es exactamente el día elegido. Si un pedido no sale el día previsto (camión lleno, lluvia, cliente ausente), no aparece en la ruta de ningún otro día.
- **Dónde:** `src/app/admin/(panel)/pedidos/actions.ts:33-78` (solo `cambiarEstadoPedido` y `editarItemsPedido`); `src/app/admin/(panel)/pedidos/page.tsx:57` (`.eq("fecha_entrega_estimada", entregaRuta)`); `supabase/migrations/0010_pedidos_admin.sql:389-393` (la edición solo toca subtotal, descuento y total).
- **Por qué importa:** En reparto de última milla lo normal es mover entregas. Hoy el administrador tiene que cancelar y pedirle al cliente que vuelva a pedir, o dejar el pedido con una fecha falsa. Un pedido "confirmado" con fecha de ayer queda fuera de la planificación y se puede olvidar (solo se ve si alguien filtra la lista por estado).
- **Cómo arreglarlo:** (1) Una función SQL `reprogramar_pedido(id, fecha, nota)` (admin y vendedor del sector) que cambie `fecha_entrega_estimada`, `direccion_entrega` y `notas` y escriba una fila en `pedido_historial`. (2) En la vista "Por ruta", agregar al día elegido los pedidos "atrasados" (fecha menor a hoy y estado no final) en un bloque rojo "Atrasados". (3) Botones "Hoy / Mañana / Próximo día con pedidos".
- **Esfuerzo:** M

#### P-02 — No existen los roles "bodega" y "repartidor"; el vendedor puede hacerlo todo en su sector
- **Severidad:** ALTA
- **Qué pasa:** El enum de roles es `admin`, `editor`, `vendedor`. Quien alista y quien reparte tienen que ser un vendedor (con sectores asignados a mano) o el admin. El editor solo mira. El vendedor puede confirmar, despachar, entregar y cancelar pedidos de sus sectores. Los pedidos "recoge en bodega" no tienen sector, así que el vendedor ni los ve ni los mueve; solo el admin. Un sector nuevo no se asigna solo a nadie.
- **Dónde:** `supabase/migrations/0001_init.sql:25`; `src/lib/permisos.ts:105-110`; `src/lib/pedidos.ts:69-77`; `supabase/migrations/0002_rls.sql:374-380`; `0010_pedidos_admin.sql:274-278`.
- **Por qué importa:** Un repartidor que solo debería marcar "entregado" puede, si es vendedor, cancelar un pedido en preparación. El bodeguero que solo debería pasar a "en preparación/despachado" no tiene rol propio. Los recogidos en bodega dependen siempre del admin.
- **Cómo arreglarlo:** Mínimo viable sin cambiar el modelo: documentar que bodega y repartidor son "vendedor" con todos los sectores, y que cancelar queda a cargo del admin (restringir `cancelado` a admin en `cambiar_estado_pedido`). Mejor: agregar el rol `bodega` (ve todos los pedidos, solo `confirmado→en_preparacion→despachado`, incluye los de bodega) y `repartidor` (ve despachados, solo `→entregado`). Requiere migración nueva y actualizar `docs/` (regla 6 del CLAUDE.md).
- **Esfuerzo:** L

#### P-03 — Cambios de estado de un clic, sin confirmación y sin deshacer
- **Severidad:** ALTA
- **Qué pasa:** El botón grande "Marcar como despachado" / "Marcar como entregado" ejecuta el cambio en el mismo clic y está justo encima de "Cancelar pedido…". No hay diálogo de confirmación. Después no hay forma de volver atrás: el flujo es estrictamente hacia adelante y `entregado` es final. El administrador no tiene botón para corregir.
- **Dónde:** `src/components/admin/pedidos/AccionesPedido.tsx:72-77` (`onClick={() => cambiar(siguiente)}`); `src/lib/pedidos.ts:32-37, 61-63`; `0010_pedidos_admin.sql:280-286`.
- **Por qué importa:** En un celular, con guantes o en la calle, un toque equivocado marca como entregado un pedido que aún va en el camión. Queda en el historial como entregado y suma a las ventas y la ganancia. Hoy solo se corrige con SQL manual.
- **Cómo arreglarlo:** (1) Confirmación de dos pasos para `despachado` y `entregado` ("¿Marcar EV-000123 como entregado? Total a cobrar $ X"). (2) Función `revertir_estado_pedido` solo para admin (un paso atrás, con motivo obligatorio y fila en historial). (3) Separar visualmente el botón de cancelar.
- **Esfuerzo:** M

#### P-04 — Un pedido "despachado" no tiene salida si no se entrega
- **Severidad:** ALTA
- **Qué pasa:** Desde `despachado` solo se puede pasar a `entregado`. No se puede cancelar ni marcar "no entregado / cliente ausente / rechazó / devuelto a bodega". Además `despachado` no cuenta como "pendiente" en el tablero.
- **Dónde:** `0010_pedidos_admin.sql:284` (`when 'despachado' then p_estado = 'entregado'`); `src/lib/pedidos.ts:52-54` (`puedeCancelarse` excluye despachado); `src/lib/pedidos.ts:85`.
- **Por qué importa:** El camión sale con 20 pedidos y 2 vuelven (cliente cerrado, sin plata, rechaza la mercancía). Hoy el equipo tiene que marcarlos "entregado" (falso; inflan la venta y la ganancia del mes, porque `resumen_costos` solo excluye `cancelado`) o dejarlos "despachado" para siempre, y desaparecen de todos los contadores.
- **Cómo arreglarlo:** Permitir `despachado → cancelado` con motivo ("rechazado", "no estaba") o agregar el estado `no_entregado` que devuelve a `confirmado` para reprogramar. Incluir `despachado` en `ESTADOS_PENDIENTES` como "en reparto".
- **Esfuerzo:** M

#### P-05 — Nadie se entera de un pedido nuevo (ni se evita perder uno)
- **Severidad:** ALTA
- **Qué pasa:** El pedido se guarda en la base y la pantalla de confirmación solo ofrece un botón para que el **cliente** envíe el WhatsApp. No hay aviso al equipo (correo, WhatsApp automático, Realtime, sonido) ni actualización automática del panel. Si el cliente no pulsa el botón, el pedido queda como "nuevo" sin que el negocio sepa que existe. Tampoco hay alerta de "pedido nuevo sin atender hace más de X horas".
- **Dónde:** `src/app/(tienda)/checkout/actions.ts:131-168` (se crea y no se notifica); `src/components/tienda/checkout/ConfirmacionPedido.tsx:46-50, 74`; `src/app/admin/(panel)/page.tsx:75-78, 119-131` (contadores sin refresco); no hay `realtime`/`subscribe`/correo en `src/`.
- **Por qué importa:** Es la forma de perder ventas: el cliente cree que pidió, el negocio nunca lo vio. También ocurre al revés: mensajes de WhatsApp sin pedido en el panel, o pedidos "fantasma" (hechos por curiosidad o spam, hasta 5 por 10 minutos) que se alistan sin que el cliente los haya enviado.
- **Cómo arreglarlo:** Lo más pequeño: en `crearPedido`, después del RPC, enviar un correo o un aviso (Resend, o un webhook a un grupo de WhatsApp/Telegram) con número, cliente, zona y total. Complemento barato: `router.refresh()` cada 60 s en la lista y el inicio, y un contador "N nuevos sin confirmar" en el menú. Regla de proceso: "nuevo" = aún no confirmado con el cliente; nada se alista hasta confirmar.
- **Esfuerzo:** M (con servicio de correo: instalar dependencia, pedir permiso)

#### P-06 — Imprimir es de a un pedido; no hay hoja de ruta ni consolidado de productos
- **Severidad:** ALTA
- **Qué pasa:** `/admin/imprimir/[id]` solo imprime un pedido. En la vista "Por ruta", el botón "Imprimir la ruta" llama `window.print()` sobre la propia página del panel: imprime el formulario de filtros y las pestañas "Lista / Por ruta" (solo el menú lateral se oculta) y la lista trae número, cliente, teléfono, dirección y total, pero no los productos. No hay "imprimir todas las órdenes de esta ruta" ni "total de cada producto a cargar" (cuántas unidades de lentejas para todo el sector).
- **Dónde:** `src/app/admin/imprimir/[id]/page.tsx:28-107`; `src/app/admin/(panel)/pedidos/page.tsx:108, 149` (filtros y botón sin `print:hidden`); solo hay 3 usos de `print:` en todo `src/` (`BarraAdmin.tsx:68, 89`, `BotonImprimir.tsx:9`).
- **Por qué importa:** Con 15 a 30 pedidos por día el bodeguero tendría que abrir e imprimir 30 hojas una por una, y el repartidor no tiene una hoja única con el orden de paradas, el teléfono, el total a cobrar de cada parada y el total de la ruta.
- **Cómo arreglarlo:** (1) Ruta `/admin/imprimir/ruta?entrega=AAAA-MM-DD&sector=N` que imprima todas las órdenes (una por hoja, `break-after: page`) y al inicio un consolidado "producto → unidades totales" agrupado por categoría. (2) Hoja de reparto del repartidor: una fila por parada con dirección, referencia, teléfono, total a cobrar, casilla "cobrado" y subtotal por sector. (3) Ocultar filtros y pestañas con `print:hidden`.
- **Esfuerzo:** L

#### P-09 — Al editar un pedido se borra lo que el cliente pidió originalmente
- **Severidad:** ALTA
- **Qué pasa:** Poner cantidad 0 hace `delete` de la fila del ítem, y cambiar una cantidad sobrescribe la anterior. El historial solo guarda el texto "Pedido editado: <motivo>", sin qué ítems, qué cantidades ni qué total había antes.
- **Dónde:** `0010_pedidos_admin.sql:364-370` (delete/update), `395-398` (historial solo con el motivo).
- **Por qué importa:** Ante un reclamo ("pedí 12 y me cobraron 8") el sistema no tiene prueba de lo original. Va contra el espíritu de RN-08 (snapshot) y RN-10 (no se borra). Solo queda el WhatsApp del cliente.
- **Cómo arreglarlo:** En la misma función, armar el texto del historial con el detalle ("Lentejas 400 g: 12 → 8; Arroz 500 g: quitado; total $ 84.000 → $ 62.000"), o marcar el ítem como `cantidad_original`/`anulado` en lugar de borrarlo. Lo más pequeño es lo primero (concatenar al campo `nota`).
- **Esfuerzo:** S

### MEDIA

#### P-07 — La orden de alistamiento no trae lo que necesita el bodeguero y el repartidor
- **Severidad:** MEDIA
- **Qué pasa:** La hoja trae número, estado, fecha y zona, cliente y celular, dirección, notas, y por producto: casilla, nombre y presentación, SKU y cantidad. Faltan: total a cobrar contraentrega (es "sin precios" a propósito, pero no hay otra hoja con el total), la referencia del lugar (solo se ve en el detalle), la categoría o ubicación (el modelo de datos no tiene ubicación; los productos salen en orden alfabético), peso o bultos estimados, y datos de control (impreso por, hora, "armado por / revisado por").
- **Dónde:** `src/app/admin/imprimir/[id]/page.tsx:41` (orden por `nombre_producto`), `58-76` (cabecera sin total ni referencia), `78-102`.
- **Por qué importa:** El bodeguero recorre la bodega por pasillos, no por abecedario; el repartidor necesita saber cuánto cobrar y cómo llegar. Si el pedido se edita después de imprimirlo, la hoja en papel queda desactualizada sin aviso.
- **Cómo arreglarlo:** Agregar a la cabecera "Cobrar contraentrega: $ X" (opcional según rol), "Referencia: …", la fecha y hora de impresión y "Última edición: …" (tomada del historial); ordenar por categoría (join con variantes/productos). Si hace falta ubicación física, es una columna nueva (cambio de modelo: proponer primero).
- **Esfuerzo:** M

#### P-08 — Estilos de impresión mínimos: sin tamaño de hoja, sin control de saltos de página
- **Severidad:** MEDIA
- **Qué pasa:** No hay `@page`, ni `@media print` en `globals.css`, ni `break-inside: avoid` en las filas. En una hoja con muchos productos una fila puede partirse entre dos páginas. Cada hoja de pedido no trae número de página. La página tiene `p-6` fijo y `max-w-3xl`; funciona, pero el tamaño carta y los márgenes quedan a criterio del navegador.
- **Dónde:** `src/app/admin/imprimir/[id]/page.tsx:47, 78-102`; `src/app/globals.css` (sin reglas de impresión).
- **Por qué importa:** Legibilidad y desperdicio de papel; una fila partida confunde al bodeguero.
- **Cómo arreglarlo:** `@page { size: letter; margin: 12mm }`, `tr { break-inside: avoid }`, `thead { display: table-header-group }`, y `.hoja { break-after: page }` cuando se imprima más de un pedido.
- **Esfuerzo:** S

#### P-10 — Hueco en `cambiar_estado_pedido`: un vendedor puede mover pedidos "recoge en bodega"
- **Severidad:** MEDIA
- **Qué pasa:** La comprobación de permiso es `if not (rol = 'admin' or (rol = 'vendedor' and sector_id = any (sectores_del_usuario())))`. Cuando el pedido no tiene sector (recoge en bodega), `sector_id = any(...)` da NULL (cualquier comparación con NULL), `NOT NULL` es NULL y el `if` no se cumple: **no se lanza el error** y el cambio procede. La función es `security definer`, así que no la frena el RLS que sí oculta esos pedidos al vendedor. La interfaz lo esconde (`puedeCambiarEstado` lo trata bien y hay una prueba de ello), pero la regla de la UI y la de la base no coinciden.
- **Dónde:** `supabase/migrations/0010_pedidos_admin.sql:274-278`; la intención correcta está en `src/lib/pedidos.ts:75` y `tests/unit/pedidos-admin.test.ts:61`.
- **Por qué importa:** Un vendedor (usuario interno, pero con acceso a la API con su sesión) podría confirmar o cancelar pedidos de bodega adivinando el id (son consecutivos). Rompe la matriz de permisos §6 y la defensa en profundidad que el proyecto promete (RNF-07).
- **Cómo arreglarlo:** Migración nueva (no editar la 0010): reemplazar la condición por `coalesce(v_pedido.sector_id = any(...), false)` o `v_pedido.sector_id is not null and ...`.
- **Esfuerzo:** S

#### P-11 — El corte de las 5 p. m. se mide contra un día en que nadie trabaja
- **Severidad:** MEDIA
- **Qué pasa:** La regla es "hasta la hora de corte del **día anterior** al reparto". Si el día anterior es domingo o un festivo, el corte se evalúa igual ese día (a las 17:00) aunque la bodega esté cerrada. Ejemplo: un sector con reparto el lunes recibe pedidos hasta el domingo a las 5 p. m., y el equipo no los ve hasta el lunes, el mismo día de la entrega. Lo mismo con un martes posterior a un lunes festivo. Además, un pedido hecho a las 4:59 p. m. entra para mañana: no hay "tiempo mínimo de alistamiento".
- **Dónde:** `src/lib/entregas.ts:81-89` (`diaDelCorte = sumarDias(candidata, -1)` sin mirar si es hábil); `96-106` (la bodega ignora la hora de corte).
- **Por qué importa:** Se prometen fechas que la operación no puede cumplir, y el cliente lo nota. Las pruebas no cubren este caso.
- **Cómo arreglarlo:** Calcular el "día de corte" como el último día hábil anterior (no domingo, no festivo, según `diasBodega` y `diasNoHabiles`); y, si se quiere, una hora de corte más temprana para el día previo a un fin de semana. Agregar pruebas para domingo, lunes festivo y sábado.
- **Esfuerzo:** S

#### P-12 — Datos de arranque que bloquean la tienda si no se configuraron (verificar en producción)
- **Severidad:** MEDIA (sube a BLOQUEANTE si no están cargados el día de abrir)
- **Qué pasa:** El `seed.sql` deja los 12 municipios **inactivos**, `whatsapp_pedidos = null`, `hora_corte = null` (el código usa 17:00 por defecto sin avisar) y `dias_no_habiles = []` (no hay festivos de Colombia cargados). Sin sectores activos el cliente solo puede "recoger en bodega"; sin número, el botón "Enviar por WhatsApp" abre `wa.me/?text=` sin destinatario. Los festivos hay que escribirlos a mano en `/admin/config` (solo ahí; la bodega siempre se asume abierta lunes a sábado: `diasBodega` está fijo en código).
- **Dónde:** `supabase/seed.sql:23-36, 44, 49-50`; `src/lib/tienda/config.ts:61`; `src/components/tienda/checkout/ConfirmacionPedido.tsx:46-50`; `src/lib/entregas.ts:20`.
- **Por qué importa:** Es lo primero que se rompe el día de salida: fechas de entrega equivocadas en festivos, clientes sin zona, mensajes sin destino. La memoria del proyecto ya señala "faltan zonas reales y número de WhatsApp".
- **Cómo arreglarlo:** Lista de verificación de salida: activar municipios y crear sectores con sus días y costo; cargar el WhatsApp; fijar la hora de corte; cargar los festivos de 2026 y 2027 (Ley Emiliani); y que `/admin/zonas` o el inicio muestren un aviso rojo "Falta configurar: WhatsApp / zonas / hora de corte".
- **Esfuerzo:** S

#### P-13 — Zonas: falta la vista previa "Si piden hoy, reciben el…" (RF-29, Must)
- **Severidad:** MEDIA
- **Qué pasa:** La pantalla de zonas lista municipios y sectores y permite editarlos, pero no calcula ni muestra la fecha de entrega resultante de cada sector. La función ya existe (`fechaEntregaSector`).
- **Dónde:** `src/app/admin/(panel)/zonas/page.tsx:50-113` y `src/components/admin/FilaSector.tsx:27-29` (solo muestra días y envío).
- **Por qué importa:** El administrador no puede comprobar que lo que configuró da la fecha que espera (por ejemplo, tras cargar festivos o cambiar la hora de corte) sin hacer un pedido de prueba.
- **Cómo arreglarlo:** En `FilaSector` mostrar "Si piden hoy: jueves 26 de noviembre" usando `fechaEntregaSector(new Date(), s.dias_reparto, config)` con la configuración de `/admin/config` (es un Server Component; no requiere cliente).
- **Esfuerzo:** S

#### P-14 — Desactivar o cambiar un sector no avisa de los pedidos que ya están en él
- **Severidad:** MEDIA
- **Qué pasa:** Al desactivar un sector, un municipio, o cambiar sus días de reparto o costo, no se consulta cuántos pedidos pendientes tiene. Lo que sí funciona: la tienda deja de ofrecerlo, el servidor vuelve a validar al crear el pedido (`activo` en sector y municipio), los pedidos existentes conservan su sector y su fecha, y el panel puede seguir mostrándolos (el staff ve los inactivos por RLS). Pero los pedidos con fecha vieja no se actualizan ni se avisa. Además `alternarSector`/`alternarMunicipio` invierten el valor leído, no fijan uno: dos clics de dos administradores se anulan.
- **Dónde:** `src/app/admin/(panel)/zonas/actions.ts:89-111, 134-156`; `src/components/admin/FilaSector.tsx:42-47`; `FilaSector.tsx:52` (el texto dice "sin pedidos ni clientes", pero los clientes quedan con sector nulo, no bloquean el borrado: `0001_init.sql:224`).
- **Por qué importa:** Se puede cerrar un sector con 8 pedidos confirmados para el jueves sin darse cuenta de que hay que reubicarlos.
- **Cómo arreglarlo:** Antes de desactivar o cambiar días, contar pedidos no finales del sector y mostrarlos ("Hay 8 pedidos pendientes aquí. ¿Continuar?"); mostrar ese conteo junto a cada sector; que el botón envíe el valor deseado (`activo=false`) en lugar de alternar.
- **Esfuerzo:** M

#### P-15 — Datos del cliente en el pedido cambian después: la referencia no es una copia
- **Severidad:** MEDIA
- **Qué pasa:** El pedido guarda su propia `direccion_entrega`, pero el nombre, el negocio, la cédula/NIT y la **referencia** se leen en vivo de `clientes`. Cada pedido nuevo del mismo celular sobrescribe esos datos (RN-11). Un pedido pendiente o ya entregado muestra entonces la referencia y el nombre del último pedido.
- **Dónde:** `0011_costos_inventario.sql:167-184` (el `on conflict … do update`); `src/app/admin/(panel)/pedidos/[id]/page.tsx:64-67, 171` (lee `clientes.referencia`); `0010_pedidos_admin.sql:200-236` (vista que une `clientes`).
- **Por qué importa:** Un tendero con dos locales y un solo celular hace dos pedidos el mismo día; el repartidor del primero recibe la referencia del segundo. Y un pedido entregado cambia de nombre meses después.
- **Cómo arreglarlo:** Guardar `referencia` (y el nombre/negocio tal como se escribieron) en el propio pedido (columna nueva, cambio de modelo: proponer y documentar) y mostrar esa. Mientras tanto, concatenar la referencia a `direccion_entrega` al crear el pedido.
- **Esfuerzo:** M

#### P-16 — Detalle del pedido en celular: lo que más usa el repartidor queda al final y no hay llamar ni mapa
- **Severidad:** MEDIA
- **Qué pasa:** En pantallas menores de 1024 px, la columna derecha (tarjeta "Estado del pedido" con los botones, y el historial) va después de productos, ganancia, cliente, entrega y notas. El repartidor tiene que bajar toda la pantalla para marcar "entregado". El celular del cliente es texto plano (sin `tel:`), no hay enlace de mapa para la dirección, y el botón de WhatsApp es el único modo de contacto. El mensaje de WhatsApp es siempre el mismo saludo genérico (no avisa "va en camino").
- **Dónde:** `src/app/admin/(panel)/pedidos/[id]/page.tsx:116-194` (orden de las columnas), `159` (`Celular: {p.celular}`), `81` (mensaje fijo). `grep tel:|maps` en `src/` sin resultados.
- **Por qué importa:** La interfaz del repartidor es el celular, de pie. Cada paso extra es una entrega más lenta o un error (ver P-03).
- **Cómo arreglarlo:** En móvil, subir la tarjeta de estado y la de entrega justo bajo el encabezado (`order-first` en la columna derecha, o una barra fija inferior con el botón de avanzar); enlace `tel:+57…` y botón "Abrir en mapas" (`https://www.google.com/maps/search/?api=1&query=dirección+municipio`); mensaje de WhatsApp según el estado.
- **Esfuerzo:** M

#### P-17 — Vista "Por ruta": faltan totales por sector, mezcla estados y el día por defecto puede no tener reparto
- **Severidad:** MEDIA
- **Qué pasa:** (a) Cada sector muestra solo número de pedidos y unidades; no el valor por cobrar del sector ni los bultos. (b) El total "por cobrar" suma todos los pedidos del día salvo los cancelados, incluyendo los ya entregados y los "nuevos" sin confirmar (que también pueden ser pedidos falsos). (c) No hay filtro de estado en la ruta. (d) La fecha por defecto es "mañana" aunque mañana no sea día de reparto (viernes → sábado, sábado → domingo), y no hay botones "anterior / siguiente día". (e) El corte silencioso de 500 pedidos no avisa. (f) El orden dentro del sector es por número de pedido, sin orden de paradas; no se ven las notas ni los productos.
- **Dónde:** `src/app/admin/(panel)/pedidos/page.tsx:53, 56-59, 139-140, 153-160, 162-177`.
- **Por qué importa:** "Planificar el reparto de mañana" es el uso principal de esta vista. Hoy responde "cuántos pedidos", pero no "cuánto debo recoger de plata en cada sector" ni "cuáles aún no están confirmados".
- **Cómo arreglarlo:** En el encabezado de cada sector sumar `total` y `n_unidades`; marcar con insignia los pedidos `nuevo` y excluirlos del "por cobrar" (o mostrar dos cifras: confirmado y sin confirmar); agregar un select de estado; el día por defecto = el próximo día con pedidos; botones de día anterior/siguiente.
- **Esfuerzo:** M

#### P-18 — Tablero de inicio: tarjeta mal enlazada y sin lo que importa para operar
- **Severidad:** MEDIA
- **Qué pasa:** "Pedidos pendientes" cuenta nuevos + confirmados + en preparación, pero el enlace abre `?estado=nuevo`, que solo muestra los nuevos: la cifra de la tarjeta y la lista no coinciden. No hay indicador de "entregas de mañana", "atrasados", "despachados sin cerrar" ni "nuevos sin confirmar hace más de N horas". El tablero no se refresca solo.
- **Dónde:** `src/app/admin/(panel)/page.tsx:75-78, 126-131`.
- **Por qué importa:** El administrador abre el panel por la mañana y no ve de un vistazo qué hay que hacer hoy. Un vendedor ve lo suyo (RLS lo aplica correctamente: ver P-26), pero con las mismas tarjetas.
- **Cómo arreglarlo:** Corregir el enlace (por ejemplo `?estado=…` múltiple o una vista "Pendientes") y agregar tarjetas "Para entregar mañana" (enlace a ruta), "Atrasados" y "En reparto".
- **Esfuerzo:** M

#### P-19 — Transiciones sin nota y sin registro del cobro contraentrega
- **Severidad:** MEDIA
- **Qué pasa:** Solo "Cancelar" pide texto. Al despachar o entregar no se puede dejar una nota ("lo recibió la esposa", "pagó $ 50.000 con billete de $ 100.000"), ni registrar cuánto se cobró, ni si el pago coincidió con el total. La edición de ítems exige motivo, pero el cierre no.
- **Dónde:** `src/components/admin/pedidos/AccionesPedido.tsx:50-62, 72-77` (solo manda `nota` al cancelar); `0010_pedidos_admin.sql:296` (la nota existe en la función, pero la UI no la usa para avanzar).
- **Por qué importa:** El dinero entra en efectivo contraentrega. Sin un campo de "cobrado" no se puede cuadrar la caja del repartidor al final del día.
- **Cómo arreglarlo:** Campo opcional "Nota" al avanzar de estado (la función SQL ya lo soporta). Para el cobro: en la confirmación de "entregado" (P-03) pedir "¿Cobraste $ X? Sí / Otro valor".
- **Esfuerzo:** S (nota) / M (cobro; sería una columna nueva)

#### P-20 — La edición de ítems conserva precios viejos y no deja agregar productos
- **Severidad:** MEDIA (decisión de negocio a confirmar)
- **Qué pasa:** Al subir o bajar la cantidad se conserva el precio con que se cobró cada unidad. Si el cliente baja de 12 a 6, sigue pagando precio por mayor; si sube de 6 a 12, no se le aplica el mayor. No se pueden agregar productos ni crear pedidos manuales (un cliente que llama por teléfono). Solo el admin puede editar; el vendedor que habla con el cliente por WhatsApp no puede.
- **Dónde:** `0010_pedidos_admin.sql:312` (comentario "conserva el precio"), `367-369`; `EditorItemsPedido.tsx:138`; `src/lib/pedidos.ts:79-82`.
- **Por qué importa:** Es una decisión de negocio razonable, pero genera discusiones con el cliente y trabajo del administrador. Está bien documentada en pantalla.
- **Cómo arreglarlo:** Preguntar al dueño qué prefiere. Si se quiere recalcular, usar `lib/precios.ts` en el servidor. Mínimo: permitir al vendedor editar cantidades de sus pedidos nuevos.
- **Esfuerzo:** M

### BAJA

#### P-21 — Lista de pedidos: faltan pestañas por estado y la búsqueda es limitada
- **Severidad:** BAJA
- **Qué pasa:** Solo hay un select de estado, sin conteos por estado. La búsqueda cubre número, nombre, negocio y celular; no la dirección ni el sector, y el celular escrito con espacios o puntos ("310 123 4567") no encuentra nada porque en la base están sin separadores. El orden es fijo (más recientes primero) y no se puede ordenar por fecha de entrega o total. En 375 px la tabla de 6 columnas se desplaza en horizontal. La búsqueda recorre `texto_busqueda` con `ILIKE '%…%'` sin índice (aceptable al principio).
- **Dónde:** `src/lib/filtros-pedidos.ts:88-95`; `0010_pedidos_admin.sql:224-227`; `pedidos/page.tsx:61-70`; `TablaPedidos.tsx:27-60`.
- **Por qué importa:** Es el atajo diario de quien atiende llamadas.
- **Cómo arreglarlo:** Quitar espacios y puntos en `textoParaBuscar` cuando la búsqueda parezca un celular; pestañas "Nuevos (3) · Confirmados · …" con conteo; en móvil mostrar tarjetas en lugar de tabla (la vista por ruta ya lo hace).
- **Esfuerzo:** S–M

#### P-22 — Concurrencia: protegida en la base, pero el mensaje es crudo y la pantalla se queda vieja
- **Severidad:** BAJA
- **Qué pasa:** Lo bueno: `cambiar_estado_pedido` y `editar_items_pedido` hacen `for update`, así que dos cambios simultáneos se serializan y el segundo falla con un error claro, sin corromper nada. Lo malo: el error muestra los valores internos (`No se puede pasar un pedido de "en_preparacion" a "confirmado"`), la pantalla no se actualiza sola, y la edición de cantidades no verifica que los ítems sigan como el editor los vio (la última escritura gana, aunque solo con las líneas modificadas).
- **Dónde:** `0010_pedidos_admin.sql:269, 288-289, 345`; `pedidos/actions.ts:20-24`.
- **Por qué importa:** Dos personas en la misma tarea verán un mensaje técnico y no sabrán qué hizo la otra.
- **Cómo arreglarlo:** Traducir los estados con `ETIQUETA_ESTADO` en el mensaje y, ante este error, hacer `router.refresh()` automático con el texto "Otra persona ya cambió este pedido; te mostramos el estado actual".
- **Esfuerzo:** S

#### P-23 — Orden imprimible de un pedido cancelado o sin confirmar sin advertencia
- **Severidad:** BAJA
- **Qué pasa:** La hoja siempre se puede imprimir; el estado aparece solo como texto pequeño. Un pedido cancelado se imprime igual que uno válido.
- **Dónde:** `src/app/admin/imprimir/[id]/page.tsx:50-54`.
- **Por qué importa:** El bodeguero puede alistar un pedido ya cancelado o aún no confirmado.
- **Cómo arreglarlo:** Banner grande "CANCELADO — NO ALISTAR" / "SIN CONFIRMAR" según el estado.
- **Esfuerzo:** S

#### P-24 — El historial oculta quién hizo cada cambio a todos menos al admin
- **Severidad:** BAJA
- **Qué pasa:** Solo el admin puede leer `perfiles`, así que el vendedor y el editor ven "Equipo EV" en lugar del nombre.
- **Dónde:** `pedidos/[id]/page.tsx:68-71, 214`.
- **Por qué importa:** Entre vendedores no se sabe quién despachó qué. No es un riesgo de seguridad.
- **Cómo arreglarlo:** Guardar el nombre en `pedido_historial` al escribir la fila, o una vista mínima `v_nombres_equipo`.
- **Esfuerzo:** S

#### P-25 — Cualquier administrador puede saltarse el flujo con una escritura directa
- **Severidad:** BAJA
- **Qué pasa:** `authenticated` tiene `UPDATE` sobre `pedidos` y la política `pedidos_actualizar_admin` deja actualizar cualquier columna a un admin. Un admin desde la consola del navegador puede pasar un pedido de `nuevo` a `entregado`, o cambiar la fecha o la dirección. El disparador del historial sí registra el cambio de estado. No es explotable por otros roles.
- **Dónde:** `supabase/migrations/0002_rls.sql:183, 381-384`.
- **Por qué importa:** El flujo de estados que se vigila en la función SQL puede esquivarse por otra puerta.
- **Cómo arreglarlo:** Revocar `UPDATE` de `pedidos` a `authenticated` y dejar solo las funciones (más P-01 cuando se agregue `reprogramar_pedido`).
- **Esfuerzo:** S

#### P-26 — Lo que ve un vendedor: bien aplicado, pero sin aviso si no tiene sectores
- **Severidad:** BAJA
- **Qué pasa:** RLS filtra los pedidos, los ítems, el historial y los clientes por sector (`pedidos_leer`, `clientes_leer` corregida en 0010), y la vista usa `security_invoker`. La interfaz no avisa si el vendedor no tiene sectores asignados (ve listas vacías); el selector de sector de los filtros le muestra todos los sectores; los sectores nuevos no se asignan solos a nadie.
- **Dónde:** `0002_rls.sql:374-380`; `0010_pedidos_admin.sql:180-193, 200-236`; `pedidos/page.tsx:42-50`.
- **Por qué importa:** "No me aparece nada" es el reclamo más probable en la primera semana.
- **Cómo arreglarlo:** Si el vendedor no tiene sectores, mostrar "Aún no tienes sectores asignados; pídele al administrador que te los asigne". Al crear un sector, recordar asignarlo en Usuarios.
- **Esfuerzo:** S

#### P-27 — Fecha de entrega: la que ve el cliente en el carrito se calcula con el reloj de su teléfono
- **Severidad:** BAJA
- **Qué pasa:** Carrito y checkout calculan la fecha en el navegador (`new Date()`); el servidor la recalcula al crear el pedido. Los textos coinciden (`textoFechaEntrega`, `textoFechaCorta`, `formatFechaDia`) y el servidor manda, pero el servidor compara solo el total, no la fecha. Si el cliente vio "jueves" a las 4:59 p. m. y envía a las 5:01 p. m., el pedido sale para la semana siguiente y solo se entera en la pantalla final. Con el reloj del teléfono desfasado pasa lo mismo.
- **Dónde:** `src/components/tienda/carrito/useResumenCarrito.ts:27`; `checkout/actions.ts:88-128`.
- **Por qué importa:** Una promesa de fecha que cambia sin aviso.
- **Cómo arreglarlo:** Enviar la `fecha_vista` desde el checkout y devolver `falla("La fecha de entrega cambió a …")` si difiere, igual que con el total. Y mostrar la fecha del servidor en la confirmación (ya se hace).
- **Esfuerzo:** S

#### P-28 — Recoger en bodega: reglas fijas en código y sin hora de atención
- **Severidad:** BAJA
- **Qué pasa:** Los días de bodega (lunes a sábado) están en `CONFIG_ENTREGA_POR_DEFECTO` y no se pueden cambiar desde el panel. La fecha de recogida es siempre "el siguiente día hábil", ignora la hora de corte, y no dice a qué hora se puede recoger.
- **Dónde:** `src/lib/entregas.ts:17-21, 94-107`; `checkout/actions.ts:92`; `src/app/(tienda)/layout.tsx:41`.
- **Por qué importa:** Si la bodega no abre el sábado, el sistema igual lo ofrece.
- **Cómo arreglarlo:** Agregar `dias_bodega` y `horario_bodega` a `/admin/config` y leerlos en `obtenerConfigTienda`.
- **Esfuerzo:** M

#### P-29 — Detalles menores de zonas y accesibilidad
- **Severidad:** BAJA
- **Qué pasa:** (a) No se pueden crear ni renombrar municipios desde el panel; solo activar o desactivar los 12 del seed (suficiente para el Quindío, pero no está documentado). (b) `invalidarTienda()` se llama antes de guardar y también cuando la validación falla; en la ventana entre la invalidación y la escritura una visita puede volver a guardar datos viejos en la caché. (c) El `id` de cada grupo de la ruta se arma con el título ("g-Calarcá – Centro"), con espacios: `aria-labelledby` lo interpreta como varios ids y el lector de pantalla no lee el nombre del grupo. (d) La descripción del borrado de sectores dice que hay que no tener clientes, y no es así.
- **Dónde:** `zonas/actions.ts:33, 91, 116, 136`; `pedidos/page.tsx:153-154`; `FilaSector.tsx:52`; `0001_init.sql:224`.
- **Por qué importa:** Pequeños tropiezos.
- **Cómo arreglarlo:** Mover `invalidarTienda()` después de un guardado correcto; usar el índice del grupo como `id`; corregir el texto.
- **Esfuerzo:** S

#### P-30 — Las funciones SQL de pedidos no tienen pruebas y no hay pruebas E2E
- **Severidad:** BAJA
- **Qué pasa:** `tests/unit/pedidos-admin.test.ts` y `entregas.test.ts` prueban solo lógica pura en TypeScript; la carpeta `tests/e2e` está vacía. Nada prueba `cambiar_estado_pedido`, `editar_items_pedido` ni las políticas RLS por rol. Por eso el hueco de P-10 no lo detectó ninguna prueba, aunque el test de la UI dice "nunca en bodega sin sector".
- **Dónde:** `tests/unit/pedidos-admin.test.ts:61-66`; `tests/e2e/` vacío.
- **Por qué importa:** Es el módulo con más dinero y más reglas de permisos.
- **Cómo arreglarlo:** Un script SQL de pruebas (con pgTAP o consultas con `set local role`) para los 3 roles y los casos: salto de estado, cancelar sin motivo, vendedor en sector ajeno y en pedido de bodega, edición en estado no editable, ítems en 0.
- **Esfuerzo:** M

#### P-31 — El pedido no refleja cuándo y por qué cambió su fecha en el aviso al cliente
- **Severidad:** BAJA
- **Qué pasa:** "Escribir al cliente" manda siempre el mismo saludo; no hay plantillas por estado ("tu pedido EV-… sale hoy", "no pudimos entregarte"), ni se registra en el historial que se contactó al cliente.
- **Dónde:** `pedidos/[id]/page.tsx:81, 100-109`; `src/lib/pedidos.ts:87-94`.
- **Por qué importa:** Cada vendedor redacta a mano; se pierde la trazabilidad de qué se le dijo al cliente.
- **Cómo arreglarlo:** Plantillas por estado en `lib/whatsapp.ts` (texto con número de pedido, fecha y total).
- **Esfuerzo:** S

#### P-32 — Pedido sin peso ni número de bultos para cargar el vehículo
- **Severidad:** BAJA
- **Qué pasa:** Los ítems no guardan el peso de la variante (`peso_g` existe en `variantes`, pero no se copia al pedido) y las vistas no muestran peso ni bultos por pedido o ruta.
- **Dónde:** `0010_pedidos_admin.sql:152-166` (columnas del snapshot); `pedidos/page.tsx:139-140`.
- **Por qué importa:** El conductor no sabe si la carga cabe en la moto o el camión.
- **Cómo arreglarlo:** Mostrar peso total aproximado (join con `variantes.peso_g` mientras exista el enlace) en la ruta y en la hoja de reparto.
- **Esfuerzo:** M

---

## 3) Lo que está bien

- **Flujo de estados protegido en la base de datos.** `cambiar_estado_pedido` impone las transiciones válidas, bloquea la fila (`for update`), exige motivo al cancelar (también en el disparador) y verifica rol y sector (con la excepción de P-10). La UI solo decide qué botones mostrar.
- **Historial completo (RN-09).** Cada cambio de estado y cada edición de ítems escribe usuario, fecha y nota; el disparador cubre incluso la creación del pedido. Los pedidos no se pueden borrar (RN-10).
- **RLS por sector bien aplicado.** `pedidos`, `pedido_items`, `pedido_historial` y `clientes` filtran por sector para el vendedor, la vista `v_pedidos_admin` usa `security_invoker`, y los costos y la ganancia nunca llegan al vendedor.
- **Edición de ítems cuidadosa.** Solo admin, solo en nuevo/confirmado, motivo obligatorio, cantidad 0 quita la línea, no permite dejar el pedido vacío (pide cancelarlo) y recalcula subtotal, ahorro por mayor y total con el precio realmente cobrado, respetando la restricción `total = subtotal − descuento + envío`.
- **Fechas en hora de Bogotá, bien resueltas.** `entregas.ts` es lógica pura con pruebas, usa UTC−5 sin depender del servidor, valida días inválidos y la tienda, el panel, la impresión y el mensaje de WhatsApp usan los mismos textos de fecha.
- **El servidor manda al crear el pedido.** Recalcula precios, costo de envío, zona activa y fecha, y rechaza si el total que vio el cliente cambió; límite de 5 pedidos por celular o IP cada 10 minutos.
- **Lista y ruta bien pensadas para empezar.** Filtros en la URL (se pueden compartir), parámetros saneados, paginación con redirección si la página no existe, fechas "desde/hasta" interpretadas en hora de Bogotá, y vista por ruta agrupada por sector con "recoge en bodega" al final y totales generales.
- **Interfaz cuidada:** botones de 44 px o más, etiquetas en todos los campos, motivo de cancelación visible, el menú lateral se oculta al imprimir y el botón "Imprimir" no sale en la hoja.
