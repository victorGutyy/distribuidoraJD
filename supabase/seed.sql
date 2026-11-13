-- =============================================================================
-- seed.sql — Datos iniciales de Distribuidora JD (F1)
-- Es idempotente: se puede ejecutar varias veces sin duplicar datos.
-- NO es una migración: son datos, no esquema. Se ejecuta aparte, tras 0001-0003.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Primer administrador
-- Pasa a 'admin' y activo al usuario creado a mano en Authentication.
-- (El correo es el del dueño del proyecto; cambia el valor si fuera otro.)
-- ---------------------------------------------------------------------------
update public.perfiles p
set rol = 'admin', activo = true, nombre = coalesce(nullif(p.nombre, ''), 'Administrador')
from auth.users u
where u.id = p.id
  and u.email = 'vicalf0424@gmail.com';

-- ---------------------------------------------------------------------------
-- 2. Municipios del Quindío
-- Quedan INACTIVOS: aún no sabemos cuáles atiende JD ni sus sectores y días de
-- reparto (pregunta abierta #4 del documento madre). El admin los activa en F6.
-- ---------------------------------------------------------------------------
insert into public.municipios (nombre, departamento, activo) values
  ('Armenia',    'Quindío', false),
  ('Buenavista', 'Quindío', false),
  ('Calarcá',    'Quindío', false),
  ('Circasia',   'Quindío', false),
  ('Córdoba',    'Quindío', false),
  ('Filandia',   'Quindío', false),
  ('Génova',     'Quindío', false),
  ('La Tebaida', 'Quindío', false),
  ('Montenegro', 'Quindío', false),
  ('Pijao',      'Quindío', false),
  ('Quimbaya',   'Quindío', false),
  ('Salento',    'Quindío', false)
on conflict (nombre) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Configuración inicial (RF-30)
-- Solo valores neutros. Lo que depende del cliente queda en null hasta que lo
-- defina (preguntas abiertas #2, #3, #5 y #6): no se inventa.
-- ---------------------------------------------------------------------------
insert into public.configuracion (clave, valor) values
  ('whatsapp_pedidos',          'null'::jsonb),             -- pregunta #6
  ('mensaje_whatsapp_flotante', to_jsonb('Hola, quiero hacer un pedido en Distribuidora JD'::text)),
  ('pedido_minimo',             to_jsonb(0)),               -- pregunta #3 (0 = sin mínimo)
  ('regla_mayoreo',             to_jsonb('por_cantidad'::text)),  -- pregunta #2: por_cantidad | por_monto | ambas
  ('umbral_mayor_monto',        to_jsonb(0)),
  ('hora_corte',                'null'::jsonb),             -- pregunta #5
  ('dias_no_habiles',           '[]'::jsonb),
  ('mensaje_barra_superior',    to_jsonb('Compra por mayor y ahorra'::text)),
  ('empresa',                   jsonb_build_object(
      'nombre', 'Distribuidora JD',
      'nit', null,
      'direccion', null,
      'horarios', null,
      'redes', '{}'::jsonb))
on conflict (clave) do nothing;
