# Documento Madre — Plataforma Catálogo EV Distribuidora

> Versión 1.0 · 8 de noviembre de 2026 · Responsable técnico: Víctor
> Este documento es la **fuente de verdad** del proyecto: visión, alcance y decisiones. Los requerimientos detallados están en `01_REQUERIMIENTOS.md`.

---

## 1. Contexto del negocio

**EV Distribuidora** es una distribuidora familiar del Quindío. Su portafolio incluye víveres y despensa, útiles escolares, aseo, cuidado personal, farmacia básica, fiesta, ferretería menor y artículos varios.

Hoy trabajan así:
- Tienen un **catálogo en PDF** (Word → PDF, 345 páginas, actualizado en julio de 2026) con unas **1.700 referencias** con foto, nombre, marca, presentación y unidad de venta. **No incluye precios.**
- Sus **vendedores recorren el Quindío por días y por sectores**, toman pedidos y los reparten.
- **Nunca han usado un sistema.** Todo es manual.

**Objetivo:** pasar del catálogo en PDF a una **plataforma web** donde los clientes armen su pedido desde el celular, lo envíen por WhatsApp y paguen contraentrega. EV Distribuidora administrará productos, precios y pedidos desde un panel profesional.

## 2. Referente: CEMPAC (cempac.co/store)

El cliente pidió algo parecido a la tienda online de CEMPAC (sede Armenia). Este es el análisis de qué se adopta y qué se mejora:

| Característica de CEMPAC | Decisión para EV |
|---|---|
| Selector "Ubicación de pedido" que calcula la fecha estimada de entrega | **Adoptar y mejorar:** municipio + sector → día de reparto real de la ruta del vendedor |
| Casilla "Recogeré el pedido en bodega" | **Adoptar** |
| Dos precios en cada tarjeta ("Con descuento" / "Precio normal") | **Adoptar como precio unidad / precio por mayor**, con el ahorro visible |
| Banner con la regla de descuento y "Valor pedido / Descuento" en vivo | **Adoptar** (barra fija con total y ahorro) |
| Etiquetas "Oferta" y "Disponible" en la tarjeta | **Adoptar** (Oferta, Agotado, Nuevo) |
| Lista larga de categorías con casillas y nombres compuestos ("Audífonos-Calculadoras-USB-…") | **Mejorar:** categoría → subcategoría, más filtros por marca, presentación, precio, ofertas y disponibilidad |
| Un producto distinto por cada tamaño | **Mejorar:** producto con **variantes / presentaciones** (SKU, contenido, unidad de venta y precios propios) |
| Login obligatorio, solo negocios | **Cambiar en el MVP:** pedido **sin registro**, identificando al cliente por su teléfono |
| Botón flotante de WhatsApp sin integración con el pedido | **Mejorar:** el pedido **se guarda con número** (EV-000123) y se abre WhatsApp con el resumen ya armado |
| Más de 3.000 productos | EV tiene ~1.700, así que se necesitan buscador rápido, paginación e imágenes optimizadas |

## 3. Visión del producto

> "Que un tendero de Calarcá pueda armar su pedido de la semana en 5 minutos desde el celular, sepa qué día le llega y cuánto se ahorra al llegar al monto del descuento."

**Principios:**
1. **Celular primero.** Los clientes son tenderos y hogares que usan el teléfono.
2. **Simple para quien nunca ha usado sistemas.** Eso aplica tanto al cliente como al administrador.
3. **El precio que se ve es el precio que se cobra.** El servidor siempre recalcula los precios.
4. **Paso a paso.** El MVP debe estar 100% funcional; lo demás va en fases.

## 4. Usuarios

| Rol | Quién es | Qué hace |
|---|---|---|
| Cliente | Tendero, negocio u hogar | Navega, filtra, arma el carrito y envía el pedido por WhatsApp |
| Administrador | Dueño de EV | Todo: productos, precios, pedidos, zonas, usuarios y configuración |
| Editor | Familiar o empleado | Productos, imágenes y precios; no gestiona usuarios ni configuración |
| Vendedor *(opcional en el MVP)* | Vendedor de ruta | Ve y actualiza el estado de los pedidos de sus sectores |

## 5. Alcance del MVP

### Incluido
**Tienda pública**
- Inicio con banners, ofertas y accesos a categorías
- Catálogo con buscador tolerante a tildes y errores, categorías, subcategorías y filtros
- Tarjeta de producto con precio unidad / precio por mayor, etiquetas y botón para agregar
- Detalle del producto con selector de presentación y cantidad
- Selector de municipio y sector, o recoger en bodega, con fecha estimada de entrega
- Carrito persistente con total, ahorro y pedido mínimo
- Checkout sin registro, con pago contraentrega
- Pedido guardado con número y envío por WhatsApp

**Panel administrativo**
- Login con roles
- CRUD de categorías (2 niveles), marcas, productos, variantes e imágenes
- **Precios:** edición individual, edición rápida en tabla y actualización masiva por Excel
- **Importación masiva** de productos desde Excel/CSV, con vista previa y validación (carga inicial desde el catálogo PDF)
- Gestión de pedidos por estados, con historial
- Zonas: municipios, sectores y día de reparto
- Configuración: WhatsApp, pedido mínimo, descuento por monto, hora de corte y banners

### Fuera del MVP (fases siguientes)
| Fase | Funcionalidad |
|---|---|
| 2 | Devoluciones de productos defectuosos ligadas al pedido, con confirmación (la base de datos se deja preparada desde el MVP) |
| 2 | Cuenta de cliente con historial y opción de "repetir pedido" |
| 2 | Control de inventario **automático**: descontar stock al despachar pedidos, historial de movimientos y "agotado" automático. *(Los costos, la ganancia y el stock **informativo** se adelantaron al MVP: ver RF-32.)* |
| 3 | Reportes de ventas, productos más pedidos y clientes por sector |
| 3 | App o PWA para vendedores con toma de pedidos en ruta |
| 3 | Pagos en línea (Nequi, PSE, Wompi) |

## 6. Decisiones de arquitectura

| Decisión | Elección | Por qué |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | React, que Víctor ya domina; SSR para SEO y velocidad; frontend y backend en un solo repositorio |
| Estilos y UI | **Tailwind CSS + shadcn/ui** | Componentes profesionales y accesibles sin depender de una librería pesada |
| Base de datos | **Supabase (PostgreSQL)** | SQL real, búsqueda de texto completo, Row Level Security y plan gratuito |
| Autenticación | **Supabase Auth** (solo para el panel) | Sin montar un sistema de login propio |
| Imágenes | **Supabase Storage**, con conversión a WebP al subir | ~1.700 fotos; el catálogo debe cargar rápido con datos móviles |
| Hosting | **Vercel** | Despliegue desde GitHub y previews por rama |
| WhatsApp | **Enlace `wa.me` con el mensaje armado** | Gratis y sin aprobación de Meta. La API de WhatsApp Business queda para una fase posterior |
| Pagos | **Contraentrega** | Es como trabaja hoy el negocio |

## 7. Datos del catálogo actual

Del PDF "Portafolio JD — actualización julio" se extrajo un borrador (`data/catalogo_jd_borrador.csv`):
- **~1.686 referencias** (la cifra exacta se confirma al revisar), con **~1.777 imágenes** incrustadas
- Campos por producto: **nombre · marca/detalle · presentación (460 gramos) · unidad de venta (Individual, 12 unidades, Pague 1 lleve 2)**
- **Sin precios.** Los precios se cargan **después de terminar el CRUD**, desde el panel o por Excel

### Propuesta de categorías (validar con el cliente)
Las 33 secciones del PDF se agrupan en 7 categorías principales:

| Categoría | Subcategorías (secciones del PDF) |
|---|---|
| **Víveres y despensa** | Granos y harinas, Enlatados, Condimentos, Dulcería, Adicionales |
| **Útiles escolares y oficina** | Útiles escolares, Pegamentos |
| **Aseo del hogar** | Jabones, Jabones económicos, Esponjas, Escobas, Traperos, Guantes, Bolsas, Plásticos |
| **Cuidado personal** | Cuidado oral, Cuidado capilar (Peines), Desodorantes, Tratamientos, Talcos, Toallas higiénicas, Cuchillas, Implementos de belleza, Cosméticos |
| **Farmacia** | Farmacia (vitaminas y suplementos, botiquín) |
| **Fiesta y velas** | Fiesta, Velas, Velones, Velones con aroma |
| **Hogar y ferretería** | Ferretería, Encendedores, Varios |

> ⚠️ Antes de publicar la categoría **Farmacia**, hay que revisar si incluye productos que requieren registro INVIMA o condiciones especiales de venta.

### Identidad visual
Logo de EV Distribuidora (círculo negro con aro dorado, "EV" en dorado y azul, caja y camión) con **negro, azul, dorado y plata**: azul para acciones (botones), dorado para el precio por mayor y acentos, negro y plata para la estructura. Los tonos exactos se midieron del archivo recibido (`docs/marca/logo-ev-original.webp`) y se confirmarán con la versión vectorial cuando el cliente la entregue.

## 8. Reglas de negocio clave

1. **Producto sin precio = no visible** en la tienda, aunque esté creado. Así se puede cargar el catálogo completo y poner precios poco a poco.
2. Cada **variante** tiene `precio_unidad` y, opcionalmente, `precio_mayor` con su `cantidad_minima_mayor`.
3. El precio por mayor se aplica **automáticamente** según la regla que se configure (ver pregunta abierta #2).
4. **Fecha de entrega:** el próximo día de reparto del sector. Si el pedido llega después de la hora de corte, pasa al siguiente.
5. **Pedido mínimo** configurable. Si no se alcanza, no se puede enviar el pedido.
6. El **servidor recalcula** todos los precios y totales al crear el pedido; nunca se confía en lo que envía el navegador.
7. Los ítems del pedido guardan una **foto (snapshot)** del nombre, la presentación y el precio aplicado. Si el precio cambia después, el pedido no se altera.
8. Los pedidos nunca se borran. Se **cancelan** y queda registro en el historial.

## 9. Preguntas abiertas para el cliente

| # | Pregunta | Impacto |
|---|---|---|
| 1 | ¿Venden solo a negocios o también a clientes finales? | Textos, registro y validación de datos |
| 2 | ~~¿El precio por mayor se activa por cantidad o por monto?~~ **Resuelta (nov-2026):** descuento del **5 %** en compras de **$500.000** o más, sobre todos los productos (RN-03). Ya no hay precio por mayor por producto | Lógica de precios. Configurable en el panel |
| 3 | ¿Hay pedido mínimo? ¿De cuánto? | Checkout |
| 4 | Listado de municipios y sectores, y qué día va el vendedor a cada uno | Tabla de zonas y fecha de entrega |
| 5 | ¿Hora de corte para entrar en la ruta del día siguiente? | Cálculo de la fecha |
| 6 | ¿Número de WhatsApp que recibe los pedidos? | Configuración |
| 7 | ¿"12 unidades" significa que solo se vende el paquete de 12, o también se vende suelto? | Modelo de unidad de venta |
| 8 | ¿Tienen las fotos originales en mejor calidad que las del PDF? | Calidad visual |
| 9 | ¿Tienen dominio propio? ¿Qué nombre quieren? | Despliegue |

## 10. Criterio de "MVP 100% funcional"

El MVP está terminado cuando:
- [ ] El catálogo completo está cargado, con categorías e imágenes
- [ ] El administrador puede crear, editar, desactivar y poner precio a cualquier producto y variante sin ayuda técnica
- [ ] Un cliente puede, desde el celular, buscar, filtrar, armar un carrito, ver la fecha de entrega y enviar el pedido por WhatsApp en menos de 5 minutos
- [ ] El pedido queda guardado con número, y el administrador lo ve y le cambia el estado
- [ ] El catálogo carga en menos de 3 s con 4G (Lighthouse móvil ≥ 85)
- [ ] Está desplegado en Vercel con dominio y HTTPS, con copias de seguridad de la base de datos activas

## 11. Documentos del proyecto

| Archivo | Propósito |
|---|---|
| `docs/00_DOCUMENTO_MADRE.md` | Visión, alcance y decisiones (este documento) |
| `docs/01_REQUERIMIENTOS.md` | Requerimientos funcionales y no funcionales, modelo de datos y criterios de aceptación |
| `docs/02_PROMPT_INICIAL.md` | Prompt para arrancar el proyecto con Claude Code |
| `CLAUDE.md` | Reglas y parámetros de trabajo para Claude Code (va en la raíz del repositorio) |
| `data/catalogo_jd_borrador.csv` | Catálogo extraído del PDF, para revisar e importar |
| `scripts/extraer.py` | Script que generó el CSV desde el PDF |
