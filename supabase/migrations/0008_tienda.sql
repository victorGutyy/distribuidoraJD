-- =============================================================================
-- 0008_tienda.sql — Datos de la tienda pública (F4)
--
-- Contiene:
--   1) v_tienda_productos : v_catalogo_publico + la presentación principal (precios
--                           unidad/mayor/oferta) + texto de búsqueda sin tildes.
--   2) buscar_catalogo()  : búsqueda por palabras, sin tildes ni mayúsculas, que
--                           tolera errores de escritura (pg_trgm), RF-04.
--   3) conteos_catalogo() : cuántos productos hay por categoría y por marca (RF-05).
--
-- Todo es de SOLO LECTURA y respeta RN-01 (nada de lo que no sea público aparece):
-- la vista y las funciones son SECURITY INVOKER, así que corren con los permisos y el
-- RLS de quien consulta. No cambia el modelo de datos: no crea ni modifica tablas.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Vista para las tarjetas y el listado de la tienda
-- ---------------------------------------------------------------------------
-- "Presentación principal" = la primera presentación visible del producto (la misma
-- que ya calcula v_catalogo_publico). La tarjeta muestra su precio, su precio por
-- mayor y su oferta; `precio_desde` sigue siendo el menor precio del producto.
create view public.v_tienda_productos
with (security_invoker = true) as
select
  v.id,
  v.nombre,
  v.slug,
  v.descripcion,
  v.etiquetas,
  v.destacado,
  v.es_nuevo,
  v.categoria_id,
  v.categoria_slug,
  v.categoria_nombre,
  c.parent_id                                  as categoria_padre_id,
  v.marca_id,
  v.marca_nombre,
  v.marca_slug,
  v.variantes_visibles,
  v.precio_desde,
  v.hay_oferta,
  v.disponible,
  v.imagen_url,
  v.imagen_miniatura_url,
  v.created_at,
  pv.id                                        as variante_principal_id,
  pv.nombre_presentacion                       as presentacion_principal,
  pv.precio_unidad                             as precio_principal,
  pv.precio_mayor                              as precio_mayor_principal,
  pv.cantidad_min_mayor                        as cantidad_min_mayor_principal,
  (pv.en_oferta and pv.precio_oferta is not null) as en_oferta_principal,
  pv.precio_oferta                             as precio_oferta_principal,
  pv.disponible                                as disponible_principal,
  -- Nombre, marca, categoría (y su padre), etiquetas y SKU, sin tildes ni mayúsculas.
  public.f_unaccent(lower(concat_ws(' ',
    v.nombre, v.marca_nombre, v.categoria_nombre, cp.nombre,
    array_to_string(v.etiquetas, ' '), sk.skus
  )))                                          as texto_busqueda
from public.v_catalogo_publico v
join public.categorias c on c.id = v.categoria_id
left join public.categorias cp on cp.id = c.parent_id
join public.variantes pv on pv.id = v.variante_principal_id
cross join lateral (
  select string_agg(x.sku, ' ' order by x.orden, x.id) as skus
  from public.variantes x
  where x.producto_id = v.id and x.activo and x.precio_unidad > 0
) sk;

-- El visitante (anon) y el personal (authenticated) pueden leerla; RLS decide qué filas.
grant select on public.v_tienda_productos to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Búsqueda (RF-04)
-- ---------------------------------------------------------------------------
-- Cada palabra de la búsqueda debe aparecer en el texto del producto, o parecerse
-- mucho (word_similarity >= 0.5: "lenteja" ≈ "lentejas", "colgte" ≈ "Colgate").
-- Devuelve los ids con su relevancia (1 = coincidencia exacta de todas las palabras).
-- Máximo 6 palabras y 500 resultados. Los comodines de LIKE (% _ \) se escapan.
create or replace function public.buscar_catalogo(p_q text, p_limite integer default 300)
returns table (id integer, relevancia real)
language sql
stable
set search_path = ''
as $$
  with palabras as (
    select
      w,
      replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') as patron
    from regexp_split_to_table(
      public.f_unaccent(lower(btrim(coalesce(p_q, '')))), '\s+'
    ) as w
    where length(w) >= 2
    limit 6
  ),
  total as (select count(*)::integer as n from palabras)
  select v.id, avg(s.puntaje)::real as relevancia
  from public.v_tienda_productos v
  cross join palabras pa
  cross join lateral (
    select case
      when v.texto_busqueda like '%' || pa.patron || '%' then 1.0
      else extensions.word_similarity(pa.w, v.texto_busqueda)::numeric
    end as puntaje
  ) s
  group by v.id
  having (select n from total) > 0
     and count(*) filter (where s.puntaje >= 0.5) = (select n from total)
  order by 2 desc, v.id
  limit greatest(1, least(coalesce(p_limite, 300), 500))
$$;

revoke execute on function public.buscar_catalogo(text, integer) from public;
grant execute on function public.buscar_catalogo(text, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Conteos para los filtros (RF-05)
-- ---------------------------------------------------------------------------
-- tipo = 'categoria' | 'marca'. Las categorías cuentan solo los productos que están
-- directamente en ellas; la aplicación suma las hijas en su categoría principal.
create or replace function public.conteos_catalogo()
returns table (tipo text, id integer, n integer)
language sql
stable
set search_path = ''
as $$
  select 'categoria'::text, categoria_id, count(*)::integer
  from public.v_tienda_productos
  group by categoria_id
  union all
  select 'marca'::text, marca_id, count(*)::integer
  from public.v_tienda_productos
  where marca_id is not null
  group by marca_id
$$;

revoke execute on function public.conteos_catalogo() from public;
grant execute on function public.conteos_catalogo() to anon, authenticated;
