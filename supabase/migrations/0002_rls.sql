-- =============================================================================
-- 0002_rls.sql — Row Level Security y permisos (F1)
-- Matriz de permisos: docs/01_REQUERIMIENTOS.md §6. RNF-07: RLS en TODAS las tablas.
--
-- Cómo leer este archivo:
--   1) Funciones auxiliares (esquema "private", no expuesto por la API).
--   2) Se activa RLS en las 16 tablas.
--   3) Permisos a nivel de tabla (GRANT): una primera barrera, antes de RLS.
--   4) Políticas por tabla: la segunda barrera, fila por fila.
--
-- Roles de base de datos de Supabase:
--   anon          = visitante sin sesión (la tienda pública)
--   authenticated = usuario con sesión (admin / editor / vendedor, según su perfil)
--   service_role  = el servidor de Next.js; omite RLS (solo para código de servidor)
--
-- IMPORTANTE: los pedidos, clientes e ítems los crea SOLO el servidor con
-- service_role (RN-06), por eso no hay política de INSERT para ellos.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Funciones auxiliares (SECURITY DEFINER = se ejecutan con permisos de su dueño,
--    lo que evita la recursión infinita al consultar tablas protegidas por RLS)
-- ---------------------------------------------------------------------------

-- Rol del usuario actual; NULL si no tiene sesión, no tiene perfil o está inactivo.
create or replace function private.rol_actual()
returns public.rol_usuario
language sql
stable
security definer
set search_path = ''
as $$
  select p.rol from public.perfiles p where p.id = (select auth.uid()) and p.activo
$$;

-- ¿El usuario actual tiene alguno de estos roles?
create or replace function private.tiene_rol(roles public.rol_usuario[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.rol_actual() = any (roles), false)
$$;

-- ¿Es personal del panel (cualquier rol activo)?
create or replace function private.es_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.rol_actual() is not null
$$;

-- Sectores asignados al vendedor actual.
create or replace function private.sectores_del_usuario()
returns integer[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.sectores_asignados from public.perfiles p where p.id = (select auth.uid()) and p.activo),
    '{}'::integer[]
  )
$$;

-- RN-01 (por partes). La categoría y su padre (si lo tiene) deben estar activas.
create or replace function private.categoria_publica(p_categoria_id integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.categorias c
    left join public.categorias cp on cp.id = c.parent_id
    where c.id = p_categoria_id and c.activa and (cp.id is null or cp.activa)
  )
$$;

create or replace function private.tiene_variante_visible(p_producto_id integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.variantes v
    where v.producto_id = p_producto_id and v.activo and v.precio_unidad > 0
  )
$$;

-- Producto activo en categoría pública (aunque aún no tenga precio).
create or replace function private.producto_publicable(p_producto_id integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.productos p
    where p.id = p_producto_id and p.activo and private.categoria_publica(p.categoria_id)
  )
$$;

-- RN-01 completo: lo que el público puede ver.
create or replace function private.producto_visible(p_producto_id integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.producto_publicable(p_producto_id) and private.tiene_variante_visible(p_producto_id)
$$;

-- RF-27: solo se editan ítems mientras el pedido esté 'nuevo' o 'confirmado'.
create or replace function private.pedido_editable(p_pedido_id integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pedidos p
    where p.id = p_pedido_id and p.estado in ('nuevo', 'confirmado')
  )
$$;

-- ---------------------------------------------------------------------------
-- 2. Activar RLS en TODAS las tablas
-- ---------------------------------------------------------------------------
alter table public.categorias        enable row level security;
alter table public.marcas            enable row level security;
alter table public.productos         enable row level security;
alter table public.variantes         enable row level security;
alter table public.producto_imagenes enable row level security;
alter table public.municipios        enable row level security;
alter table public.sectores          enable row level security;
alter table public.clientes          enable row level security;
alter table public.pedidos           enable row level security;
alter table public.pedido_items      enable row level security;
alter table public.pedido_historial  enable row level security;
alter table public.perfiles          enable row level security;
alter table public.configuracion     enable row level security;
alter table public.banners           enable row level security;
alter table public.importaciones     enable row level security;
alter table public.devoluciones      enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Permisos a nivel de tabla (GRANT). Mínimo privilegio.
-- ---------------------------------------------------------------------------
-- Supabase otorga TODO a anon/authenticated por defecto; lo quitamos y damos solo lo necesario.
revoke all on all tables in schema public from anon, authenticated;
-- Que las tablas que se creen en el futuro tampoco hereden permisos amplios.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;

-- Visitante (tienda pública): solo lectura de lo publicable.
grant select on
  public.categorias, public.marcas, public.productos, public.variantes,
  public.producto_imagenes, public.municipios, public.sectores,
  public.banners, public.configuracion
to anon;
grant select on public.v_catalogo_publico to anon, authenticated;

-- Usuario con sesión: lo que permitan las políticas de cada tabla.
grant select, insert, update, delete on
  public.categorias, public.marcas, public.productos, public.variantes,
  public.producto_imagenes, public.banners, public.municipios, public.sectores,
  public.configuracion, public.devoluciones
to authenticated;
grant select, insert on public.importaciones to authenticated;
grant select, update on public.perfiles, public.clientes, public.pedidos to authenticated;
grant select, update, delete on public.pedido_items to authenticated;
grant select on public.pedido_historial to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Políticas
-- Convención: <tabla>_<acción>_<quién>. Las llamadas a funciones van dentro de
-- (select ...) para que Postgres las evalúe una vez por consulta y no por fila.
-- ---------------------------------------------------------------------------

-- ===== CATEGORÍAS =====
create policy categorias_leer_publico on public.categorias
  for select to anon, authenticated
  using ((select private.categoria_publica(id)));
create policy categorias_leer_staff on public.categorias
  for select to authenticated
  using ((select private.es_staff()));
create policy categorias_insertar on public.categorias
  for insert to authenticated
  with check ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])));
create policy categorias_actualizar on public.categorias
  for update to authenticated
  using ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])))
  with check ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])));
create policy categorias_borrar on public.categorias
  for delete to authenticated
  using ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])));

-- ===== MARCAS =====
create policy marcas_leer_publico on public.marcas
  for select to anon, authenticated
  using (activa);
create policy marcas_leer_staff on public.marcas
  for select to authenticated
  using ((select private.es_staff()));
create policy marcas_insertar on public.marcas
  for insert to authenticated
  with check ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])));
create policy marcas_actualizar on public.marcas
  for update to authenticated
  using ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])))
  with check ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])));
create policy marcas_borrar on public.marcas
  for delete to authenticated
  using ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])));

-- ===== PRODUCTOS (RN-01) =====
create policy productos_leer_publico on public.productos
  for select to anon, authenticated
  using ((select private.producto_visible(id)));
create policy productos_leer_staff on public.productos
  for select to authenticated
  using ((select private.es_staff()));
create policy productos_insertar on public.productos
  for insert to authenticated
  with check ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])));
create policy productos_actualizar on public.productos
  for update to authenticated
  using ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])))
  with check ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])));
create policy productos_borrar on public.productos
  for delete to authenticated
  using ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])));

-- ===== VARIANTES =====
create policy variantes_leer_publico on public.variantes
  for select to anon, authenticated
  using (activo and precio_unidad > 0 and (select private.producto_publicable(producto_id)));
create policy variantes_leer_staff on public.variantes
  for select to authenticated
  using ((select private.es_staff()));
create policy variantes_insertar on public.variantes
  for insert to authenticated
  with check ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])));
create policy variantes_actualizar on public.variantes
  for update to authenticated
  using ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])))
  with check ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])));
create policy variantes_borrar on public.variantes
  for delete to authenticated
  using ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])));

-- ===== IMÁGENES DE PRODUCTO =====
create policy producto_imagenes_leer_publico on public.producto_imagenes
  for select to anon, authenticated
  using ((select private.producto_visible(producto_id)));
create policy producto_imagenes_leer_staff on public.producto_imagenes
  for select to authenticated
  using ((select private.es_staff()));
create policy producto_imagenes_insertar on public.producto_imagenes
  for insert to authenticated
  with check ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])));
create policy producto_imagenes_actualizar on public.producto_imagenes
  for update to authenticated
  using ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])))
  with check ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])));
create policy producto_imagenes_borrar on public.producto_imagenes
  for delete to authenticated
  using ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])));

-- ===== BANNERS (el editor también los gestiona) =====
create policy banners_leer_publico on public.banners
  for select to anon, authenticated
  using (activo);
create policy banners_leer_staff on public.banners
  for select to authenticated
  using ((select private.es_staff()));
create policy banners_insertar on public.banners
  for insert to authenticated
  with check ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])));
create policy banners_actualizar on public.banners
  for update to authenticated
  using ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])))
  with check ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])));
create policy banners_borrar on public.banners
  for delete to authenticated
  using ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])));

-- ===== MUNICIPIOS y SECTORES (solo admin escribe) =====
create policy municipios_leer_publico on public.municipios
  for select to anon, authenticated
  using (activo);
create policy municipios_leer_staff on public.municipios
  for select to authenticated
  using ((select private.es_staff()));
create policy municipios_insertar on public.municipios
  for insert to authenticated
  with check ((select private.tiene_rol(array['admin']::public.rol_usuario[])));
create policy municipios_actualizar on public.municipios
  for update to authenticated
  using ((select private.tiene_rol(array['admin']::public.rol_usuario[])))
  with check ((select private.tiene_rol(array['admin']::public.rol_usuario[])));
create policy municipios_borrar on public.municipios
  for delete to authenticated
  using ((select private.tiene_rol(array['admin']::public.rol_usuario[])));

create policy sectores_leer_publico on public.sectores
  for select to anon, authenticated
  using (activo);
create policy sectores_leer_staff on public.sectores
  for select to authenticated
  using ((select private.es_staff()));
create policy sectores_insertar on public.sectores
  for insert to authenticated
  with check ((select private.tiene_rol(array['admin']::public.rol_usuario[])));
create policy sectores_actualizar on public.sectores
  for update to authenticated
  using ((select private.tiene_rol(array['admin']::public.rol_usuario[])))
  with check ((select private.tiene_rol(array['admin']::public.rol_usuario[])));
create policy sectores_borrar on public.sectores
  for delete to authenticated
  using ((select private.tiene_rol(array['admin']::public.rol_usuario[])));

-- ===== CONFIGURACIÓN =====
-- El público solo lee una lista cerrada de claves; el resto es solo para admin.
create policy configuracion_leer_publico on public.configuracion
  for select to anon, authenticated
  using (clave in (
    'whatsapp_pedidos', 'mensaje_whatsapp_flotante', 'pedido_minimo', 'regla_mayoreo',
    'umbral_mayor_monto', 'hora_corte', 'dias_no_habiles', 'mensaje_barra_superior', 'empresa'
  ));
create policy configuracion_leer_admin on public.configuracion
  for select to authenticated
  using ((select private.tiene_rol(array['admin']::public.rol_usuario[])));
create policy configuracion_insertar on public.configuracion
  for insert to authenticated
  with check ((select private.tiene_rol(array['admin']::public.rol_usuario[])));
create policy configuracion_actualizar on public.configuracion
  for update to authenticated
  using ((select private.tiene_rol(array['admin']::public.rol_usuario[])))
  with check ((select private.tiene_rol(array['admin']::public.rol_usuario[])));
create policy configuracion_borrar on public.configuracion
  for delete to authenticated
  using ((select private.tiene_rol(array['admin']::public.rol_usuario[])));

-- ===== PERFILES =====
-- Cada usuario ve su propio perfil (el panel lo necesita para saber su rol). Admin ve todos.
create policy perfiles_leer on public.perfiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.tiene_rol(array['admin']::public.rol_usuario[])));
create policy perfiles_actualizar_admin on public.perfiles
  for update to authenticated
  using ((select private.tiene_rol(array['admin']::public.rol_usuario[])))
  with check ((select private.tiene_rol(array['admin']::public.rol_usuario[])));
-- No hay INSERT (lo hace el disparador de 0003) ni DELETE (cae en cascada con auth.users).

-- ===== PEDIDOS =====
-- Sin acceso para anon. admin y editor ven todo; el vendedor solo sus sectores.
-- Crear: solo el servidor (service_role). Cambiar estado del vendedor: se hará en F6
-- con una función RPC (RLS no puede limitar COLUMNAS, y no queremos que un vendedor
-- edite totales). Por ahora solo el admin actualiza.
create policy pedidos_leer on public.pedidos
  for select to authenticated
  using (
    (select private.tiene_rol(array['admin','editor']::public.rol_usuario[]))
    or ((select private.rol_actual()) = 'vendedor'
        and sector_id = any ((select private.sectores_del_usuario())::integer[]))
  );
create policy pedidos_actualizar_admin on public.pedidos
  for update to authenticated
  using ((select private.tiene_rol(array['admin']::public.rol_usuario[])))
  with check ((select private.tiene_rol(array['admin']::public.rol_usuario[])));

-- ===== ÍTEMS DE PEDIDO (heredan la visibilidad del pedido) =====
create policy pedido_items_leer on public.pedido_items
  for select to authenticated
  using (exists (select 1 from public.pedidos p where p.id = pedido_id));
create policy pedido_items_actualizar_admin on public.pedido_items
  for update to authenticated
  using ((select private.tiene_rol(array['admin']::public.rol_usuario[]))
         and (select private.pedido_editable(pedido_id)))
  with check ((select private.tiene_rol(array['admin']::public.rol_usuario[]))
              and (select private.pedido_editable(pedido_id)));
create policy pedido_items_borrar_admin on public.pedido_items
  for delete to authenticated
  using ((select private.tiene_rol(array['admin']::public.rol_usuario[]))
         and (select private.pedido_editable(pedido_id)));

-- ===== HISTORIAL (solo lectura; lo escribe el disparador) =====
create policy pedido_historial_leer on public.pedido_historial
  for select to authenticated
  using (exists (select 1 from public.pedidos p where p.id = pedido_id));

-- ===== CLIENTES =====
create policy clientes_leer on public.clientes
  for select to authenticated
  using (
    (select private.tiene_rol(array['admin','editor']::public.rol_usuario[]))
    or ((select private.rol_actual()) = 'vendedor'
        and sector_id = any ((select private.sectores_del_usuario())::integer[]))
  );
create policy clientes_actualizar_admin on public.clientes
  for update to authenticated
  using ((select private.tiene_rol(array['admin']::public.rol_usuario[])))
  with check ((select private.tiene_rol(array['admin']::public.rol_usuario[])));

-- ===== IMPORTACIONES (admin y editor) =====
create policy importaciones_leer on public.importaciones
  for select to authenticated
  using ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[])));
create policy importaciones_insertar on public.importaciones
  for insert to authenticated
  with check ((select private.tiene_rol(array['admin','editor']::public.rol_usuario[]))
              and usuario_id = (select auth.uid()));

-- ===== DEVOLUCIONES (fase 2: solo admin por ahora) =====
create policy devoluciones_leer on public.devoluciones
  for select to authenticated
  using ((select private.tiene_rol(array['admin']::public.rol_usuario[])));
create policy devoluciones_insertar on public.devoluciones
  for insert to authenticated
  with check ((select private.tiene_rol(array['admin']::public.rol_usuario[])));
create policy devoluciones_actualizar on public.devoluciones
  for update to authenticated
  using ((select private.tiene_rol(array['admin']::public.rol_usuario[])))
  with check ((select private.tiene_rol(array['admin']::public.rol_usuario[])));
create policy devoluciones_borrar on public.devoluciones
  for delete to authenticated
  using ((select private.tiene_rol(array['admin']::public.rol_usuario[])));
