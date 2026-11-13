-- =============================================================================
-- 0001_init.sql — Esquema inicial de Distribuidora JD (F1)
-- Modelo: docs/01_REQUERIMIENTOS.md §5. Reglas: RN-01…RN-13.
--
-- Esta migración crea: extensiones, tipos, 16 tablas, índices, disparadores y la
-- vista pública del catálogo. NO activa RLS ni da permisos: eso es 0002_rls.sql.
-- Conviene aplicar 0001 + 0002 + 0003 seguidas (0001 sola deja tablas sin RLS).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extensiones y esquema privado
-- ---------------------------------------------------------------------------
-- unaccent: ignora tildes ("jabon" = "jabón"). pg_trgm: tolera errores de
-- escritura ("colgte" ≈ "colgate"). En Supabase las extensiones viven en "extensions".
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Esquema "private": funciones auxiliares que la API (PostgREST) NO expone.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Tipos enumerados
-- ---------------------------------------------------------------------------
create type public.rol_usuario as enum ('admin', 'editor', 'vendedor');

create type public.estado_pedido as enum (
  'nuevo', 'confirmado', 'en_preparacion', 'despachado', 'entregado', 'cancelado'
);

-- ---------------------------------------------------------------------------
-- 3. Funciones de apoyo
-- ---------------------------------------------------------------------------
-- unaccent() no es IMMUTABLE y Postgres exige funciones inmutables en columnas
-- generadas e índices. Esta envoltura fija el diccionario, lo que la hace segura.
create or replace function public.f_unaccent(texto text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, texto)
$$;

-- Mantiene updated_at al día en cada UPDATE.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Catálogo: categorías, marcas, productos, variantes, imágenes
-- ---------------------------------------------------------------------------
create table public.categorias (
  id          integer generated always as identity primary key,
  nombre      text not null check (length(btrim(nombre)) > 0),
  slug        text not null unique,
  parent_id   integer references public.categorias (id) on delete restrict,
  icono_url   text,
  orden       integer not null default 0,
  activa      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (parent_id is distinct from id)
);
create index categorias_parent_id_idx on public.categorias (parent_id);

-- RF-22: solo 2 niveles (categoría → subcategoría).
create or replace function private.categorias_dos_niveles()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is not null then
    if exists (select 1 from public.categorias where id = new.parent_id and parent_id is not null) then
      raise exception 'Solo se permiten 2 niveles de categorías (categoría y subcategoría).';
    end if;
    if exists (select 1 from public.categorias where parent_id = new.id) then
      raise exception 'Esta categoría ya tiene subcategorías y no puede pasar a ser subcategoría.';
    end if;
  end if;
  return new;
end;
$$;
create trigger categorias_dos_niveles
  before insert or update of parent_id on public.categorias
  for each row execute function private.categorias_dos_niveles();
create trigger categorias_updated_at
  before update on public.categorias
  for each row execute function private.set_updated_at();

create table public.marcas (
  id        integer generated always as identity primary key,
  nombre    text not null check (length(btrim(nombre)) > 0),
  slug      text not null unique,
  logo_url  text,
  activa    boolean not null default true
);

create table public.productos (
  id                 integer generated always as identity primary key,
  nombre             text not null check (length(btrim(nombre)) > 0),
  slug               text not null unique,
  descripcion        text,
  categoria_id       integer not null references public.categorias (id) on delete restrict,
  marca_id           integer references public.marcas (id) on delete restrict,
  etiquetas          text[] not null default '{}',
  destacado          boolean not null default false,
  es_nuevo           boolean not null default false,
  activo             boolean not null default true,
  fuente_pagina_pdf  integer,
  -- Texto digerido para el buscador (RF-04). Cubre nombre y descripción; la
  -- búsqueda por marca, categoría y SKU se resuelve en F4 con una consulta/RPC.
  busqueda           tsvector generated always as (
    to_tsvector(
      'spanish'::regconfig,
      public.f_unaccent(coalesce(nombre, '') || ' ' || coalesce(descripcion, ''))
    )
  ) stored,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index productos_categoria_id_idx on public.productos (categoria_id);
create index productos_marca_id_idx on public.productos (marca_id);
create index productos_busqueda_idx on public.productos using gin (busqueda);
create index productos_nombre_trgm_idx
  on public.productos using gin (public.f_unaccent(lower(nombre)) extensions.gin_trgm_ops);
create trigger productos_updated_at
  before update on public.productos
  for each row execute function private.set_updated_at();

create table public.variantes (
  id                   integer generated always as identity primary key,
  producto_id          integer not null references public.productos (id) on delete cascade,
  sku                  text not null unique check (length(btrim(sku)) > 0),
  nombre_presentacion  text,
  contenido_valor      numeric check (contenido_valor is null or contenido_valor > 0),
  contenido_unidad     text,
  unidad_venta         text not null default 'individual',
  unidades_por_empaque integer not null default 1 check (unidades_por_empaque >= 1),
  peso_g               integer check (peso_g is null or peso_g >= 0),
  alto_cm              numeric check (alto_cm is null or alto_cm >= 0),
  ancho_cm             numeric check (ancho_cm is null or ancho_cm >= 0),
  largo_cm             numeric check (largo_cm is null or largo_cm >= 0),
  -- RN-05: precios en pesos enteros (COP), nunca decimales. NULL = sin precio todavía.
  precio_unidad        integer check (precio_unidad is null or precio_unidad >= 0),
  precio_mayor         integer check (precio_mayor is null or precio_mayor >= 0),
  cantidad_min_mayor   integer check (cantidad_min_mayor is null or cantidad_min_mayor >= 1),
  en_oferta            boolean not null default false,
  precio_oferta        integer check (precio_oferta is null or precio_oferta >= 0),
  disponible           boolean not null default true,
  imagen_url           text,
  orden                integer not null default 0,
  activo               boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- El precio por mayor nunca puede ser mayor que el precio por unidad.
  check (precio_mayor is null or precio_unidad is null or precio_mayor <= precio_unidad),
  -- Una variante "en oferta" debe tener precio de oferta.
  check (not en_oferta or precio_oferta is not null)
);
create index variantes_producto_id_idx on public.variantes (producto_id);
create trigger variantes_updated_at
  before update on public.variantes
  for each row execute function private.set_updated_at();

create table public.producto_imagenes (
  id            integer generated always as identity primary key,
  producto_id   integer not null references public.productos (id) on delete cascade,
  url           text not null,
  url_miniatura text,
  orden         integer not null default 0,
  es_principal  boolean not null default false
);
create index producto_imagenes_producto_id_idx on public.producto_imagenes (producto_id);
-- Como máximo una imagen principal por producto.
create unique index producto_imagenes_una_principal_idx
  on public.producto_imagenes (producto_id) where es_principal;

-- ---------------------------------------------------------------------------
-- 5. Zonas de entrega (RF-29)
-- ---------------------------------------------------------------------------
create table public.municipios (
  id            integer generated always as identity primary key,
  nombre        text not null unique,
  departamento  text not null default 'Quindío',
  activo        boolean not null default true
);

create table public.sectores (
  id            integer generated always as identity primary key,
  municipio_id  integer not null references public.municipios (id) on delete restrict,
  nombre        text not null check (length(btrim(nombre)) > 0),
  -- 1 = lunes … 7 = domingo. Puede haber varios días de reparto.
  dias_reparto  integer[] not null default '{}'
                check (dias_reparto <@ array[1, 2, 3, 4, 5, 6, 7]),
  costo_envio   integer not null default 0 check (costo_envio >= 0),
  activo        boolean not null default true,
  unique (municipio_id, nombre)
);
create index sectores_municipio_id_idx on public.sectores (municipio_id);

-- ---------------------------------------------------------------------------
-- 6. Clientes y pedidos
-- ---------------------------------------------------------------------------
create table public.clientes (
  id              integer generated always as identity primary key,
  -- RN-11: el cliente se identifica por celular (10 dígitos, empieza por 3).
  celular         text not null unique check (celular ~ '^3[0-9]{9}$'),
  nombre          text not null check (length(btrim(nombre)) > 0),
  nombre_negocio  text,
  documento       text,
  direccion       text,
  referencia      text,
  sector_id       integer references public.sectores (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index clientes_sector_id_idx on public.clientes (sector_id);
create trigger clientes_updated_at
  before update on public.clientes
  for each row execute function private.set_updated_at();

-- RN-07: número consecutivo y único "JD-" + 6 dígitos.
create sequence public.pedido_numero_seq;

create table public.pedidos (
  id                      integer generated always as identity primary key,
  numero                  text not null unique
                          default ('JD-' || lpad(nextval('public.pedido_numero_seq')::text, 6, '0')),
  cliente_id              integer not null references public.clientes (id) on delete restrict,
  sector_id               integer references public.sectores (id) on delete restrict,
  recoge_en_bodega        boolean not null default false,
  direccion_entrega       text,
  fecha_entrega_estimada  date,
  estado                  public.estado_pedido not null default 'nuevo',
  subtotal                integer not null check (subtotal >= 0),
  descuento_mayor         integer not null default 0 check (descuento_mayor >= 0),
  costo_envio             integer not null default 0 check (costo_envio >= 0),
  total                   integer not null check (total >= 0),
  metodo_pago             text not null default 'contraentrega',
  notas                   text,
  ip_origen               text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (total = subtotal - descuento_mayor + costo_envio),
  -- Si no recoge en bodega, hay que saber el sector y la dirección (RF-09).
  check (recoge_en_bodega or (sector_id is not null and direccion_entrega is not null))
);
create index pedidos_estado_created_at_idx on public.pedidos (estado, created_at);
create index pedidos_fecha_entrega_idx on public.pedidos (fecha_entrega_estimada);
create index pedidos_cliente_id_idx on public.pedidos (cliente_id);
create index pedidos_sector_id_idx on public.pedidos (sector_id);
-- Apoya el límite anti-abuso por IP (RN-13).
create index pedidos_ip_created_at_idx on public.pedidos (ip_origen, created_at);
create trigger pedidos_updated_at
  before update on public.pedidos
  for each row execute function private.set_updated_at();

-- RN-08: el ítem guarda una "foto" del producto y del precio aplicado.
create table public.pedido_items (
  id                        integer generated always as identity primary key,
  pedido_id                 integer not null references public.pedidos (id) on delete restrict,
  variante_id               integer references public.variantes (id) on delete set null,
  sku                       text not null,
  nombre_producto           text not null,
  presentacion              text,
  cantidad                  integer not null check (cantidad > 0),
  precio_unitario_aplicado  integer not null check (precio_unitario_aplicado >= 0),
  tipo_precio               text not null check (tipo_precio in ('unidad', 'mayor', 'oferta')),
  subtotal                  integer not null check (subtotal >= 0),
  check (subtotal = cantidad * precio_unitario_aplicado)
);
create index pedido_items_pedido_id_idx on public.pedido_items (pedido_id);
create index pedido_items_variante_id_idx on public.pedido_items (variante_id);

create table public.perfiles (
  -- Mismo id que auth.users: un perfil por cada usuario del panel.
  id                   uuid primary key references auth.users (id) on delete cascade,
  nombre               text not null,
  rol                  public.rol_usuario not null default 'vendedor',
  sectores_asignados   integer[] not null default '{}',
  -- Un usuario nuevo NO tiene acceso hasta que un admin lo active.
  activo               boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger perfiles_updated_at
  before update on public.perfiles
  for each row execute function private.set_updated_at();

-- RN-09: todo cambio de estado queda registrado (quién, cuándo y nota).
create table public.pedido_historial (
  id               integer generated always as identity primary key,
  pedido_id        integer not null references public.pedidos (id) on delete restrict,
  estado_anterior  public.estado_pedido,
  estado_nuevo     public.estado_pedido not null,
  usuario_id       uuid references auth.users (id) on delete set null,
  nota             text,
  created_at       timestamptz not null default now()
);
create index pedido_historial_pedido_id_idx on public.pedido_historial (pedido_id);
create index pedido_historial_usuario_id_idx on public.pedido_historial (usuario_id);

-- Registra el historial automáticamente. La nota se pasa con
--   select set_config('app.nota_estado', 'motivo', true);
-- dentro de la misma transacción (en F6 lo hará una función RPC).
create or replace function private.registrar_historial_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nota text := nullif(btrim(coalesce(current_setting('app.nota_estado', true), '')), '');
begin
  if tg_op = 'INSERT' then
    insert into public.pedido_historial (pedido_id, estado_anterior, estado_nuevo, usuario_id, nota)
    values (new.id, null, new.estado, (select auth.uid()), coalesce(v_nota, 'Pedido creado'));
  elsif new.estado is distinct from old.estado then
    -- RF-27: cancelar exige un motivo.
    if new.estado = 'cancelado' and v_nota is null then
      raise exception 'Cancelar un pedido requiere un motivo.';
    end if;
    insert into public.pedido_historial (pedido_id, estado_anterior, estado_nuevo, usuario_id, nota)
    values (new.id, old.estado, new.estado, (select auth.uid()), v_nota);
  end if;
  return new;
end;
$$;
create trigger pedidos_historial
  after insert or update of estado on public.pedidos
  for each row execute function private.registrar_historial_pedido();

-- RN-10: pedidos y clientes no se borran jamás; productos con pedidos tampoco.
create or replace function private.bloquear_borrado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'No se puede borrar en %: se cancela o se desactiva (RN-10).', tg_table_name;
end;
$$;
create trigger pedidos_no_borrar
  before delete on public.pedidos
  for each row execute function private.bloquear_borrado();
create trigger clientes_no_borrar
  before delete on public.clientes
  for each row execute function private.bloquear_borrado();

create or replace function private.bloquear_borrado_producto_con_pedidos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.pedido_items pi
    join public.variantes v on v.id = pi.variante_id
    where v.producto_id = old.id
  ) then
    raise exception 'Este producto tiene pedidos: desactívalo en lugar de borrarlo (RN-10).';
  end if;
  return old;
end;
$$;
create trigger productos_no_borrar_con_pedidos
  before delete on public.productos
  for each row execute function private.bloquear_borrado_producto_con_pedidos();

-- ---------------------------------------------------------------------------
-- 7. Configuración, banners, importaciones y devoluciones (fase 2, vacía)
-- ---------------------------------------------------------------------------
create table public.configuracion (
  clave       text primary key,
  valor       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);
create index configuracion_updated_by_idx on public.configuracion (updated_by);
create trigger configuracion_updated_at
  before update on public.configuracion
  for each row execute function private.set_updated_at();

create table public.banners (
  id                 integer generated always as identity primary key,
  imagen_url         text not null,
  imagen_movil_url   text,
  enlace             text,
  orden              integer not null default 0,
  activo             boolean not null default true
);

create table public.importaciones (
  id              integer generated always as identity primary key,
  usuario_id      uuid references auth.users (id) on delete set null,
  tipo            text not null,
  archivo_nombre  text,
  filas_total     integer not null default 0,
  creadas         integer not null default 0,
  actualizadas    integer not null default 0,
  errores         jsonb,
  created_at      timestamptz not null default now()
);
create index importaciones_usuario_id_idx on public.importaciones (usuario_id);

-- Fase 2: se crea desde ya para no cambiar el modelo después (documento madre §5).
create table public.devoluciones (
  id               integer generated always as identity primary key,
  pedido_id        integer not null references public.pedidos (id) on delete restrict,
  pedido_item_id   integer references public.pedido_items (id) on delete restrict,
  cantidad         integer not null check (cantidad > 0),
  motivo           text not null,
  evidencia_url    text,
  estado           text not null default 'solicitada',
  resolucion       text,
  created_at       timestamptz not null default now()
);
create index devoluciones_pedido_id_idx on public.devoluciones (pedido_id);
create index devoluciones_pedido_item_id_idx on public.devoluciones (pedido_item_id);

-- ---------------------------------------------------------------------------
-- 8. Vista pública del catálogo (RN-01)
-- ---------------------------------------------------------------------------
-- security_invoker = la vista respeta el RLS de quien la consulta (no del dueño).
-- Un producto aparece solo si: está activo, su categoría (y la categoría padre,
-- si es subcategoría) están activas y tiene ≥ 1 variante activa con precio_unidad > 0.
create view public.v_catalogo_publico
with (security_invoker = true) as
select
  p.id,
  p.nombre,
  p.slug,
  p.descripcion,
  p.etiquetas,
  p.destacado,
  p.es_nuevo,
  p.categoria_id,
  c.slug             as categoria_slug,
  c.nombre           as categoria_nombre,
  m.id               as marca_id,
  m.nombre           as marca_nombre,
  m.slug             as marca_slug,
  vv.variante_principal_id,
  vv.variantes_visibles,
  vv.precio_desde,
  vv.hay_oferta,
  vv.disponible,
  img.url            as imagen_url,
  img.url_miniatura  as imagen_miniatura_url,
  p.created_at
from public.productos p
join public.categorias c on c.id = p.categoria_id and c.activa
left join public.categorias cp on cp.id = c.parent_id
left join public.marcas m on m.id = p.marca_id
cross join lateral (
  select
    count(*)::integer                                       as variantes_visibles,
    min(v.precio_unidad)                                    as precio_desde,
    bool_or(v.en_oferta and v.precio_oferta is not null)    as hay_oferta,
    bool_or(v.disponible)                                   as disponible,
    (array_agg(v.id order by v.orden, v.id))[1]             as variante_principal_id
  from public.variantes v
  where v.producto_id = p.id and v.activo and v.precio_unidad > 0
) vv
left join lateral (
  select pi.url, pi.url_miniatura
  from public.producto_imagenes pi
  where pi.producto_id = p.id
  order by pi.es_principal desc, pi.orden, pi.id
  limit 1
) img on true
where p.activo
  and (cp.id is null or cp.activa)
  and vv.variantes_visibles > 0;
