-- =============================================================================
-- 0010_pedidos_admin.sql — Gestión de pedidos en el panel (F6, RF-27)
--
-- Contiene:
--   1) pedido_items.precio_base  : precio ANTES del mayoreo (oferta incluida). Permite
--                                  recalcular el ahorro por mayor al editar cantidades.
--                                  (Cambio al modelo de datos: columna nueva y opcional.)
--   2) crear_pedido()            : ahora guarda precio_base en cada ítem.
--   3) clientes_leer             : el vendedor también ve a los clientes de SUS pedidos.
--   4) v_pedidos_admin           : una fila por pedido, con cliente, zona y totales.
--   5) cambiar_estado_pedido()   : cambia el estado respetando el flujo y los permisos.
--   6) editar_items_pedido()     : cambia cantidades o quita ítems mientras el pedido
--                                  esté en "nuevo" o "confirmado" y lo deja en el historial.
--
-- RLS no puede limitar COLUMNAS, y un vendedor no debe poder editar totales: por eso el
-- cambio de estado y la edición pasan por funciones que revisan el rol y la zona. Son
-- SECURITY DEFINER (corren con permisos de su dueño) pero comprueban quién llama, y se
-- revoca el permiso a anon.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Precio base en los ítems
-- ---------------------------------------------------------------------------
alter table public.pedido_items
  add column if not exists precio_base integer
  check (precio_base is null or precio_base >= 0);

comment on column public.pedido_items.precio_base is
  'Precio por unidad antes del mayoreo (el de oferta si la había). NULL en pedidos anteriores a esta columna.';

-- ---------------------------------------------------------------------------
-- 2. crear_pedido(): igual que en 0009, pero los ítems guardan precio_base
-- ---------------------------------------------------------------------------
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

  select count(*) into v_recientes
  from public.pedidos pe
  left join public.clientes cl on cl.id = pe.cliente_id
  where pe.created_at > now() - interval '10 minutes'
    and (cl.celular = v_celular or (v_ip is not null and pe.ip_origen = v_ip));
  if v_recientes >= 5 then
    raise exception 'LIMITE: demasiados pedidos en poco tiempo.' using errcode = 'P0001';
  end if;

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

  select coalesce(sum((i ->> 'subtotal')::integer), 0) into v_suma_items
  from jsonb_array_elements(v_items) as i;
  if v_suma_items <> v_subtotal - v_descuento or v_total <> v_subtotal - v_descuento + v_envio then
    raise exception 'Las cuentas del pedido no cuadran.' using errcode = 'P0001';
  end if;

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

  insert into public.pedido_items (
    pedido_id, variante_id, sku, nombre_producto, presentacion,
    cantidad, precio_unitario_aplicado, precio_base, tipo_precio, subtotal)
  select
    v_pedido_id,
    (i ->> 'variante_id')::integer,
    i ->> 'sku',
    i ->> 'nombre_producto',
    nullif(i ->> 'presentacion', ''),
    (i ->> 'cantidad')::integer,
    (i ->> 'precio_unitario_aplicado')::integer,
    coalesce(nullif(i ->> 'precio_base', '')::integer, (i ->> 'precio_unitario_aplicado')::integer),
    i ->> 'tipo_precio',
    (i ->> 'subtotal')::integer
  from jsonb_array_elements(v_items) as i;

  return jsonb_build_object('id', v_pedido_id, 'numero', v_numero);
end;
$$;

revoke execute on function public.crear_pedido(jsonb) from public, anon, authenticated;
grant execute on function public.crear_pedido(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 3. El vendedor ve a los clientes de los pedidos de SUS sectores
-- ---------------------------------------------------------------------------
-- Antes solo veía a los clientes cuyo sector habitual era el suyo; un cliente puede
-- pedir para otro sector y entonces el vendedor veía el pedido sin el nombre.
drop policy if exists clientes_leer on public.clientes;
create policy clientes_leer on public.clientes
  for select to authenticated
  using (
    (select private.tiene_rol(array['admin','editor']::public.rol_usuario[]))
    or (
      (select private.rol_actual()) = 'vendedor'
      and exists (
        select 1 from public.pedidos pe
        where pe.cliente_id = clientes.id
          and pe.sector_id = any ((select private.sectores_del_usuario())::integer[])
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Vista para la lista de pedidos del panel
-- ---------------------------------------------------------------------------
-- security_invoker = respeta el RLS de quien consulta: admin y editor ven todo; el
-- vendedor solo los pedidos de sus sectores.
create view public.v_pedidos_admin
with (security_invoker = true) as
select
  p.id,
  p.numero,
  p.created_at,
  p.estado,
  p.fecha_entrega_estimada,
  p.recoge_en_bodega,
  p.sector_id,
  s.nombre                   as sector_nombre,
  m.nombre                   as municipio_nombre,
  p.cliente_id,
  c.nombre                   as cliente_nombre,
  c.nombre_negocio,
  c.celular,
  p.direccion_entrega,
  p.subtotal,
  p.descuento_mayor,
  p.costo_envio,
  p.total,
  p.notas,
  it.n_items,
  it.n_unidades,
  -- Texto sin tildes ni mayúsculas para el buscador (número, nombre, negocio y celular).
  public.f_unaccent(lower(
    p.numero || ' ' || coalesce(c.nombre, '') || ' ' || coalesce(c.nombre_negocio, '') || ' ' || coalesce(c.celular, '')
  ))                         as texto_busqueda
from public.pedidos p
left join public.clientes c on c.id = p.cliente_id
left join public.sectores s on s.id = p.sector_id
left join public.municipios m on m.id = s.municipio_id
cross join lateral (
  select count(*)::integer as n_items, coalesce(sum(i.cantidad), 0)::integer as n_unidades
  from public.pedido_items i
  where i.pedido_id = p.id
) it;

grant select on public.v_pedidos_admin to authenticated;

-- ---------------------------------------------------------------------------
-- 5. cambiar_estado_pedido(): el flujo de estados (RF-27)
-- ---------------------------------------------------------------------------
--   nuevo → confirmado → en_preparacion → despachado → entregado
--   cancelar: desde nuevo, confirmado o en_preparacion (con motivo obligatorio).
--   entregado y cancelado son finales.
-- Quién: el admin en cualquier pedido; el vendedor solo en pedidos de SUS sectores;
-- el editor solo mira. El historial (usuario, fecha y nota) lo escribe el disparador
-- que ya existe (RN-09).
create or replace function public.cambiar_estado_pedido(
  p_pedido_id integer,
  p_estado public.estado_pedido,
  p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol public.rol_usuario := private.rol_actual();
  v_pedido public.pedidos%rowtype;
  v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
  v_permitido boolean;
begin
  if v_rol is null then
    raise exception 'Inicia sesión para cambiar el estado del pedido.' using errcode = '42501';
  end if;

  select * into v_pedido from public.pedidos where id = p_pedido_id for update;
  if not found then
    raise exception 'El pedido no existe.' using errcode = 'P0002';
  end if;

  if not (v_rol = 'admin'
          or (v_rol = 'vendedor'
              and v_pedido.sector_id = any (private.sectores_del_usuario()))) then
    raise exception 'No tienes permiso para cambiar el estado de este pedido.' using errcode = '42501';
  end if;

  v_permitido := case v_pedido.estado
    when 'nuevo'          then p_estado in ('confirmado', 'cancelado')
    when 'confirmado'     then p_estado in ('en_preparacion', 'cancelado')
    when 'en_preparacion' then p_estado in ('despachado', 'cancelado')
    when 'despachado'     then p_estado = 'entregado'
    else false
  end;
  if not v_permitido then
    raise exception 'No se puede pasar un pedido de "%" a "%".', v_pedido.estado, p_estado
      using errcode = 'P0001';
  end if;

  if p_estado = 'cancelado' and v_nota is null then
    raise exception 'Cancelar un pedido requiere un motivo.' using errcode = 'P0001';
  end if;

  perform set_config('app.nota_estado', coalesce(v_nota, ''), true);
  update public.pedidos set estado = p_estado where id = p_pedido_id;

  return jsonb_build_object('id', p_pedido_id, 'estado', p_estado);
end;
$$;

revoke execute on function public.cambiar_estado_pedido(integer, public.estado_pedido, text) from public, anon;
grant execute on function public.cambiar_estado_pedido(integer, public.estado_pedido, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. editar_items_pedido(): cantidades y quitar ítems (RF-27)
-- ---------------------------------------------------------------------------
-- p_items: [{ "id": <id del ítem>, "cantidad": N }]; cantidad 0 quita el ítem. Lo que no
-- se menciona queda igual. Cada unidad conserva el precio con que se cobró (RN-08); solo
-- se recalculan los subtotales y los totales del pedido. Debe quedar al menos un ítem
-- (si no, el pedido se cancela). Solo admin, y solo en "nuevo" o "confirmado". Queda una
-- fila en el historial con el motivo.
create or replace function public.editar_items_pedido(
  p_pedido_id integer,
  p_items jsonb,
  p_nota text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
  i jsonb;
  v_item_id integer;
  v_cantidad integer;
  v_cambios integer := 0;
  v_quedan integer;
  v_subtotal integer;
  v_descuento integer;
begin
  if not private.tiene_rol(array['admin']::public.rol_usuario[]) then
    raise exception 'Solo el administrador puede editar los productos de un pedido.' using errcode = '42501';
  end if;
  if v_nota is null then
    raise exception 'Escribe el motivo del cambio.' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'No hay cambios para guardar.' using errcode = 'P0001';
  end if;

  select * into v_pedido from public.pedidos where id = p_pedido_id for update;
  if not found then
    raise exception 'El pedido no existe.' using errcode = 'P0002';
  end if;
  if v_pedido.estado not in ('nuevo', 'confirmado') then
    raise exception 'Solo se puede editar un pedido nuevo o confirmado.' using errcode = 'P0001';
  end if;

  for i in select value from jsonb_array_elements(p_items)
  loop
    v_item_id := (i ->> 'id')::integer;
    v_cantidad := (i ->> 'cantidad')::integer;
    if v_cantidad is null or v_cantidad < 0 or v_cantidad > 9999 then
      raise exception 'La cantidad debe estar entre 0 y 9999.' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.pedido_items where id = v_item_id and pedido_id = p_pedido_id) then
      raise exception 'Uno de los productos no pertenece a este pedido.' using errcode = 'P0001';
    end if;

    if v_cantidad = 0 then
      delete from public.pedido_items where id = v_item_id;
    else
      update public.pedido_items
         set cantidad = v_cantidad, subtotal = v_cantidad * precio_unitario_aplicado
       where id = v_item_id and (cantidad <> v_cantidad);
    end if;
    v_cambios := v_cambios + 1;
  end loop;

  select count(*) into v_quedan from public.pedido_items where pedido_id = p_pedido_id;
  if v_quedan = 0 then
    raise exception 'El pedido no puede quedar sin productos: cancélalo en su lugar.' using errcode = 'P0001';
  end if;

  -- Subtotal = a precio base (sin mayoreo); descuento = lo que se ahorra por mayor.
  -- En pedidos viejos sin precio_base se toma el precio cobrado (sin descuento en esa línea).
  select
    coalesce(sum(cantidad * coalesce(precio_base, precio_unitario_aplicado)), 0),
    coalesce(sum(case when tipo_precio = 'mayor'
                      then cantidad * (coalesce(precio_base, precio_unitario_aplicado) - precio_unitario_aplicado)
                      else 0 end), 0)
    into v_subtotal, v_descuento
  from public.pedido_items where pedido_id = p_pedido_id;

  update public.pedidos
     set subtotal = v_subtotal,
         descuento_mayor = v_descuento,
         total = v_subtotal - v_descuento + costo_envio
   where id = p_pedido_id;

  -- Esto no cambia el estado, así que el disparador no escribe nada: se deja constancia aquí.
  insert into public.pedido_historial (pedido_id, estado_anterior, estado_nuevo, usuario_id, nota)
  values (p_pedido_id, v_pedido.estado, v_pedido.estado, (select auth.uid()),
          'Pedido editado: ' || v_nota);

  return jsonb_build_object('id', p_pedido_id, 'subtotal', v_subtotal,
                            'descuento_mayor', v_descuento,
                            'total', v_subtotal - v_descuento + v_pedido.costo_envio);
end;
$$;

revoke execute on function public.editar_items_pedido(integer, jsonb, text) from public, anon;
grant execute on function public.editar_items_pedido(integer, jsonb, text) to authenticated;
