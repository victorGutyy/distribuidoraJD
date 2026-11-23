-- =============================================================================
-- 0012_resumen_costos.sql — Totales de ganancia e inventario (RF-32)
--
-- Qué agrega:
--   1) resumen_costos(p_desde): ganancia de los pedidos desde una fecha y totales del
--      inventario, en UNA llamada. Lo usan el dashboard y /admin/inventario.
--   2) v_inventario_admin.texto_busqueda: texto sin tildes ni mayúsculas para el buscador
--      (igual que v_pedidos_admin y v_precios_admin).
--
-- Seguridad: SECURITY INVOKER + chequeo de rol. Un vendedor (o la tienda) recibe error 42501.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. resumen_costos
-- ---------------------------------------------------------------------------
-- · Ganancia = solo PRODUCTOS (sin envío), con el costo copiado al crear cada pedido (RN-15).
-- · No cuenta los pedidos cancelados.
-- · lineas_sin_costo > 0 significa que la ganancia es parcial.
-- · valor_inventario = suma de stock × costo, solo con stock positivo y costo conocido.
create or replace function public.resumen_costos(p_desde timestamptz)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_pedidos jsonb;
  v_inventario jsonb;
begin
  if not private.tiene_rol(array['admin', 'editor']::public.rol_usuario[]) then
    raise exception 'No tienes permiso para ver costos.' using errcode = '42501';
  end if;
  if p_desde is null then
    raise exception 'Falta la fecha de inicio.' using errcode = 'P0001';
  end if;

  select jsonb_build_object(
    'pedidos', count(distinct p.id),
    'venta', coalesce(sum(i.cantidad::bigint * i.precio_unitario_aplicado), 0),
    'ganancia', coalesce(sum(i.cantidad::bigint * (i.precio_unitario_aplicado - c.costo))
                         filter (where c.costo is not null), 0),
    'venta_con_costo', coalesce(sum(i.cantidad::bigint * i.precio_unitario_aplicado)
                                filter (where c.costo is not null), 0),
    'lineas_sin_costo', count(*) filter (where c.costo is null)
  )
  into v_pedidos
  from public.pedidos p
  join public.pedido_items i on i.pedido_id = p.id
  left join public.pedido_item_costos c on c.pedido_item_id = i.id
  where p.created_at >= p_desde
    and p.estado <> 'cancelado';

  select jsonb_build_object(
    'valor_inventario', coalesce(sum(vc.stock::bigint * vc.costo)
                                 filter (where vc.stock > 0 and vc.costo is not null), 0),
    'con_stock', count(*) filter (where vc.stock > 0),
    'sin_stock', count(*) filter (where vc.stock = 0),
    'negativos', count(*) filter (where vc.stock < 0),
    'sin_costo', (select count(*) from public.variantes v2
                  where not exists (select 1 from public.variante_costos x
                                    where x.variante_id = v2.id and x.costo is not null))
  )
  into v_inventario
  from public.variante_costos vc;

  return jsonb_build_object('pedidos', v_pedidos, 'inventario', v_inventario);
end;
$$;

revoke execute on function public.resumen_costos(timestamptz) from public, anon;
grant execute on function public.resumen_costos(timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. v_inventario_admin: columna de búsqueda (se agrega AL FINAL, como exige create or replace view)
-- ---------------------------------------------------------------------------
create or replace view public.v_inventario_admin
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
       then vc.stock::bigint * vc.costo end                                 as valor_inventario,
  public.f_unaccent(lower(
    pr.nombre || ' ' || coalesce(m.nombre, '') || ' ' || v.sku || ' ' || coalesce(v.nombre_presentacion, '')
  ))                                                                        as texto_busqueda
from public.variantes v
join public.productos pr on pr.id = v.producto_id
left join public.marcas m on m.id = pr.marca_id
left join public.categorias ca on ca.id = pr.categoria_id
left join public.variante_costos vc on vc.variante_id = v.id
where (select private.tiene_rol(array['admin','editor']::public.rol_usuario[]));
