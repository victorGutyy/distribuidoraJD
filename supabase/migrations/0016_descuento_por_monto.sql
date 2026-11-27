-- =============================================================================
-- 0016_descuento_por_monto.sql — Descuento por monto de compra (reemplaza el precio por mayor)
--
-- Decisión del cliente (nov-2026): las compras de $500.000 o más reciben 5 % de descuento.
-- Ya no se usa el precio por mayor de cada producto ni la regla por cantidad.
--
-- Qué hace:
--   1. Crea las dos configuraciones nuevas, con lo que dijo el cliente:
--        descuento_monto_minimo = 500000   (subtotal de productos, con ofertas, sin envío)
--        descuento_porcentaje   = 5
--      Si ya existen (alguien las cambió desde el panel) NO se tocan.
--   2. Agrega esas dos claves a la lista de lo que el público puede leer (la tienda las necesita
--      para mostrar el aviso y calcular el carrito) y retira las dos que ya no se usan
--      (regla_mayoreo, umbral_mayor_monto). Siguen leyéndose solo el resto de claves de siempre.
--
-- No cambia tablas ni columnas, ni pedidos, ni las funciones crear_pedido / editar_items_pedido:
-- el descuento se guarda en cada línea del pedido como antes (tipo_precio = 'mayor') y en
-- pedidos.descuento_mayor. Los precios por mayor ya guardados en variantes se conservan, sin usarse.
-- =============================================================================

insert into public.configuracion (clave, valor) values
  ('descuento_monto_minimo', '500000'::jsonb),
  ('descuento_porcentaje', '5'::jsonb)
on conflict (clave) do nothing;

alter policy configuracion_leer_publico on public.configuracion
  using (clave in (
    'whatsapp_pedidos', 'mensaje_whatsapp_flotante', 'pedido_minimo',
    'descuento_monto_minimo', 'descuento_porcentaje',
    'hora_corte', 'dias_no_habiles', 'mensaje_barra_superior', 'empresa'
  ));
