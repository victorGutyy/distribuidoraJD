-- =============================================================================
-- 0009_crear_pedido.sql — Creación del pedido desde la tienda (F5, RF-10)
--
-- crear_pedido(jsonb): guarda, en UNA sola transacción,
--   1) el cliente (se identifica por celular; si ya existe se actualizan sus datos, RN-11),
--   2) el pedido, con su número consecutivo EV-000123 (RN-07),
--   3) sus ítems, con la "foto" del nombre, la presentación, el SKU y el precio aplicado (RN-08),
-- y el historial lo escribe el trigger que ya existe (RN-09).
--
-- Quién la usa: SOLO el servidor de la tienda, con la clave de servicio (service_role),
-- porque el público no tiene permiso de escribir en pedidos ni clientes. Se revocó el
-- permiso de ejecución a anon y authenticated, y además la función lo comprueba.
-- La aplicación calcula los precios en el servidor con los datos de la base (RN-06);
-- esta función revisa que las cuentas cuadren y aplica el límite anti-abuso (RN-13).
--
-- No cambia el modelo de datos: no crea ni modifica tablas.
-- =============================================================================

create or replace function public.crear_pedido(p_datos jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  c jsonb := p_datos -> 'cliente';
  p jsonb := p_datos -> 'pedido';
  v_items jsonb := p_datos -> 'items';
  v_celular text;
  v_ip text;
  v_sector_id integer;
  v_bodega boolean;
  v_subtotal integer;
  v_descuento integer;
  v_envio integer;
  v_total integer;
  v_cliente_id integer;
  v_pedido_id integer;
  v_numero text;
  v_recientes integer;
  v_suma_items integer;
  v_costo_sector integer;
begin
  -- Defensa extra: aunque los permisos ya lo impiden, solo el servidor puede crear pedidos.
  if current_user not in ('service_role', 'postgres') then
    raise exception 'No tienes permiso para crear pedidos.' using errcode = '42501';
  end if;

  if p_datos is null or jsonb_typeof(c) <> 'object' or jsonb_typeof(p) <> 'object'
     or jsonb_typeof(v_items) <> 'array' then
    raise exception 'Datos del pedido incompletos.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(v_items) not between 1 and 50 then
    raise exception 'El pedido debe tener entre 1 y 50 productos.' using errcode = 'P0001';
  end if;

  v_celular := c ->> 'celular';
  v_ip := nullif(btrim(coalesce(p ->> 'ip_origen', '')), '');
  v_sector_id := nullif(p ->> 'sector_id', '')::integer;
  v_bodega := coalesce((p ->> 'recoge_en_bodega')::boolean, false);
  v_subtotal := (p ->> 'subtotal')::integer;
  v_descuento := coalesce((p ->> 'descuento_mayor')::integer, 0);
  v_envio := coalesce((p ->> 'costo_envio')::integer, 0);
  v_total := (p ->> 'total')::integer;

  if v_celular is null or v_celular !~ '^3[0-9]{9}$' then
    raise exception 'El celular no es válido.' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(c ->> 'nombre', ''))) = 0 then
    raise exception 'Falta el nombre del cliente.' using errcode = 'P0001';
  end if;

  -- RN-13: máximo 5 pedidos por celular o por IP cada 10 minutos.
  select count(*) into v_recientes
  from public.pedidos pe
  left join public.clientes cl on cl.id = pe.cliente_id
  where pe.created_at > now() - interval '10 minutes'
    and (cl.celular = v_celular or (v_ip is not null and pe.ip_origen = v_ip));
  if v_recientes >= 5 then
    raise exception 'LIMITE: demasiados pedidos en poco tiempo.' using errcode = 'P0001';
  end if;

  -- La zona debe seguir activa y su costo de envío no haber cambiado desde que se calculó el total.
  if not v_bodega then
    select s.costo_envio into v_costo_sector
    from public.sectores s
    join public.municipios m on m.id = s.municipio_id
    where s.id = v_sector_id and s.activo and m.activo;
    if not found then
      raise exception 'ZONA: la zona de entrega ya no está disponible.' using errcode = 'P0001';
    end if;
    if v_costo_sector <> v_envio then
      raise exception 'ZONA: el costo de envío cambió.' using errcode = 'P0001';
    end if;
  elsif v_envio <> 0 then
    raise exception 'Recoger en bodega no tiene costo de envío.' using errcode = 'P0001';
  end if;

  -- Las cuentas deben cuadrar: la suma de los ítems = subtotal − descuento por mayor.
  select coalesce(sum((i ->> 'subtotal')::integer), 0) into v_suma_items
  from jsonb_array_elements(v_items) as i;
  if v_suma_items <> v_subtotal - v_descuento or v_total <> v_subtotal - v_descuento + v_envio then
    raise exception 'Las cuentas del pedido no cuadran.' using errcode = 'P0001';
  end if;

  -- Cliente (RN-11): se actualiza lo que llegó; lo que no llegó se conserva.
  insert into public.clientes (celular, nombre, nombre_negocio, documento, direccion, referencia, sector_id)
  values (
    v_celular,
    btrim(c ->> 'nombre'),
    nullif(btrim(coalesce(c ->> 'nombre_negocio', '')), ''),
    nullif(btrim(coalesce(c ->> 'documento', '')), ''),
    nullif(btrim(coalesce(c ->> 'direccion', '')), ''),
    nullif(btrim(coalesce(c ->> 'referencia', '')), ''),
    v_sector_id
  )
  on conflict (celular) do update set
    nombre         = excluded.nombre,
    nombre_negocio = coalesce(excluded.nombre_negocio, public.clientes.nombre_negocio),
    documento      = coalesce(excluded.documento, public.clientes.documento),
    direccion      = coalesce(excluded.direccion, public.clientes.direccion),
    referencia     = coalesce(excluded.referencia, public.clientes.referencia),
    sector_id      = coalesce(excluded.sector_id, public.clientes.sector_id)
  returning id into v_cliente_id;

  -- El trigger de historial toma esta nota (RN-09).
  perform set_config('app.nota_estado', 'Pedido creado desde la tienda', true);

  insert into public.pedidos (
    cliente_id, sector_id, recoge_en_bodega, direccion_entrega, fecha_entrega_estimada,
    subtotal, descuento_mayor, costo_envio, total, notas, ip_origen)
  values (
    v_cliente_id,
    case when v_bodega then null else v_sector_id end,
    v_bodega,
    case when v_bodega then null else nullif(btrim(coalesce(p ->> 'direccion_entrega', '')), '') end,
    nullif(p ->> 'fecha_entrega_estimada', '')::date,
    v_subtotal, v_descuento, v_envio, v_total,
    nullif(btrim(coalesce(p ->> 'notas', '')), ''),
    v_ip
  )
  returning id, numero into v_pedido_id, v_numero;

  -- RN-08: cada ítem guarda su "foto" (nombre, presentación, SKU y precio aplicado).
  insert into public.pedido_items (
    pedido_id, variante_id, sku, nombre_producto, presentacion,
    cantidad, precio_unitario_aplicado, tipo_precio, subtotal)
  select
    v_pedido_id,
    (i ->> 'variante_id')::integer,
    i ->> 'sku',
    i ->> 'nombre_producto',
    nullif(i ->> 'presentacion', ''),
    (i ->> 'cantidad')::integer,
    (i ->> 'precio_unitario_aplicado')::integer,
    i ->> 'tipo_precio',
    (i ->> 'subtotal')::integer
  from jsonb_array_elements(v_items) as i;

  return jsonb_build_object('id', v_pedido_id, 'numero', v_numero);
end;
$$;

-- Solo el servidor (clave de servicio) puede ejecutarla.
revoke execute on function public.crear_pedido(jsonb) from public, anon, authenticated;
grant execute on function public.crear_pedido(jsonb) to service_role;
