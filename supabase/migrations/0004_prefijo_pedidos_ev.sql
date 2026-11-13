-- =============================================================================
-- 0004_prefijo_pedidos_ev.sql — El número de pedido pasa de "JD-" a "EV-"
--
-- El negocio se llama EV Distribuidora (el prefijo "JD-" venía de un logo y unos
-- documentos de otro proyecto). RN-07: número consecutivo y único, "EV-" + 6 dígitos.
--
-- Solo cambia el valor por defecto de la columna; no toca pedidos ya creados
-- (al aplicarla no existe ninguno) ni reinicia la secuencia, así que la
-- numeración sigue consecutiva.
-- =============================================================================

alter table public.pedidos
  alter column numero set default
    ('EV-' || lpad(nextval('public.pedido_numero_seq')::text, 6, '0'));
