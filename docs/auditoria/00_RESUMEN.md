# Auditoría de prelanzamiento — Resumen y plan

**Fecha:** 24 de noviembre de 2026 · **Alcance:** tienda pública, carrito y pedido, panel administrativo, pedidos y reparto, seguridad y despliegue.
**Informes detallados** (con archivo, línea, impacto y arreglo de cada hallazgo):
[01 Tienda pública](01_tienda_publica.md) · [02 Carrito y pedido](02_carrito_y_pedido.md) · [03 Panel administrativo](03_panel_admin.md) · [04 Pedidos y reparto](04_pedidos_y_reparto.md) · [05 Seguridad y despliegue](05_seguridad_y_despliegue.md)

## Veredicto

**No se puede lanzar hoy.** La base es sólida (permisos bien resueltos, seguridad por fila activa en las 18 tablas, 344 pruebas unitarias, cero secretos en el historial), pero hay datos del negocio sin cargar, un error de rendimiento que rompe la búsqueda y varios huecos operativos. Lo que falta no es reescribir nada: es cerrar una lista concreta.

| Área | Hallazgos | Bloqueantes | Altos |
|---|---|---|---|
| Tienda pública | 32 | 3 | 6 |
| Carrito y pedido | 23 | 2 | 3 |
| Panel administrativo | 29 | 1 | 5 |
| Pedidos y reparto | 32 | 0 | 7 |
| Seguridad y despliegue | 27 | 2 | 7 |
| **Total** | **143** | **8 (varios repetidos)** | **28** |

Hallazgos propios de la revisión en vivo (no estaban en los informes):
1. **189 productos con precio estaban ocultos** por un efecto del importador (error corregido en el script; falta importar `reactivar_productos_para_importar.csv`).
2. **La búsqueda de varias palabras puede devolver «0 resultados»**: la vista pública tarda ~2,4 s y el límite del rol de visitante es 3 s.
3. **«Afeitadora metálica» en oferta por debajo de su costo** (posible oferta de prueba).

---

## FASE 0 — Lo que solo el dueño puede dar (sin esto no hay lanzamiento)

| # | Qué falta | Por qué bloquea | Informe |
|---|---|---|---|
| 0.1 | **Cantidad mínima para el precio por mayor.** Hoy 2.700 presentaciones tienen precio por mayor sin mínimo y se cobra desde la unidad 1 (≈6,8 % menos que el detal). | Se pierde margen en casi todo el catálogo | C-01 |
| 0.2 | **Zonas reales de entrega:** municipios, sectores, días de reparto y costo de envío. Hoy solo existe «prueba Centro». | Un cliente real no puede pedir | T-02, C-02, P-12 |
| 0.3 | **Hora de corte, festivos y pedido mínimo.** | Se puede prometer entrega un festivo | T-05, C-02 |
| 0.4 | **Datos de la empresa:** NIT, dirección, horarios, redes; dirección y horario de la bodega. | Aparece vacío en el pie y en la confirmación | T-04, C-21, P-28 |
| 0.5 | **Texto legal definitivo:** política de tratamiento de datos (Ley 1581), términos y condiciones, responsable. | Hoy dice «texto provisional» y el checkout obliga a aceptarla | T-01, S-02 |
| 0.6 | **Decisión sobre ofertas de prueba** (Afeitadora metálica) y sobre el pedido EV-000002 (confirmado por $62.000). | Datos de prueba visibles / en la operación | S-01 |
| 0.7 | **Cuentas y planes:** Supabase de pago (backups y sin pausa por inactividad), Vercel para uso comercial, dominio, correo del negocio. | El plan gratuito se pausa y no permite uso comercial | S-06, S-07 |
| 0.8 | **Cómo se enterará el equipo de un pedido nuevo** (correo, aviso en el panel, otro). | Hoy un pedido sin WhatsApp del cliente queda sin atender | P-05, C-05 |

## FASE 1 — Arreglos críticos de código (puedo hacerlos ya; ≈ 1 a 1,5 días)

1. **Eliminar la página `/estado`** (diagnóstico de la fase F0, pública, usa la clave privada). *Requiere tu confirmación por la regla 1.* — A-01, T-03, S-03
2. **Pantallas de error y de «no encontrado»** con la marca (tienda y panel); que un fallo de la base **no se guarde en caché** como «catálogo vacío». — T-07, T-10, A-06, S-09
3. **Cabeceras de seguridad** (CSP, anti-clickjacking, HSTS, etc.) y cookies de sesión seguras. — S-05, A-09, A-10, T-30
4. **SEO básico:** `robots.txt`, `sitemap.xml`, dirección base y vista previa para compartir por WhatsApp, títulos por categoría. — T-08, T-11, T-12, S-14
5. **Pie de página completo** con enlace a la política de datos y páginas Términos, Contáctanos y Preguntas frecuentes. — T-09, S-02
6. **Carrito y compra:** borrar la cantidad ya no quita el producto; botones táctiles de 44 px; **protección contra pedidos duplicados** y mensajes de error claros; avisos de agotados en el checkout. — C-04, C-03, C-08, T-14
7. **Consentimiento de datos guardado** (fecha y versión) y forma de pedir la supresión. — S-02, C-13, S-18
8. **Panel sin trampas:** confirmar las acciones masivas (desactivar 200 productos de un clic), avisar de cambios sin guardar en la cuadrícula y el formulario, y **no borrar presentaciones que otra persona acaba de crear**. — A-02, A-03, A-04, A-12
9. **Pedidos:** confirmación (y deshacer) en «Despachado» y «Entregado»; salida «no entregado» y cancelar desde «despachado»; **reprogramar** fecha, dirección o sector; cerrar el hueco que deja a un vendedor mover pedidos «recoge en bodega». — P-01, P-03, P-04, P-10
10. **Aviso de pedido nuevo** según lo que decidas en 0.8. — P-05, C-05
11. Quitar el correo personal del archivo `seed.sql` y mover `shadcn` a dependencias de desarrollo. — S-19, S-20

## FASE 2 — Rendimiento y base de datos (migración nueva; ≈ 0,5 día; requiere tu confirmación)

- **Vista pública rápida** y búsqueda con índices: pasar de ~2,4 s a menos de 300 ms. Es lo que hoy hace fallar la búsqueda de dos palabras. — S-04, T-06
- Límite de peticiones en `/api/sugerencias` y caché ajustada. — T-17, S-08
- Cerrar permisos innecesarios de funciones internas y quitar `updated_by` de la configuración pública. — S-22, S-23
- Fijar la región de Vercel cerca de la base (São Paulo). — S-17

## FASE 3 — Operación de reparto (≈ 1 a 2 días)

- **Hoja de ruta imprimible** (varios pedidos, agrupados por sector, con total a cobrar) y **consolidado de productos** para el bodeguero; mejor orden de alistamiento (SKU, ubicación, notas). — P-06, P-07, P-08
- Vista «Por ruta» con totales por sector; detalle del pedido pensado para el celular del repartidor (llamar, mapa, cobrar). — P-16, P-17, P-18
- Historial visible con quién hizo cada cambio; peso y bultos por pedido. — P-24, P-32
- Roles de bodega y repartidor (si lo decides). — P-02

## FASE 4 — Calidad y salida a producción (≈ 1 a 2 días)

- **Pruebas de extremo a extremo (Playwright)** del flujo de compra y del panel, y revisión automática en cada cambio. *Requiere tu permiso para instalar la herramienta.* — S-15, C-14
- Accesibilidad (contraste del rojo, etiquetas, saltar al contenido), selector rápido de presentaciones (RF-03), banners e imagen de inicio. — T-14 a T-27
- Seguimiento de errores en producción (Sentry u otro). — S-09
- Producción: planes de Supabase y Vercel, dominio y HTTPS, URL del sitio y redirecciones de Auth, correo propio, copias de seguridad, **separar la base de pruebas de la de producción**. — S-06, S-07, S-12, S-13, S-16
- **Limpieza final de datos de prueba** (pedidos EV-000001/2, cliente, sector «prueba Centro», producto y categoría ASEO) y reinicio del contador de pedidos. *Borrado definitivo: se hace solo con tu confirmación.* — S-01
- Contenido: fotos de los productos nuevos (29 % sin foto), descripciones y banners.

## Lo que está bien (no tocar)

- Permisos revisados en el servidor en cada acción y repetidos en las funciones SQL; costos privados inaccesibles al público y a vendedores.
- Seguridad por fila activa en las 18 tablas; el bucket de fotos solo lo escriben administrador y editor; registro público de usuarios desactivado.
- Cálculo de precios, entregas y pedidos probado (344 pruebas); el servidor recalcula siempre los precios (RN-06).
- Sin secretos en el historial de git; `lint`, tipos y compilación limpios.
- Importador con vista previa, historial y validaciones; costos y ganancia calculados con el costo del momento del pedido.

---

## Estado de la Fase 1 (24 de noviembre de 2026)

**Hecho en código (verificado con lint, 382 pruebas y comprobación en el navegador; sin commitear):**

| # | Qué | Hallazgos |
|---|---|---|
| 1 | Página `/estado` eliminada | A-01, T-03, S-03 |
| 2 | Pantallas de error y «no encontrado» con la marca (tienda, panel y global); un fallo de la base ya **no se guarda en caché** como catálogo vacío (`lib/tienda/errores.ts`) | T-07, T-10, A-06, S-09 |
| 3 | Cabeceras de seguridad (CSP, anti-clickjacking, nosniff, Referrer-Policy, Permissions-Policy, HSTS en producción), cookies de sesión `Secure`/`SameSite=Lax`, panel `noindex` y sin caché | S-05, A-09, A-10, T-30 |
| 4 | SEO: `robots.txt`, `sitemap.xml` (con todos los productos, paginado), dirección base, imagen al compartir, título y canonical por categoría | T-08, T-11, T-12, S-14 |
| 5 | Pie con política de datos, términos, contáctanos y preguntas frecuentes (textos legales **provisionales**) | T-09, S-02 |
| 6 | Carrito: la cantidad vacía ya no quita el producto, botones de 44 px en móvil, clave de idempotencia contra pedidos duplicados, aviso de agotados con enlace | C-03, C-04, C-08 |
| 7 | Panel: confirmación al desactivar categorías y en las acciones masivas (con la cantidad exacta), aviso de cambios sin guardar también al usar el menú/paginación/«Cancelar», advertencia al vaciar o cambiar más de 50 % un precio | A-02, A-04, A-05, A-12 |
| 8 | Aviso de pedido nuevo: correo (Resend, opcional por variables de entorno) + insignia y sonido en el panel | P-05, C-05 |
| 9 | Pedidos: confirmación al despachar/entregar, «no se entregó» y cancelar desde despachado, reprogramar fecha/dirección/notas, bloque «Atrasados» en la ruta (el SQL está en `supabase/migrations/0013_pedidos_robustos.sql`, aplicada) | P-01, P-03, P-04, P-10 |
| 10 | Correo personal fuera de `seed.sql` | S-19 |

**Aplicada el 24-nov-2026 con tu confirmación:** migración `0013_pedidos_robustos.sql` (idempotencia, consentimiento guardado, hueco de permisos, salidas del despachado, reprogramar, `configuracion` sin `updated_by`, límite de tiempo del visitante 3 s → 8 s como medida provisional). Tipos regenerados. Verificado: columnas y funciones creadas, el visitante lee solo `clave` y `valor` de `configuracion` y la búsqueda de dos palabras responde (2,8 s, ya dentro del límite de 8 s). Sin probar aún con un pedido real: idempotencia, reprogramar y «no entregado» (hacerlo cuando existan zonas reales).

**Migración 0014 (S-04, aplicada):** las políticas de lectura pública calculan los ids visibles una sola vez por consulta (mismas reglas de RN-01). Contar la vista pública pasó de 1.863 ms a 29 ms; una búsqueda de 2 palabras ~210 ms y de 4 palabras ~360 ms. Verificado con huellas de ids: lo que ve un visitante es idéntico antes y después. La 0015 devuelve el límite del visitante a 3 s.

**No incluido aún:** `guardar_producto` con control de versión (A-03); revocar permisos de `private` (S-22: puede romper las políticas RLS, requiere prueba); mover `shadcn` a devDependencies (requiere permiso de instalación); fases 0, 2, 3 y 4.
