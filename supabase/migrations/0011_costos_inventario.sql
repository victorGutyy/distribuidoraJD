-- =============================================================================
-- 0011_costos_inventario.sql — Costos, ganancia e inventario informativo (RF-32)
--
-- Qué agrega (docs/01_REQUERIMIENTOS.md: RF-32, RN-14, RN-15, RN-16):
--   1) variante_costos     : costo y stock de cada variante. SOLO admin y editor.
--   2) pedido_item_costos  : copia del costo de cada línea al crear el pedido.
--   3) crear_pedido()      : igual que en 0010, pero además copia el costo vigente.
--   4) guardar_costos()    : guarda costo / stock por lote (importación y cuadrícula).
--   5) v_ganancia_pedidos  : venta, costo y ganancia de cada pedido (admin y editor).
--   6) v_inventario_admin  : existencias, margen y valor del inventario (admin y editor).
--
-- POR QUÉ TABLAS APARTE y no una columna "costo" en variantes:
--   la tienda pública lee `variantes` con el rol anon, y el repositorio es público.
--   Una columna de costo quedaría a un "select *" de filtrarse a los clientes. En una
--   tabla propia sin ningún permiso para anon, la tienda NO puede verla ni por error.
--   Tampoco va en pedido_items: el vendedor lee los ítems de sus pedidos.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. variante_costos
-- ---------------------------------------------------------------------------
create table public.variante_costos (
  variante_id          integer primary key references public.variantes (id) on delete cascade,
  -- Pesos enteros COP, con IVA (igual que los precios). NULL = sin dato.
  costo                integer check (costo is null or costo >= 0),
  -- Existencias informativas (RN-16). Puede ser negativo: así viene del sistema contable.
  stock                integer check (stock is null or stock between -1000000 and 100000000),
  stock_actualizado_at timestamptz,
  updated_at           timestamptz not null default now()
);

comment on table public.variante_costos is
  'Costo y existencias por variante (RF-32). Privado: solo admin y editor (RN-14).';

create trigger variante_costos_updated_at
  before update on public.variante_costos
  for each row execute function private.set_updated_at();

alter table public.variante_costos enable row level security;

-- Mínimo privilegio: anon no recibe NADA. authenticated solo lo que permitan las políticas.
revoke all on public.variante_costos from anon, authenticated;
grant select, insert, update, delete on public.variante_costos to authenticated;

create policy variante_costos_leer on public.variante_costos
  for select to authenticated
  using ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])));
create policy variante_costos_insertar on public.variante_costos
  for insert to authenticated
  with check ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])));
create policy variante_costos_actualizar on public.variante_costos
  for update to authenticated
  using ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])))
  with check ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])));
create policy variante_costos_borrar on public.variante_costos
  for delete to authenticated
  using ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])));

-- ---------------------------------------------------------------------------
-- 2. pedido_item_costos: el costo que tenía cada línea cuando se hizo el pedido (RN-15)
-- ---------------------------------------------------------------------------
create table public.pedido_item_costos (
  pedido_item_id integer primary key references public.pedido_items (id) on delete cascade,
  costo          integer check (costo is null or costo >= 0)
);

comment on table public.pedido_item_costos is
  'Copia del costo de cada línea al crear el pedido (RN-15). Solo admin y editor; se escribe desde crear_pedido().';

alter table public.pedido_item_costos enable row level security;

revoke all on public.pedido_item_costos from anon, authenticated;
grant select on public.pedido_item_costos to authenticated;
-- Solo el servidor (crear_pedido) escribe aquí.
grant select, insert on public.pedido_item_costos to service_role;
grant select on public.variante_costos to service_role;

create policy pedido_item_costos_leer on public.pedido_item_costos
  for select to authenticated
  using ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])));

-- ---------------------------------------------------------------------------
-- 3. crear_pedido(): idéntica a la de 0010 + copia del costo de cada línea
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

  -- NUEVO (RN-15): copia del costo vigente de cada línea. La ganancia de este pedido no
  -- cambia si el costo sube o baja después. Las variantes sin costo simplemente no tienen fila.
  insert into public.pedido_item_costos (pedido_item_id, costo)
  select it.id, vc.costo
  from public.pedido_items it
  join public.variante_costos vc on vc.variante_id = it.variante_id
  where it.pedido_id = v_pedido_id
    and vc.costo is not null;

  return jsonb_build_object('id', v_pedido_id, 'numero', v_numero);
end;
$$;

revoke execute on function public.crear_pedido(jsonb) from public, anon, authenticated;
grant execute on function public.crear_pedido(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 4. guardar_costos(p_filas): costo y stock por lote
-- ---------------------------------------------------------------------------
-- p_filas: lista de { id? | sku?, costo?, stock? }
--   · Solo se modifican las claves PRESENTES. Una clave con valor null BORRA ese dato;
--     una clave ausente lo deja igual (la importación nunca manda las celdas vacías).
--   · Cada fila va en su propio sub-bloque: si una falla se informa y las demás se guardan.
-- Devuelve: { actualizadas, sin_cambios, errores: [{ref, mensaje}] }
-- SECURITY INVOKER: el RLS de variante_costos ya limita esto a admin y editor.
create or replace function public.guardar_costos(p_filas jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  f jsonb;
  v_ref text;
  v_id integer;
  v_existe boolean;
  v_costo_ant integer;
  v_stock_ant integer;
  v_costo integer;
  v_stock integer;
  c_act integer := 0;
  c_igual integer := 0;
  v_errores jsonb := '[]'::jsonb;
begin
  if not private.tiene_rol(array['admin', 'editor']::public.rol_usuario[]) then
    raise exception 'No tienes permiso para cambiar costos.' using errcode = '42501';
  end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) = 0 then
    raise exception 'No hay filas para guardar.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_filas) > 1000 then
    raise exception 'Máximo 1000 filas por lote.' using errcode = 'P0001';
  end if;

  for f in select value from jsonb_array_elements(p_filas)
  loop
    v_ref := coalesce(nullif(btrim(coalesce(f ->> 'sku', '')), ''), f ->> 'id', '(sin referencia)');
    begin
      v_id := null;
      if nullif(f ->> 'id', '') is not null then
        v_id := (f ->> 'id')::integer;
      else
        select id into v_id from public.variantes where sku = nullif(btrim(coalesce(f ->> 'sku', '')), '');
      end if;
      if v_id is null or not exists (select 1 from public.variantes where id = v_id) then
        raise exception 'No existe una presentación con esa referencia.' using errcode = 'P0002';
      end if;

      select true, vc.costo, vc.stock into v_existe, v_costo_ant, v_stock_ant
      from public.variante_costos vc where vc.variante_id = v_id;
      v_existe := coalesce(v_existe, false);

      v_costo := case when f ? 'costo' then (f ->> 'costo')::integer else v_costo_ant end;
      v_stock := case when f ? 'stock' then (f ->> 'stock')::integer else v_stock_ant end;
      if v_costo is not null and v_costo < 0 then
        raise exception 'El costo no puede ser negativo.' using errcode = 'P0001';
      end if;

      if v_existe and v_costo is not distinct from v_costo_ant and v_stock is not distinct from v_stock_ant then
        c_igual := c_igual + 1;
      else
        insert into public.variante_costos (variante_id, costo, stock, stock_actualizado_at)
        values (v_id, v_costo, v_stock, case when f ? 'stock' then now() end)
        on conflict (variante_id) do update set
          costo = excluded.costo,
          stock = excluded.stock,
          stock_actualizado_at = case
            when v_stock is distinct from v_stock_ant then now()
            else public.variante_costos.stock_actualizado_at end;
        c_act := c_act + 1;
      end if;
    exception when others then
      v_errores := v_errores || jsonb_build_object('ref', v_ref, 'mensaje', sqlerrm);
    end;
  end loop;

  return jsonb_build_object('actualizadas', c_act, 'sin_cambios', c_igual, 'errores', v_errores);
end;
$$;

revoke execute on function public.guardar_costos(jsonb) from public, anon;
grant execute on function public.guardar_costos(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. v_ganancia_pedidos: venta, costo y ganancia de cada pedido
-- ---------------------------------------------------------------------------
-- · Mide solo los PRODUCTOS (no el envío: su costo real no lo conocemos).
-- · Usa el costo copiado al crear el pedido (RN-15), no el costo de hoy.
-- · items_sin_costo > 0 significa que la ganancia es parcial (hay líneas sin costo).
-- · security_invoker: respeta el RLS de quien consulta; además el WHERE deja la vista
--   vacía para el vendedor (aunque pudiera leer los pedidos de sus sectores).
create view public.v_ganancia_pedidos
with (security_invoker = true) as
select
  p.id as pedido_id,
  coalesce(sum(i.cantidad::bigint * i.precio_unitario_aplicado), 0)::bigint as venta_items,
  coalesce(sum(i.cantidad::bigint * c.costo) filter (where c.costo is not null), 0)::bigint as costo_items,
  coalesce(sum(i.cantidad::bigint * (i.precio_unitario_aplicado - c.costo)) filter (where c.costo is not null), 0)::bigint as ganancia_items,
  (count(*) filter (where c.costo is null))::integer as items_sin_costo
from public.pedidos p
join public.pedido_items i on i.pedido_id = p.id
left join public.pedido_item_costos c on c.pedido_item_id = i.id
where (select private.tiene_rol(array['admin','editor']::public.rol_usuario[]))
group by p.id;

grant select on public.v_ganancia_pedidos to authenticated;

-- ---------------------------------------------------------------------------
-- 6. v_inventario_admin: existencias, margen y valor del inventario
-- ---------------------------------------------------------------------------
-- valor_inventario = stock × costo, solo cuando hay stock positivo y costo conocido.
-- margen_pct = (precio − costo) / precio × 100, con un decimal.
create view public.v_inventario_admin
with (security_invoker = true) as
select
  v.id                         as variante_id,
  v.sku,
  v.producto_id,
  pr.nombre                    as producto_nombre,
  v.nombre_presentacion        as presentacion,
  m.nombre                     as marca_nombre,
  ca.nombre                    as categoria_nombre,
  v.activo,
  v.precio_unidad,
  vc.costo,
  vc.stock,
  vc.stock_actualizado_at,
  case when v.precio_unidad > 0 and vc.costo is not null
       then v.precio_unidad - vc.costo end                                  as ganancia_unitaria,
  case when v.precio_unidad > 0 and vc.costo is not null
       then round((v.precio_unidad - vc.costo) * 100.0 / v.precio_unidad, 1) end as margen_pct,
  case when vc.stock > 0 and vc.costo is not null
       then vc.stock::bigint * vc.costo end                                 as valor_inventario
from public.variantes v
join public.productos pr on pr.id = v.producto_id
left join public.marcas m on m.id = pr.marca_id
left join public.categorias ca on ca.id = pr.categoria_id
left join public.variante_costos vc on vc.variante_id = v.id
where (select private.tiene_rol(array['admin','editor']::public.rol_usuario[]));

grant select on public.v_inventario_admin to authenticated;
