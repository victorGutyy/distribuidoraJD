-- =============================================================================
-- 0005_productos_admin.sql — Soporte de F2: productos, variantes e imágenes
--
-- Contiene:
--   1) v_productos_admin  : vista para la tabla de productos del panel
--   2) guardar_producto() : guarda producto + presentaciones en UNA transacción
--   3) Bucket de Storage "catalogo" y sus políticas (imágenes de productos)
--
-- Reglas: RN-01 (visibilidad), RN-05 (precios enteros), RN-08/RN-10 (pedidos).
-- No cambia el modelo de datos: solo agrega una vista, una función y un bucket.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Vista para la tabla del panel (RF-24)
-- ---------------------------------------------------------------------------
-- security_invoker = respeta el RLS de quien consulta: solo el personal del panel
-- ve productos sin precio o inactivos. El visitante NO tiene acceso a esta vista.
create view public.v_productos_admin
with (security_invoker = true) as
select
  p.id,
  p.nombre,
  p.slug,
  p.activo,
  p.destacado,
  p.es_nuevo,
  p.categoria_id,
  c.nombre                         as categoria_nombre,
  cp.nombre                        as categoria_padre_nombre,
  p.marca_id,
  m.nombre                         as marca_nombre,
  vv.n_variantes,
  vv.n_con_precio,
  vv.precio_min,
  vv.precio_max,
  vv.hay_oferta,
  vv.skus,
  (img.url is not null)            as tiene_imagen,
  coalesce(img.url_miniatura, img.url) as imagen_miniatura_url,
  -- 'borrador' = ninguna presentación activa con precio (no se ve en la tienda).
  case
    when not p.activo then 'inactivo'
    when vv.n_con_precio = 0 then 'borrador'
    else 'activo'
  end                              as estado,
  -- RN-01 completo: además exige que la categoría (y su padre) estén activas.
  (p.activo and vv.n_con_precio > 0 and private.categoria_publica(p.categoria_id))
                                   as visible_en_tienda,
  -- Texto sin tildes ni mayúsculas para el buscador del panel (nombre, marca y SKU).
  public.f_unaccent(lower(
    p.nombre || ' ' || coalesce(m.nombre, '') || ' ' || coalesce(vv.skus, '')
  ))                               as texto_busqueda,
  p.created_at,
  p.updated_at
from public.productos p
join public.categorias c on c.id = p.categoria_id
left join public.categorias cp on cp.id = c.parent_id
left join public.marcas m on m.id = p.marca_id
cross join lateral (
  select
    count(*)::integer                                                 as n_variantes,
    (count(*) filter (where v.activo and v.precio_unidad > 0))::integer as n_con_precio,
    min(v.precio_unidad) filter (where v.precio_unidad > 0)           as precio_min,
    max(v.precio_unidad) filter (where v.precio_unidad > 0)           as precio_max,
    coalesce(bool_or(v.en_oferta and v.precio_oferta is not null), false) as hay_oferta,
    string_agg(v.sku, ' ' order by v.orden, v.id)                     as skus
  from public.variantes v
  where v.producto_id = p.id
) vv
left join lateral (
  select pi.url, pi.url_miniatura
  from public.producto_imagenes pi
  where pi.producto_id = p.id
  order by pi.es_principal desc, pi.orden, pi.id
  limit 1
) img on true;

grant select on public.v_productos_admin to authenticated;

-- ---------------------------------------------------------------------------
-- 2. guardar_producto(): producto + presentaciones en una sola transacción
-- ---------------------------------------------------------------------------
-- Una función PL/pgSQL se ejecuta como UNA transacción: si algo falla a mitad
-- (p. ej. un precio por mayor mayor que el de unidad), se deshace TODO y no
-- queda un producto a medias.
--
-- SECURITY INVOKER (el valor por defecto) = corre con los permisos de quien la
-- llama, así que RLS sigue aplicando; además se comprueba el rol explícitamente
-- para dar un mensaje claro.
--
-- p_producto: { id?, nombre, slug?, descripcion, categoria_id, marca_id,
--               etiquetas[], destacado, es_nuevo, activo }
-- p_variantes: lista de { id?, sku?, nombre_presentacion, contenido_valor,
--               contenido_unidad, unidad_venta, unidades_por_empaque, peso_g,
--               alto_cm, ancho_cm, largo_cm, precio_unidad, precio_mayor,
--               cantidad_min_mayor, en_oferta, precio_oferta, disponible, activo }
--   · Con `id` se actualiza; sin `id` se crea (y el SKU se autogenera si viene vacío).
--   · Las presentaciones que ya existían y NO vienen en la lista se eliminan,
--     salvo que ya tengan pedidos (entonces hay que desactivarlas, RN-10).
--   · El orden de la lista define el orden de las presentaciones.
--   · Se envía el producto y cada presentación COMPLETOS (como en un formulario):
--     lo que no venga se guarda como vacío (p. ej. sin marca). No es un "parche".
-- Devuelve el id del producto.
create or replace function public.guardar_producto(p_producto jsonb, p_variantes jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_id       integer := nullif(p_producto ->> 'id', '')::integer;
  v_var      jsonb;
  v_pos      bigint;
  v_var_id   integer;
  v_nuevo_id integer;
  v_ids      integer[] := '{}';
  v_sku      text;
  v_n        integer;
  v_etiquetas text[];
begin
  if not private.tiene_rol(array['admin', 'editor']::public.rol_usuario[]) then
    raise exception 'No tienes permiso para guardar productos.' using errcode = '42501';
  end if;

  if p_variantes is null
     or jsonb_typeof(p_variantes) <> 'array'
     or jsonb_array_length(p_variantes) = 0 then
    raise exception 'Agrega al menos una presentación al producto.' using errcode = 'P0001';
  end if;

  v_etiquetas := coalesce(
    array(select jsonb_array_elements_text(coalesce(p_producto -> 'etiquetas', '[]'::jsonb))),
    '{}'
  );

  -- --- Producto ------------------------------------------------------------
  if v_id is null then
    insert into public.productos
      (nombre, slug, descripcion, categoria_id, marca_id, etiquetas, destacado, es_nuevo, activo)
    values (
      p_producto ->> 'nombre',
      p_producto ->> 'slug',
      nullif(p_producto ->> 'descripcion', ''),
      (p_producto ->> 'categoria_id')::integer,
      nullif(p_producto ->> 'marca_id', '')::integer,
      v_etiquetas,
      coalesce((p_producto ->> 'destacado')::boolean, false),
      coalesce((p_producto ->> 'es_nuevo')::boolean, false),
      coalesce((p_producto ->> 'activo')::boolean, true)
    )
    returning id into v_id;
  else
    -- El slug (la URL) no cambia al renombrar el producto.
    update public.productos set
      nombre       = p_producto ->> 'nombre',
      descripcion  = nullif(p_producto ->> 'descripcion', ''),
      categoria_id = (p_producto ->> 'categoria_id')::integer,
      marca_id     = nullif(p_producto ->> 'marca_id', '')::integer,
      etiquetas    = v_etiquetas,
      destacado    = coalesce((p_producto ->> 'destacado')::boolean, false),
      es_nuevo     = coalesce((p_producto ->> 'es_nuevo')::boolean, false),
      activo       = coalesce((p_producto ->> 'activo')::boolean, true)
    where id = v_id;
    if not found then
      raise exception 'El producto ya no existe.' using errcode = 'P0002';
    end if;
  end if;

  -- --- Presentaciones (variantes) -------------------------------------------
  for v_var, v_pos in
    select value, ordinality from jsonb_array_elements(p_variantes) with ordinality
  loop
    v_var_id := nullif(v_var ->> 'id', '')::integer;
    v_sku    := nullif(btrim(coalesce(v_var ->> 'sku', '')), '');

    if v_var_id is null then
      -- SKU autogenerado: EV-<id del producto, 5 dígitos>-<consecutivo, 2 dígitos>.
      -- Se usa el MAYOR consecutivo existente + 1 (no el conteo) para no repetir un
      -- SKU si antes se quitó una presentación.
      if v_sku is null then
        select coalesce(max(substring(sku from '-([0-9]+)$')::integer), 0) + 1
          into v_n
          from public.variantes
         where producto_id = v_id
           and sku ~ ('^EV-' || lpad(v_id::text, 5, '0') || '-[0-9]+$');
        v_sku := 'EV-' || lpad(v_id::text, 5, '0') || '-' || lpad(v_n::text, 2, '0');
      end if;

      insert into public.variantes (
        producto_id, sku, nombre_presentacion, contenido_valor, contenido_unidad,
        unidad_venta, unidades_por_empaque, peso_g, alto_cm, ancho_cm, largo_cm,
        precio_unidad, precio_mayor, cantidad_min_mayor, en_oferta, precio_oferta,
        disponible, orden, activo
      ) values (
        v_id, v_sku,
        nullif(v_var ->> 'nombre_presentacion', ''),
        (v_var ->> 'contenido_valor')::numeric,
        nullif(v_var ->> 'contenido_unidad', ''),
        coalesce(nullif(v_var ->> 'unidad_venta', ''), 'individual'),
        coalesce((v_var ->> 'unidades_por_empaque')::integer, 1),
        (v_var ->> 'peso_g')::integer,
        (v_var ->> 'alto_cm')::numeric,
        (v_var ->> 'ancho_cm')::numeric,
        (v_var ->> 'largo_cm')::numeric,
        (v_var ->> 'precio_unidad')::integer,
        (v_var ->> 'precio_mayor')::integer,
        (v_var ->> 'cantidad_min_mayor')::integer,
        coalesce((v_var ->> 'en_oferta')::boolean, false),
        (v_var ->> 'precio_oferta')::integer,
        coalesce((v_var ->> 'disponible')::boolean, true),
        v_pos::integer,
        coalesce((v_var ->> 'activo')::boolean, true)
      )
      returning id into v_nuevo_id;
      v_ids := v_ids || v_nuevo_id;
    else
      update public.variantes set
        -- Si no se envía un SKU, se conserva el que ya tenía.
        sku                  = coalesce(v_sku, sku),
        nombre_presentacion  = nullif(v_var ->> 'nombre_presentacion', ''),
        contenido_valor      = (v_var ->> 'contenido_valor')::numeric,
        contenido_unidad     = nullif(v_var ->> 'contenido_unidad', ''),
        unidad_venta         = coalesce(nullif(v_var ->> 'unidad_venta', ''), 'individual'),
        unidades_por_empaque = coalesce((v_var ->> 'unidades_por_empaque')::integer, 1),
        peso_g               = (v_var ->> 'peso_g')::integer,
        alto_cm              = (v_var ->> 'alto_cm')::numeric,
        ancho_cm             = (v_var ->> 'ancho_cm')::numeric,
        largo_cm             = (v_var ->> 'largo_cm')::numeric,
        precio_unidad        = (v_var ->> 'precio_unidad')::integer,
        precio_mayor         = (v_var ->> 'precio_mayor')::integer,
        cantidad_min_mayor   = (v_var ->> 'cantidad_min_mayor')::integer,
        en_oferta            = coalesce((v_var ->> 'en_oferta')::boolean, false),
        precio_oferta        = (v_var ->> 'precio_oferta')::integer,
        disponible           = coalesce((v_var ->> 'disponible')::boolean, true),
        orden                = v_pos::integer,
        activo               = coalesce((v_var ->> 'activo')::boolean, true)
      where id = v_var_id and producto_id = v_id;
      if not found then
        raise exception 'Una presentación ya no existe. Recarga la página e inténtalo de nuevo.'
          using errcode = 'P0002';
      end if;
      v_ids := v_ids || v_var_id;
    end if;
  end loop;

  -- --- Presentaciones que ya no vienen en la lista -> se quitan ---------------
  -- RN-10: si alguna ya tiene pedidos, no se puede quitar (se desactiva).
  if exists (
    select 1
      from public.variantes v
      join public.pedido_items pi on pi.variante_id = v.id
     where v.producto_id = v_id and v.id <> all (v_ids)
  ) then
    raise exception 'Una presentación que quitaste ya tiene pedidos: desactívala en lugar de quitarla.'
      using errcode = '23503';
  end if;
  delete from public.variantes where producto_id = v_id and id <> all (v_ids);

  return v_id;
end;
$$;

-- Solo usuarios con sesión pueden llamarla (los permisos finos los da el rol dentro
-- de la función y RLS). Supabase concede EXECUTE a anon por defecto: se retira.
revoke execute on function public.guardar_producto(jsonb, jsonb) from public, anon;
grant execute on function public.guardar_producto(jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Storage: bucket "catalogo" para las imágenes de productos
-- ---------------------------------------------------------------------------
-- Público para LEER (las imágenes se muestran en la tienda por su URL); escribir
-- y borrar solo lo hace el personal con rol admin o editor.
-- Límite de 2 MB por archivo: el navegador ya las comprime a WebP (< 200 KB),
-- así que esto es solo una red de seguridad.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalogo', 'catalogo', true, 2097152,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy catalogo_leer_staff on storage.objects
  for select to authenticated
  using (bucket_id = 'catalogo' and (select private.es_staff()));

create policy catalogo_subir on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'catalogo'
    and (select private.tiene_rol(array['admin', 'editor']::public.rol_usuario[]))
  );

create policy catalogo_actualizar on storage.objects
  for update to authenticated
  using (
    bucket_id = 'catalogo'
    and (select private.tiene_rol(array['admin', 'editor']::public.rol_usuario[]))
  )
  with check (
    bucket_id = 'catalogo'
    and (select private.tiene_rol(array['admin', 'editor']::public.rol_usuario[]))
  );

create policy catalogo_borrar on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'catalogo'
    and (select private.tiene_rol(array['admin', 'editor']::public.rol_usuario[]))
  );
