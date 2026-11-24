-- =============================================================================
-- 0014_catalogo_publico_rapido.sql — Catálogo público rápido (auditoría S-04, RNF-03)
--
-- PROBLEMA. Para el visitante (rol anon), contar la vista v_tienda_productos o buscar tardaba
-- ~1,9 s con 1.626 productos. Las políticas de seguridad por fila (RLS) de productos, variantes,
-- categorías e imágenes llamaban a una función POR CADA FILA (producto_visible, producto_publicable,
-- categoria_publica…), y cada llamada hace sus propias consultas: ~10.000 llamadas por consulta.
--
-- SOLUCIÓN. Las mismas reglas de RN-01, pero calculadas UNA SOLA VEZ por consulta: cada función
-- devuelve el conjunto de ids visibles y la política pregunta «¿mi id está en ese conjunto?»
-- (una subconsulta sin correlación: Postgres la calcula una vez y la guarda en una tabla hash).
--
-- NO CAMBIA LAS REGLAS NI EL MODELO DE DATOS:
--   · Categoría pública  = activa y (sin padre o con el padre activo).
--   · Producto publicable = activo y en una categoría pública.
--   · Producto visible   = publicable y con al menos una presentación activa con precio > 0.
--   · Presentación pública = activa, con precio > 0 y de un producto publicable.
--   · Imagen pública     = de un producto visible.
-- Las funciones anteriores (categoria_publica, producto_publicable, producto_visible,
-- tiene_variante_visible) se conservan: otras partes de la base pueden usarlas.
--
-- Las vistas siguen siendo SECURITY INVOKER: no se saltan RLS. Solo cambia CÓMO se calcula.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Conjuntos de ids visibles (SECURITY DEFINER: leen sin pasar por RLS, como las funciones
--    anteriores; devuelven solo ids de lo que ya es público)
-- ---------------------------------------------------------------------------
create or replace function private.categorias_publicas_ids()
returns setof integer
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.categorias c
  left join public.categorias cp on cp.id = c.parent_id
  where c.activa and (cp.id is null or cp.activa)
$$;

create or replace function private.productos_publicables_ids()
returns setof integer
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.productos p
  join private.categorias_publicas_ids() cp(id) on cp.id = p.categoria_id
  where p.activo
$$;

create or replace function private.productos_visibles_ids()
returns setof integer
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from private.productos_publicables_ids() p(id)
  where exists (
    select 1 from public.variantes v
    where v.producto_id = p.id and v.activo and v.precio_unidad > 0
  )
$$;

-- Las políticas se evalúan con el rol de quien consulta: necesita poder ejecutarlas.
revoke execute on function private.categorias_publicas_ids() from public;
revoke execute on function private.productos_publicables_ids() from public;
revoke execute on function private.productos_visibles_ids() from public;
grant execute on function private.categorias_publicas_ids() to anon, authenticated;
grant execute on function private.productos_publicables_ids() to anon, authenticated;
grant execute on function private.productos_visibles_ids() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Políticas de lectura pública con las mismas reglas, ahora por conjuntos
-- ---------------------------------------------------------------------------
alter policy categorias_leer_publico on public.categorias
  using (id in (select i from private.categorias_publicas_ids() as t(i)));

alter policy productos_leer_publico on public.productos
  using (id in (select i from private.productos_visibles_ids() as t(i)));

alter policy variantes_leer_publico on public.variantes
  using (
    activo
    and precio_unidad > 0
    and producto_id in (select i from private.productos_publicables_ids() as t(i))
  );

alter policy producto_imagenes_leer_publico on public.producto_imagenes
  using (producto_id in (select i from private.productos_visibles_ids() as t(i)));
