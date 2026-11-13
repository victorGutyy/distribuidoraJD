-- =============================================================================
-- 0003_perfiles.sql — Perfil automático para cada usuario de Supabase Auth (F1)
--
-- Cuando se crea un usuario en Authentication, este disparador le crea su fila
-- en public.perfiles con el rol más bajo ('vendedor') y activo = false: nadie
-- entra al panel hasta que un admin lo active y le asigne rol (RF-20, RF-31).
-- =============================================================================

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nombre'), ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Perfiles para los usuarios que YA existían antes de este disparador
-- (p. ej. el usuario administrador creado a mano en el panel de Supabase).
insert into public.perfiles (id, nombre)
select u.id, coalesce(nullif(btrim(u.raw_user_meta_data ->> 'nombre'), ''), split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;
