-- =============================================================================
-- 0007_precios_admin.sql — Vista para el editor rápido de precios (F3c)
--
-- Una fila por PRESENTACIÓN con los datos de su producto, marca y categoría, y un
-- texto de búsqueda sin tildes. Permite filtrar (solo sin precio, categoría,
-- marca, texto) y paginar por presentaciones directamente en la base de datos.
--
-- security_invoker = respeta el RLS de quien consulta (igual que v_productos_admin).
-- Los privilegios por defecto de `public` ya no dan acceso a anon (0002): solo se
-- concede lectura al personal autenticado.
-- No cambia el modelo de datos: solo agrega una vista.
-- =============================================================================

create view public.v_precios_admin
with (security_invoker = true) as
select
  v.id,
  v.producto_id,
  v.sku,
  p.nombre                      as producto_nombre,
  v.nombre_presentacion,
  p.categoria_id,
  c.nombre                      as categoria_nombre,
  cp.nombre                     as categoria_padre_nombre,
  p.marca_id,
  m.nombre                      as marca_nombre,
  v.precio_unidad,
  v.precio_mayor,
  v.cantidad_min_mayor,
  v.en_oferta,
  v.precio_oferta,
  v.disponible,
  v.activo,
  p.activo                      as producto_activo,
  (v.precio_unidad is null)     as sin_precio,
  -- Nombre, marca, SKU y presentación, sin tildes ni mayúsculas (buscador del panel).
  public.f_unaccent(lower(
    p.nombre || ' ' || coalesce(m.nombre, '') || ' ' || v.sku || ' ' ||
    coalesce(v.nombre_presentacion, '')
  ))                            as texto_busqueda,
  v.orden
from public.variantes v
join public.productos p on p.id = v.producto_id
join public.categorias c on c.id = p.categoria_id
left join public.categorias cp on cp.id = c.parent_id
left join public.marcas m on m.id = p.marca_id;

grant select on public.v_precios_admin to authenticated;
