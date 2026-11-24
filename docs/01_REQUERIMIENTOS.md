# Especificación de Requerimientos — Plataforma Catálogo EV Distribuidora

> Versión 1.0 · 8 de noviembre de 2026
> Complementa `00_DOCUMENTO_MADRE.md`. Prioridades: **M** = imprescindible en el MVP, **D** = deseable en el MVP, **F2/F3** = fases posteriores.

---

## 1. Glosario

| Término | Significado |
|---|---|
| **Producto** | Artículo base. Ej.: "Lentejas Doña Lupe" |
| **Variante / Presentación** | Versión vendible de un producto con SKU propio. Ej.: "250 g · Individual", "400 g · Individual" |
| **Contenido** | Cantidad neta: 460 g, 1 L, 15 tabletas |
| **Unidad de venta** | Cómo se despacha: Individual, Paquete x12, Display x18, Caja x24 |
| **Precio unidad** | Precio normal de la variante |
| **Precio por mayor** | Precio rebajado que se aplica al cumplir la regla de mayoreo |
| **Sector** | Zona dentro de un municipio con un día fijo de reparto |
| **Hora de corte** | Hora límite para que un pedido entre en la siguiente ruta |

---

## 2. Requerimientos funcionales — Tienda pública

### RF-01 Página de inicio · M
- Barra superior con mensaje configurable (ej.: "Compra por mayor y ahorra")
- Encabezado con logo, buscador, carrito con contador y botón de WhatsApp
- Carrusel de 1 a 5 banners administrables
- Bloques: categorías principales (con ícono o imagen), "Ofertas" y "Nuevos"
- Pie de página con contacto, dirección, horarios y enlaces legales

### RF-02 Catálogo y listado · M
- Rejilla de tarjetas: 2 columnas en móvil, 3 en tablet y 4 en escritorio
- Paginación del lado del servidor (24 por página) o "cargar más"
- Ordenar por: relevancia, nombre A-Z, precio menor a mayor, precio mayor a menor, más recientes
- La URL refleja filtros, búsqueda, orden y página (`/catalogo?cat=granos&marca=dona-lupe&page=2`), para poder compartir el enlace
- **Criterio:** solo se listan productos activos con al menos una variante activa y con `precio_unidad`

### RF-03 Tarjeta de producto · M
- Imagen principal (relación 1:1, carga diferida)
- Etiquetas: **Oferta** (rojo), **Agotado** (gris), **Nuevo**
- Nombre, marca y presentación por defecto
- **Precio unidad** y, si existe, **"Por mayor: $X desde N und."** destacado en dorado
- Botón "Agregar". Si el producto tiene varias variantes, abre un selector rápido
- Si está agotado, el botón queda deshabilitado

### RF-04 Búsqueda · M
- Buscador en el encabezado, con sugerencias mientras se escribe a partir de 2 caracteres (debounce de 300 ms)
- Busca en nombre de producto, marca, categoría y SKU
- **Ignora tildes y mayúsculas** ("jabon" encuentra "Jabón") y tolera errores menores ("lenteja" ≈ "lentejas", "colgte" ≈ "Colgate")
- Si no hay resultados, muestra un mensaje con sugerencias y el botón "Pregúntanos por WhatsApp"

### RF-05 Filtros · M
Panel lateral en escritorio y hoja inferior (drawer) en móvil:
- **Categoría → subcategoría** (árbol, con conteo de productos)
- **Marca** (casillas, con buscador si hay más de 10)
- **Rango de precio**
- **Solo ofertas** y **Solo disponibles**
- Botón "Limpiar filtros" y chips con los filtros activos

### RF-06 Detalle de producto · M
- Galería de imágenes
- Nombre, marca, categoría y descripción
- **Selector de presentación**: cada variante muestra contenido, unidad de venta y precios
- Selector de cantidad con mensaje de mayoreo: "Lleva 12 o más y paga $X c/u"
- Ficha técnica: SKU, peso y dimensiones (si existen)
- Sección "Productos relacionados" (misma subcategoría)

### RF-07 Ubicación del pedido · M
- Selector **Municipio → Sector**, o casilla **"Recogeré en bodega"**
- Muestra: **"Tu pedido llega el jueves 12 de noviembre"**
- Se pide la primera vez que el cliente agrega algo al carrito (o desde el encabezado) y queda guardado en el navegador
- **Criterio:** la fecha es la próxima ocurrencia del `dia_reparto` del sector. Si ya pasó la `hora_corte` del día anterior, se usa la siguiente semana. Para recoger en bodega, se usa el siguiente día hábil

### RF-08 Carrito · M
- Panel lateral (drawer) y página `/carrito`
- Lista de ítems con imagen, nombre, presentación, cantidad editable (+/-), precio aplicado (unidad o mayor) y subtotal
- **Barra de resumen fija:** subtotal, ahorro por mayor, total y progreso hacia el pedido mínimo ("Te faltan $12.000 para el pedido mínimo")
- Se guarda en `localStorage` y sobrevive al recargar la página
- Al abrir el carrito se revalidan los precios y la disponibilidad contra el servidor. Si algo cambió, se avisa al cliente

### RF-09 Checkout · M
- Formulario: **nombre**, **celular** (validación colombiana: 10 dígitos, empieza por 3), nombre del negocio (opcional), cédula o NIT (opcional), **dirección**, barrio o referencia, municipio y sector (precargados), notas
- Método de pago: **Contraentrega** (único en el MVP)
- Resumen del pedido y fecha estimada
- Aceptación de la política de tratamiento de datos (Ley 1581 de 2012)
- Si el celular ya existe, se precargan los datos del cliente (después de confirmarlo)

### RF-10 Confirmación y WhatsApp · M
1. El servidor valida, **recalcula los precios** y crea el pedido con el número `EV-000123`
2. Se muestra la pantalla "¡Pedido recibido!" con el número y el resumen
3. Botón **"Enviar por WhatsApp"**, que abre `https://wa.me/57XXXXXXXXXX?text=...` con este mensaje:
```
*Pedido EV-000123*
Cliente: Juan Pérez – Tienda La Esquina
Cel: 3101234567
Entrega: Calarcá – Barrio Centro · jueves 12/11
Dirección: Cra 25 # 30-12

1. Lentejas Doña Lupe 400 g x12 – $3.200 c/u = $38.400 (mayor)
2. Atún La Soberana 140 g x6 – $5.900 c/u = $35.400

Subtotal: $78.900
Ahorro por mayor: $4.800
*Total: $74.100*
Pago: contraentrega
```
4. Se vacía el carrito
- **Criterio:** si WhatsApp no se abre, el pedido ya quedó guardado igual y el número se puede copiar

### RF-11 Páginas informativas · D
Contáctanos, Preguntas frecuentes, Política de datos, Términos y condiciones.

### RF-12 Botón flotante de WhatsApp · M
Visible en toda la tienda, con un mensaje inicial configurable.

---

## 3. Requerimientos funcionales — Panel administrativo (`/admin`)

### RF-20 Autenticación y roles · M
- Login con correo y contraseña, y recuperación de contraseña
- Roles: `admin`, `editor` y `vendedor` (ver la matriz en la sección 6)
- Sesión protegida por middleware. Las rutas de `/admin` requieren rol

### RF-21 Dashboard · M
- Tarjetas: pedidos nuevos de hoy, pedidos pendientes, productos sin precio, productos sin imagen
- Lista de los últimos 10 pedidos

### RF-22 Categorías · M
- CRUD con 2 niveles (categoría y subcategoría), nombre, slug automático, ícono o imagen, orden (arrastrar y soltar) y activa sí/no
- No se puede eliminar una categoría que tenga productos (solo desactivarla o reasignar sus productos)

### RF-23 Marcas · M
- CRUD con nombre, slug y logo opcional

### RF-24 Productos · M
- **Listado tipo tabla profesional:** imagen miniatura, nombre, marca, categoría, número de variantes, rango de precio, estado y fecha
  - Búsqueda, filtros (categoría, marca, estado, **sin precio**, **sin imagen**), orden y paginación
  - Acciones masivas: activar, desactivar, cambiar categoría, marcar oferta
- **Formulario:** nombre, descripción, categoría y subcategoría, marca, etiquetas, destacado, nuevo, activo
- **Variantes dentro del mismo formulario** (tabla editable):
  - SKU (único; se autogenera si viene vacío, ej. `EV-00001-01`)
  - Contenido: valor + unidad (g, kg, ml, L, und, tabletas, cm, m)
  - Unidad de venta: Individual, Paquete, Display, Caja, Bolsa + unidades por empaque
  - Peso de envío (g) y dimensiones alto × ancho × largo (cm)
  - **Precio unidad**, **precio por mayor**, **cantidad mínima para mayor**
  - En oferta sí/no + precio de oferta
  - Disponible sí/no (agotado)
  - Imagen propia (opcional) y orden
- **Imágenes:** subir varias, arrastrar para ordenar y marcar la principal. Compresión automática a WebP (máx. 1200 px, < 200 KB) y miniatura de 400 px
- Duplicar producto
- **Criterio:** se puede guardar un producto **sin precio**. Queda en estado "Borrador / sin precio" y no se muestra en la tienda

### RF-25 Edición rápida de precios · M
- Vista tipo hoja de cálculo: una fila por variante, con columnas SKU, producto, presentación, precio unidad, precio mayor, cantidad mínima, oferta y disponible
- Se edita directamente en la celda, se guarda por lotes y se resaltan los cambios sin guardar
- Filtro "Solo sin precio" para la carga inicial de precios

### RF-26 Importación / exportación masiva · M
- **Importar productos** (Excel .xlsx o CSV) con una plantilla descargable
- Flujo: subir archivo → **vista previa con validación** (filas válidas, con advertencias o con errores) → confirmar → resumen (creados, actualizados, omitidos)
- Coincidencia por **SKU**: si existe, se actualiza; si no, se crea
- **Importar solo precios** (SKU + precio unidad + precio mayor + cantidad mínima)
- **Exportar** el catálogo completo a Excel (sirve también como copia de seguridad)
- Cada importación queda registrada (usuario, fecha y resultado)
- Carga inicial: `data/catalogo_jd_borrador.csv`, revisado y llevado al formato de la plantilla

### RF-27 Pedidos · M
- Tabla: número, fecha, cliente, celular, municipio/sector, fecha de entrega, total y estado
- Filtros por estado, fecha, sector y fecha de entrega. Búsqueda por número, nombre o celular
- Detalle: datos del cliente, ítems (snapshot), totales, notas e **historial de estados**
- **Estados:** `nuevo → confirmado → en_preparacion → despachado → entregado` / `cancelado` (con motivo obligatorio, también desde `despachado`). Un `despachado` que no se entregó vuelve a `confirmado` con motivo («no entregado») para reprogramarse (migración 0013)
- **Reprogramar:** mover la fecha de entrega, corregir la dirección o las notas mientras el pedido no haya salido (`nuevo`, `confirmado`, `en_preparacion`); motivo obligatorio y fila en el historial. Los pedidos de fechas pasadas que siguen abiertos aparecen como «Atrasados» en la vista por ruta
- Pasar a `despachado` o `entregado` pide confirmación (no tiene vuelta atrás)
- **Aviso de pedido nuevo:** correo (Resend) a los destinatarios configurados y, en el panel, insignia con el número de pedidos `nuevo` y sonido opcional
- Editar cantidades o quitar ítems mientras el pedido esté en `nuevo` o `confirmado` (se recalcula el total y queda registro)
- Botón "Escribir al cliente por WhatsApp"
- **Imprimir o descargar en PDF** el pedido como **orden de alistamiento** (para el bodeguero) · D
- Vista "Pedidos por ruta": pedidos de un día de reparto agrupados por sector · D

### RF-28 Clientes · D
- Listado de clientes creados desde los pedidos (por celular), con datos y número de pedidos

### RF-29 Zonas de entrega · M
- CRUD de municipios y sectores: nombre, municipio, **día de reparto** (uno o varios días), costo de envío (opcional, por defecto 0) y activo
- Vista previa: "Si piden hoy, reciben el…"

### RF-30 Configuración · M
- Número de WhatsApp de pedidos y mensaje del botón flotante
- **Pedido mínimo** (COP)
- **Regla de mayoreo:** `por_cantidad` (por variante) | `por_monto` (todo el pedido supera $X) | `ambas`
- Hora de corte y días no hábiles o festivos
- Banners (imagen, enlace, orden y activo) y mensaje de la barra superior
- Datos de la empresa: nombre, NIT, dirección, horarios y redes sociales

### RF-31 Usuarios del panel · M (solo admin)
- Invitar usuario por correo, asignar rol, desactivar

### RF-32 Costos, ganancia e inventario informativo · M (admin y editor)
- **Costo por variante** (COP enteros, con IVA, igual que los precios) y **existencias** (`stock`). Se guardan en una tabla aparte y protegida (`variante_costos`): la tienda pública y el vendedor **nunca** los ven
- **Ganancia y margen:** `ganancia = precio_unidad − costo` y `margen % = ganancia / precio_unidad`. Se muestran en la edición rápida de precios y se resalta en rojo cuando el precio queda **por debajo del costo**
- **Ganancia de cada pedido:** al crear el pedido se guarda una copia del costo de cada línea (`pedido_item_costos`), de modo que la ganancia de un pedido viejo no cambia si el costo sube después. Se ve en el detalle del pedido y en el dashboard (solo admin y editor)
- **Importación:** el modo "solo precios" acepta las columnas opcionales `costo` y `stock`. Una celda vacía no borra lo que ya está guardado
- **Pantalla `/admin/inventario`:** existencias por variante, filtros "sin stock" y "poco stock", y **valor del inventario** (`stock × costo`)
- **El stock es informativo:** se actualiza al importar o al editarlo a mano. **No se descuenta solo** al despachar pedidos, ni marca "agotado" automáticamente (eso queda para la Fase 2)
- El stock puede ser negativo (el sistema contable del negocio lo permite); se muestra con una alerta

---

## 4. Reglas de negocio

| ID | Regla |
|---|---|
| RN-01 | Un producto es visible si `activo = true`, su categoría está activa y tiene al menos 1 variante con `activo = true` y `precio_unidad > 0` |
| RN-02 | **Mayoreo por cantidad:** si la cantidad de la variante es ≥ `cantidad_min_mayor` y existe `precio_mayor`, se usa `precio_mayor` |
| RN-03 | **Mayoreo por monto:** si el subtotal a precio unidad es ≥ `umbral_mayor_monto`, todas las variantes con `precio_mayor` usan ese precio |
| RN-04 | Si la variante está en oferta, se usa `precio_oferta`, salvo que el precio por mayor aplicable sea menor; siempre se aplica **el menor** |
| RN-05 | Los precios se guardan en **pesos enteros** (COP, sin decimales), en columnas `integer` |
| RN-06 | El servidor recalcula todos los precios. Si difieren de lo que muestra el cliente, se usa el del servidor y se le avisa |
| RN-07 | El número de pedido es consecutivo y único: `EV-` + secuencia de 6 dígitos |
| RN-08 | `pedido_items` guarda una copia del nombre, la presentación, el SKU, el precio aplicado y el tipo de precio |
| RN-09 | Todo cambio de estado de un pedido registra el usuario, la fecha y una nota en `pedido_historial` |
| RN-10 | No se borran pedidos, productos con pedidos ni clientes. Se cancelan o desactivan |
| RN-11 | El cliente se identifica por **celular**. Si repite celular, se actualizan sus datos y se vincula el pedido |
| RN-12 | Una variante marcada como agotada no se puede agregar al carrito |
| RN-13 | Límite anti-abuso: máximo 5 pedidos por celular o IP cada 10 minutos |
| RN-14 | **Costos privados:** el costo y el stock viven en `variante_costos` y `pedido_item_costos`, legibles y editables **solo por admin y editor**. Nunca se exponen a la tienda pública, al vendedor ni a git |
| RN-15 | **Ganancia:** `ganancia = precio − costo` (ambos con IVA, sin ajustes). La ganancia de un pedido usa el costo copiado al crearlo, no el costo actual |
| RN-16 | El stock es **informativo**: no se descuenta con los pedidos ni bloquea ventas. RN-12 sigue dependiendo solo de `variantes.disponible` |

---

## 5. Modelo de datos (PostgreSQL / Supabase)

```
categorias        (id, nombre, slug UNIQUE, parent_id → categorias NULL, icono_url, orden, activa, created_at, updated_at)
marcas            (id, nombre, slug UNIQUE, logo_url, activa)
productos         (id, nombre, slug UNIQUE, descripcion, categoria_id → categorias, marca_id → marcas NULL,
                   etiquetas text[], destacado, es_nuevo, activo, fuente_pagina_pdf int NULL,
                   busqueda tsvector (generada), created_at, updated_at)
variantes         (id, producto_id → productos, sku UNIQUE, nombre_presentacion,
                   contenido_valor numeric NULL, contenido_unidad text NULL,
                   unidad_venta text DEFAULT 'individual', unidades_por_empaque int DEFAULT 1,
                   peso_g int NULL, alto_cm, ancho_cm, largo_cm numeric NULL,
                   precio_unidad int NULL, precio_mayor int NULL, cantidad_min_mayor int NULL,
                   en_oferta bool, precio_oferta int NULL, disponible bool DEFAULT true,
                   imagen_url NULL, orden int, activo bool, created_at, updated_at)
producto_imagenes (id, producto_id, url, url_miniatura, orden, es_principal)

municipios        (id, nombre, departamento DEFAULT 'Quindío', activo)
sectores          (id, municipio_id → municipios, nombre, dias_reparto int[] (1=lun … 7=dom), costo_envio int DEFAULT 0, activo)

clientes          (id, celular UNIQUE, nombre, nombre_negocio, documento, direccion, referencia, sector_id, created_at, updated_at)
pedidos           (id, numero UNIQUE, cliente_id → clientes, sector_id NULL, recoge_en_bodega bool,
                   direccion_entrega, fecha_entrega_estimada date, estado enum_estado_pedido,
                   subtotal int, descuento_mayor int, costo_envio int, total int,
                   metodo_pago DEFAULT 'contraentrega', notas, ip_origen,
                   clave_idempotencia uuid NULL UNIQUE (evita pedidos duplicados al reenviar; migración 0013),
                   acepta_datos_at timestamptz NULL, version_politica text NULL (evidencia del consentimiento, Ley 1581; migración 0013),
                   created_at, updated_at)
pedido_items      (id, pedido_id, variante_id NULL, sku, nombre_producto, presentacion,
                   cantidad int, precio_unitario_aplicado int, precio_base int NULL (precio antes del mayoreo; permite recalcular el ahorro al editar cantidades, migración 0010),
                   tipo_precio ('unidad'|'mayor'|'oferta'), subtotal int)
pedido_historial  (id, pedido_id, estado_anterior, estado_nuevo, usuario_id NULL, nota, created_at)

-- Costos e inventario (RF-32, RN-14 a RN-16; migración 0011). RLS: SOLO admin y editor.
variante_costos   (variante_id PK → variantes ON DELETE CASCADE, costo int NULL (>= 0),
                   stock int NULL (puede ser negativo), stock_actualizado_at timestamptz NULL, updated_at)
pedido_item_costos(pedido_item_id PK → pedido_items ON DELETE CASCADE, costo int NULL (>= 0))
-- Lectura (security_invoker; vacías para quien no sea admin o editor):
--   v_ganancia_pedidos (venta, costo y ganancia por pedido, sin envío), v_inventario_admin (existencias,
--   margen y valor por variante) y la función resumen_costos(p_desde) (ganancia del período y totales
--   del inventario, para el dashboard). Escritura: función guardar_costos(). Migraciones 0011 y 0012.

perfiles          (id = auth.users.id, nombre, rol enum('admin','editor','vendedor'), sectores_asignados int[], activo)
configuracion     (clave text PK, valor jsonb, updated_at, updated_by)
banners           (id, imagen_url, imagen_movil_url, enlace, orden, activo)
importaciones     (id, usuario_id, tipo, archivo_nombre, filas_total, creadas, actualizadas, errores jsonb, created_at)

-- Fase 2 (se crea vacía o se documenta desde ya):
devoluciones      (id, pedido_id, pedido_item_id, cantidad, motivo, evidencia_url, estado, resolucion, created_at)
```

**Índices y extensiones:** `unaccent` y `pg_trgm`; índice GIN sobre `productos.busqueda` y trigram sobre `productos.nombre`; índices en `variantes(producto_id)`, `pedidos(estado, created_at)` y `pedidos(fecha_entrega_estimada)`.

**Vista útil:** `v_catalogo_publico` (producto + variante principal + precio mínimo + imagen principal), filtrada con RN-01.

---

## 6. Matriz de permisos

| Recurso | Público | Vendedor | Editor | Admin |
|---|---|---|---|---|
| Ver catálogo público | ✅ | ✅ | ✅ | ✅ |
| Crear pedido (vía servidor) | ✅ | ✅ | ✅ | ✅ |
| Productos / variantes / precios / imágenes | — | ver | CRUD | CRUD |
| Importar / exportar | — | — | ✅ | ✅ |
| Costos, ganancia e inventario (RF-32) | — | — | ✅ | ✅ |
| Pedidos | — | sus sectores: ver y cambiar estado | ver | todo |
| Zonas, configuración, banners | — | — | banners | ✅ |
| Usuarios | — | — | — | ✅ |

La matriz se implementa con **Row Level Security** en Supabase, más verificaciones en el servidor.

---

## 7. Requerimientos no funcionales

| ID | Categoría | Requerimiento |
|---|---|---|
| RNF-01 | Rendimiento | LCP < 2,5 s en 4G; Lighthouse móvil ≥ 85 en inicio y catálogo |
| RNF-02 | Rendimiento | Imágenes en WebP, con `next/image`, carga diferida y miniaturas en los listados |
| RNF-03 | Rendimiento | Búsqueda con respuesta < 300 ms con 2.000 productos |
| RNF-04 | Usabilidad | Diseño mobile-first; áreas táctiles ≥ 44 px; textos en español colombiano y formato `$ 12.500` |
| RNF-05 | Usabilidad | Un administrador sin experiencia crea un producto con 2 variantes en < 3 minutos |
| RNF-06 | Accesibilidad | WCAG 2.1 AA en contraste y navegación con teclado |
| RNF-07 | Seguridad | RLS activado en **todas** las tablas; la `service_role` key solo se usa en el servidor; validación con Zod en cliente y servidor |
| RNF-08 | Seguridad | Rate limiting en la creación de pedidos (RN-13) y verificación anti-bots en el checkout (honeypot) |
| RNF-09 | Legal | Política de tratamiento de datos (Ley 1581 de 2012) y aviso de privacidad |
| RNF-10 | SEO | Metadatos por página, Open Graph con la imagen del producto, `sitemap.xml`, `robots.txt` y URLs con slug |
| RNF-11 | Disponibilidad | Hosting en Vercel, base de datos con backup diario y exportación a Excel bajo demanda |
| RNF-12 | Mantenibilidad | TypeScript estricto, ESLint + Prettier, migraciones SQL versionadas y tipos generados desde Supabase |
| RNF-13 | Calidad | Pruebas unitarias del cálculo de precios y fechas (Vitest) y pruebas E2E del flujo de compra (Playwright) |
| RNF-14 | Zona horaria | Todas las fechas de reparto en `America/Bogota` |

---

## 8. Historias de usuario principales (con criterios de aceptación)

**HU-01 — Pedir desde el celular.** *Como tendero, quiero armar mi pedido desde el celular para no esperar al vendedor.*
- Dado que elegí "Calarcá – Centro", cuando agrego 12 lentejas de 400 g, veo el precio por mayor aplicado y la fecha de entrega
- Cuando envío el pedido, recibo el número EV-XXXXXX y se abre WhatsApp con el resumen

**HU-02 — Cargar el catálogo sin precios.** *Como administrador, quiero importar todo el catálogo y poner precios después.*
- Dado el archivo de importación, cuando confirmo, se crean los productos en estado "sin precio" y no aparecen en la tienda
- Cuando pongo el precio unidad en la vista rápida, el producto aparece en la tienda de inmediato

**HU-03 — Actualizar precios masivamente.** *Como administrador, quiero subir un Excel con los nuevos precios.*
- Cuando subo el archivo con SKU y precios, veo la vista previa de cambios (precio anterior → precio nuevo) antes de confirmar

**HU-04 — Gestionar pedidos del día.** *Como administrador, quiero ver los pedidos de mañana agrupados por sector para alistarlos.*

---

## 9. Plan de fases de desarrollo

| Fase | Entregable | Depende de |
|---|---|---|
| **F0** | Repositorio, Next.js + TS + Tailwind + shadcn/ui, conexión a Supabase, lint, estructura de carpetas, despliegue inicial en Vercel | — |
| **F1** | Migraciones de la base de datos (sección 5), RLS, roles, auth del panel, layout del admin | F0 |
| **F2** | CRUD de categorías, marcas, productos, variantes e imágenes | F1 |
| **F3** | Importación/exportación + carga del catálogo JD + **edición rápida de precios** | F2 |
| **F4** | Tienda: inicio, catálogo, búsqueda, filtros y detalle | F2 (los datos de F3) |
| **F5** | Zonas, carrito, checkout, creación de pedido y WhatsApp | F4 |
| **F6** | Panel de pedidos, estados, historial, dashboard y configuración | F5 |
| **F7** | QA, pruebas E2E, rendimiento, SEO, páginas legales, dominio y entrega | F6 |

Cada fase termina con: demo funcional, lint y pruebas pasando, y el commit **confirmado por Víctor**.
