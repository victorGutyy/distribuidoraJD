-- =============================================================================
-- 0015_timeout_anon_3s.sql — Devuelve el límite de tiempo del visitante a 3 s
--
-- La migración 0013 lo subió a 8 s como parche mientras la búsqueda tardaba ~2,4 s.
-- Con la 0014 una consulta pública tarda entre 30 y 360 ms, así que se restablece el
-- valor original de Supabase: una consulta lenta o abusiva se corta a los 3 s.
-- =============================================================================
alter role anon set statement_timeout = '3s';
notify pgrst, 'reload config';
