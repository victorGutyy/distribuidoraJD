-- =============================================================================
-- 0013_pedidos_robustos.sql — Pedidos más seguros y operables (auditoría de prelanzamiento)
--
-- Qué hace (ver docs/auditoria/):
--   1. Pedidos duplicados (C-03): cada intento de compra lleva una clave única; si se reenvía
--      el mismo pedido (conexión caída), se devuelve el ya creado en vez de duplicarlo.
--   2. Consentimiento de datos (S-02, Ley 1581): cada pedido guarda CUÁNDO se aceptó la política
--      de datos y QUÉ versión del texto se aceptó.
--   3. Hueco de permisos (P-10): un vendedor ya no puede mover pedidos «recoge en bodega»
--      (sector_id NULL hacía que la comprobación no se cumpliera y el cambio procedía).
--   4. Pedido «despachado» con salida (P-04): puede volver a «confirmado» (no se entregó, se
--      reprograma) o cancelarse, siempre con motivo. Antes solo podía pasar a «entregado».
--   5. Reprogramar (P-01): nueva función reprogramar_pedido() para mover la fecha de entrega,
--      corregir la dirección o las notas, dejando constancia en el historial.
--   6. Configuración pública (S-23): el visitante solo puede leer las columnas clave y valor.
--   7. Medida provisional (S-04): el límite de tiempo del visitante sube de 3 a 8 s mientras se
--      reescribe la búsqueda lenta (migración siguiente).
--
-- Cambia el modelo de datos: agrega 3 columnas NULLABLE a pedidos (no toca datos existentes).
-- No se editan migraciones anteriores: las funciones se reemplazan con CREATE OR REPLACE.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1 y 2. Columnas nuevas en pedidos
-- ---------------------------------------------------------------------------
alter table public.pedidos
  add column if not exists clave_idempotencia uuid,
  add column if not exists acepta_datos_at timestamptz,
  add column if not exists version_politica text;

-- Una clave solo puede pertenecer a un pedido (los pedidos viejos quedan con NULL).
create unique index if not exists pedidos_clave_idempotencia_uidx
  on public.pedidos (clave_idempotencia)
  where clave_idempotencia is not null;

-- ---------------------------------------------------------------------------
-- crear_pedido(): igual que en 0009, más la clave de idempotencia y el consentimiento
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
  v_clave uuid;
  v_existente record;
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

  -- Idempotencia: si este mismo intento de compra ya creó un pedido (p. ej. se cayó la conexión
  -- antes de ver la confirmación y la persona reenvió), se devuelve ESE pedido y no se crea otro.
  -- Va antes del límite anti-abuso: un reintento legítimo nunca debe toparse con el límite.
  v_clave := nullif(p ->> 'clave_idempotencia', '')::uuid;
  if v_clave is not null then
    select id, numero into v_existente from public.pedidos where clave_idempotencia = v_clave;
    if found then
      return jsonb_build_object('id', v_existente.id, 'numero', v_existente.numero, 'repetido', true);
    end if;
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

  begin
    insert into public.pedidos (
      cliente_id, sector_id, recoge_en_bodega, direccion_entrega, fecha_entrega_estimada,
      subtotal, descuento_mayor, costo_envio, total, notas, ip_origen,
      clave_idempotencia, acepta_datos_at, version_politica)
    values (
      v_cliente_id,
      case when v_bodega then null else v_sector_id end,
      v_bodega,
      case when v_bodega then null else nullif(btrim(coalesce(p ->> 'direccion_entrega', '')), '') end,
      nullif(p ->> 'fecha_entrega_estimada', '')::date,
      v_subtotal, v_descuento, v_envio, v_total,
      nullif(btrim(coalesce(p ->> 'notas', '')), ''),
      v_ip,
      v_clave,
      now(),
      nullif(btrim(coalesce(p ->> 'version_politica', '')), '')
    )
    returning id, numero into v_pedido_id, v_numero;
  exception when unique_violation then
    -- Dos envíos idénticos a la vez: el segundo recibe el pedido que ganó el primero.
    select id, numero into v_existente from public.pedidos where clave_idempotencia = v_clave;
    if found then
      return jsonb_build_object('id', v_existente.id, 'numero', v_existente.numero, 'repetido', true);
    end if;
    raise;
  end;

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

-- Solo el servidor (clave de servicio) puede ejecutarla (igual que antes).
revoke execute on function public.crear_pedido(jsonb) from public, anon, authenticated;
grant execute on function public.crear_pedido(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 3 y 4. cambiar_estado_pedido(): corrige el hueco de permisos y da salida al «despachado»
-- ---------------------------------------------------------------------------
--   nuevo → confirmado → en_preparacion → despachado → entregado
--   cancelar: desde nuevo, confirmado, en_preparacion o despachado (motivo obligatorio).
--   despachado → confirmado: «no se entregó»; vuelve para reprogramarse (motivo obligatorio).
--   entregado y cancelado son finales.
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

  -- coalesce(..., false): un pedido sin sector (recoge en bodega) hace que la comparación dé NULL;
  -- antes eso dejaba pasar al vendedor. Ahora solo el administrador mueve los pedidos de bodega.
  if not (v_rol = 'admin'
          or (v_rol = 'vendedor'
              and coalesce(v_pedido.sector_id = any (private.sectores_del_usuario()), false))) then
    raise exception 'No tienes permiso para cambiar el estado de este pedido.' using errcode = '42501';
  end if;

  v_permitido := case v_pedido.estado
    when 'nuevo'          then p_estado in ('confirmado', 'cancelado')
    when 'confirmado'     then p_estado in ('en_preparacion', 'cancelado')
    when 'en_preparacion' then p_estado in ('despachado', 'cancelado')
    when 'despachado'     then p_estado in ('entregado', 'confirmado', 'cancelado')
    else false
  end;
  if not v_permitido then
    raise exception 'No se puede pasar un pedido de "%" a "%".', v_pedido.estado, p_estado
      using errcode = 'P0001';
  end if;

  if p_estado = 'cancelado' and v_nota is null then
    raise exception 'Cancelar un pedido requiere un motivo.' using errcode = 'P0001';
  end if;
  if v_pedido.estado = 'despachado' and p_estado = 'confirmado' and v_nota is null then
    raise exception 'Escribe por qué no se entregó (cliente ausente, rechazó, sin dinero…).' using errcode = 'P0001';
  end if;

  perform set_config('app.nota_estado',
    case when v_pedido.estado = 'despachado' and p_estado = 'confirmado'
         then 'No entregado: ' || v_nota
         else coalesce(v_nota, '') end,
    true);
  update public.pedidos set estado = p_estado where id = p_pedido_id;

  return jsonb_build_object('id', p_pedido_id, 'estado', p_estado);
end;
$$;

revoke execute on function public.cambiar_estado_pedido(integer, public.estado_pedido, text) from public, anon;
grant execute on function public.cambiar_estado_pedido(integer, public.estado_pedido, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. reprogramar_pedido(): nueva fecha, dirección o notas
-- ---------------------------------------------------------------------------
-- Quién: el administrador en cualquier pedido; el vendedor solo en pedidos de SUS sectores.
-- Cuándo: mientras el pedido no haya salido (nuevo, confirmado o en preparación).
-- La fecha no puede ser anterior a hoy (hora de Bogotá). Deja una fila en el historial.
-- p_direccion y p_notas: NULL = no tocar; en pedidos que recogen en bodega la dirección no aplica.
create or replace function public.reprogramar_pedido(
  p_pedido_id integer,
  p_fecha date,
  p_direccion text,
  p_notas text,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol public.rol_usuario := private.rol_actual();
  v_pedido public.pedidos%rowtype;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_direccion text := nullif(btrim(coalesce(p_direccion, '')), '');
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_resumen text[] := array[]::text[];
begin
  if v_rol is null then
    raise exception 'Inicia sesión para reprogramar el pedido.' using errcode = '42501';
  end if;
  if v_motivo is null then
    raise exception 'Escribe el motivo del cambio.' using errcode = 'P0001';
  end if;

  select * into v_pedido from public.pedidos where id = p_pedido_id for update;
  if not found then
    raise exception 'El pedido no existe.' using errcode = 'P0002';
  end if;

  if not (v_rol = 'admin'
          or (v_rol = 'vendedor'
              and coalesce(v_pedido.sector_id = any (private.sectores_del_usuario()), false))) then
    raise exception 'No tienes permiso para cambiar este pedido.' using errcode = '42501';
  end if;
  if v_pedido.estado not in ('nuevo', 'confirmado', 'en_preparacion') then
    raise exception 'Solo se puede reprogramar un pedido que aún no salió a reparto.' using errcode = 'P0001';
  end if;

  if p_fecha is not null and p_fecha is distinct from v_pedido.fecha_entrega_estimada then
    if p_fecha < v_hoy then
      raise exception 'La fecha de entrega no puede ser anterior a hoy.' using errcode = 'P0001';
    end if;
    v_resumen := v_resumen || ('fecha ' || coalesce(v_pedido.fecha_entrega_estimada::text, 'sin fecha') || ' → ' || p_fecha::text);
    update public.pedidos set fecha_entrega_estimada = p_fecha where id = p_pedido_id;
  end if;

  if v_direccion is not null and not v_pedido.recoge_en_bodega
     and v_direccion is distinct from v_pedido.direccion_entrega then
    if length(v_direccion) < 5 or length(v_direccion) > 150 then
      raise exception 'La dirección debe tener entre 5 y 150 caracteres.' using errcode = 'P0001';
    end if;
    v_resumen := v_resumen || 'dirección corregida';
    update public.pedidos set direccion_entrega = v_direccion where id = p_pedido_id;
  end if;

  if p_notas is not null and nullif(btrim(p_notas), '') is distinct from v_pedido.notas then
    if length(p_notas) > 300 then
      raise exception 'Las notas admiten máximo 300 caracteres.' using errcode = 'P0001';
    end if;
    v_resumen := v_resumen || 'notas actualizadas';
    update public.pedidos set notas = nullif(btrim(p_notas), '') where id = p_pedido_id;
  end if;

  if cardinality(v_resumen) = 0 then
    raise exception 'No hay cambios para guardar.' using errcode = 'P0001';
  end if;

  -- No cambia el estado, así que el disparador no escribe nada: se deja constancia aquí.
  insert into public.pedido_historial (pedido_id, estado_anterior, estado_nuevo, usuario_id, nota)
  values (p_pedido_id, v_pedido.estado, v_pedido.estado, (select auth.uid()),
          'Reprogramado (' || array_to_string(v_resumen, ', ') || '): ' || v_motivo);

  return jsonb_build_object('id', p_pedido_id);
end;
$$;

revoke execute on function public.reprogramar_pedido(integer, date, text, text, text) from public, anon;
grant execute on function public.reprogramar_pedido(integer, date, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Configuración pública: solo las columnas necesarias (S-23)
-- ---------------------------------------------------------------------------
-- La política por clave (configuracion_leer_publico) sigue igual; esto además oculta
-- updated_at y updated_by (el id interno de quien guardó la configuración) al visitante.
revoke select on public.configuracion from anon;
grant select (clave, valor) on public.configuracion to anon;

-- ---------------------------------------------------------------------------
-- 7. Medida provisional para la búsqueda lenta (S-04)
-- ---------------------------------------------------------------------------
-- La vista pública y buscar_catalogo() tardan ~2,4 s con el rol anon y su límite era 3 s:
-- una búsqueda de varias palabras podía fallar. Se sube a 8 s (el de las personas del panel)
-- MIENTRAS se reescribe la vista con índices (migración siguiente). Sigue habiendo un tope.
alter role anon set statement_timeout = '8s';
notify pgrst, 'reload config';
