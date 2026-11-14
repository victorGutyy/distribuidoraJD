-- =============================================================================
-- 0006_importacion.sql — Importación masiva de catálogo y precios (F3)
--
-- Contiene:
--   1) private.slugify() y private.slug_libre(): URLs amigables y únicas
--   2) importar_catalogo(jsonb): crea/actualiza productos y presentaciones por SKU
--   3) guardar_precios(jsonb):   actualiza precios/oferta/disponible por id o SKU
--
-- Las dos funciones son SECURITY INVOKER (corren con los permisos de quien las
-- llama: RLS sigue aplicando) y exigen rol admin o editor. Cada producto/fila se
-- procesa en un sub-bloque con EXCEPTION: si uno falla, se deshace SOLO ese y el
-- resto del lote continúa; los errores vuelven en la respuesta.
-- No cambia el modelo de datos.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Ayudantes de slug (esquema private: no expuesto por la API)
-- ---------------------------------------------------------------------------
-- "Lentejas Doña Lupe" → "lentejas-dona-lupe". Misma regla que src/lib/slug.ts.
create or replace function private.slugify(texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(
    btrim(
      regexp_replace(
        lower(public.f_unaccent(replace(coalesce(texto, ''), '&', ' y '))),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-'
    ),
    80
  )
$$;

-- Devuelve `base`, o `base-2`, `base-3`… hasta encontrar un slug libre en la tabla.
create or replace function private.slug_libre(tabla text, base text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  raiz text := coalesce(nullif(base, ''), 'sin-nombre');
  candidato text := raiz;
  n integer := 2;
  ocupado boolean;
begin
  if tabla not in ('categorias', 'marcas', 'productos') then
    raise exception 'Tabla no permitida para slugs: %', tabla;
  end if;
  loop
    execute format('select exists (select 1 from public.%I where slug = $1)', tabla)
      into ocupado using candidato;
    exit when not ocupado;
    candidato := raiz || '-' || n;
    n := n + 1;
  end loop;
  return candidato;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. importar_catalogo(p_filas)
-- ---------------------------------------------------------------------------
-- p_filas: lista de filas (una por PRESENTACIÓN) ya validadas por la aplicación:
--   { sku?, producto, categoria, subcategoria?, marca?, descripcion?, etiquetas[]?,
--     presentacion?, contenido_valor?, contenido_unidad?, unidad_venta?,
--     unidades_por_empaque?, precio_unidad?, precio_mayor?, cantidad_min_mayor?,
--     en_oferta?, precio_oferta?, disponible?, activo?, pagina_pdf? }
--   · Las filas con el mismo (producto, categoría, subcategoría, marca) forman UN producto.
--   · Con `sku` que ya existe → se actualiza esa presentación (y su producto).
--     Con `sku` nuevo → se crea. Sin `sku` → se crea con SKU autogenerado (EV-…).
--   · Una celda vacía (clave ausente o null) NO borra lo que ya hay: se conserva.
--     Así importar un archivo sin precios jamás borra precios ya puestos.
--   · Las categorías y marcas que no existan se crean (comparación sin tildes ni mayúsculas).
-- Devuelve: { productos_creados, productos_actualizados, productos_sin_cambios,
--             variantes_creadas, variantes_actualizadas, variantes_sin_cambios,
--             categorias_creadas, marcas_creadas, errores: [{sku, producto, mensaje}] }
create or replace function public.importar_catalogo(p_filas jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  g record;
  f jsonb;
  v_pos bigint;
  v_n integer;
  v_cat_raiz integer;
  v_cat_id integer;
  v_marca_id integer;
  v_prod_id integer;
  v_prod_ids integer[];
  v_var_id integer;
  v_sku text;
  v_etiquetas text[];
  v_creada boolean;
  c_prod_creados integer := 0;
  c_prod_act integer := 0;
  c_prod_igual integer := 0;
  c_var_creadas integer := 0;
  c_var_act integer := 0;
  c_var_igual integer := 0;
  c_cat_creadas integer := 0;
  c_marcas_creadas integer := 0;
  v_errores jsonb := '[]'::jsonb;
  v_filas integer;
  v_prod_cambio boolean;
  -- Contadores POR PRODUCTO. En PL/pgSQL las variables NO se deshacen cuando un
  -- sub-bloque falla (solo los datos), así que se suman a los totales únicamente
  -- al terminar bien cada producto.
  l_cat integer;
  l_marcas integer;
  l_vc integer;
  l_va integer;
  l_vi integer;
begin
  if not private.tiene_rol(array['admin', 'editor']::public.rol_usuario[]) then
    raise exception 'No tienes permiso para importar productos.' using errcode = '42501';
  end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) = 0 then
    raise exception 'No hay filas para importar.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_filas) > 1000 then
    raise exception 'Máximo 1000 filas por lote.' using errcode = 'P0001';
  end if;

  -- Un grupo por producto, en el orden en que aparece en el archivo.
  -- Se agrupa por el texto NORMALIZADO (sin tildes ni mayúsculas): "Lenteja" y
  -- "lenteja" son el mismo producto. Se conserva la primera escritura de cada dato.
  for g in
    select
      min(ord)                                          as ord,
      (array_agg(btrim(r ->> 'producto') order by ord))[1]                        as producto,
      (array_agg(btrim(coalesce(r ->> 'categoria', '')) order by ord))[1]         as categoria,
      (array_agg(btrim(coalesce(r ->> 'subcategoria', '')) order by ord))[1]      as subcategoria,
      (array_agg(btrim(coalesce(r ->> 'marca', '')) order by ord))[1]             as marca,
      jsonb_agg(r order by ord)                         as filas
    from jsonb_array_elements(p_filas) with ordinality as t(r, ord)
    group by
      lower(public.f_unaccent(btrim(r ->> 'producto'))),
      lower(public.f_unaccent(btrim(coalesce(r ->> 'categoria', '')))),
      lower(public.f_unaccent(btrim(coalesce(r ->> 'subcategoria', '')))),
      lower(public.f_unaccent(btrim(coalesce(r ->> 'marca', ''))))
    order by min(ord)
  loop
    begin  -- ← si algo falla aquí, solo se deshace ESTE producto
      v_creada := false;
      v_prod_cambio := false;
      l_cat := 0; l_marcas := 0; l_vc := 0; l_va := 0; l_vi := 0;

      -- --- Categoría (2 niveles) ---------------------------------------------
      select id into v_cat_raiz from public.categorias
       where parent_id is null and public.f_unaccent(lower(nombre)) = public.f_unaccent(lower(g.categoria));
      if v_cat_raiz is null then
        insert into public.categorias (nombre, slug, orden)
        values (g.categoria, private.slug_libre('categorias', private.slugify(g.categoria)),
                coalesce((select max(orden) from public.categorias where parent_id is null), 0) + 1)
        returning id into v_cat_raiz;
        l_cat := l_cat + 1;
      end if;
      v_cat_id := v_cat_raiz;
      if g.subcategoria <> '' then
        select id into v_cat_id from public.categorias
         where parent_id = v_cat_raiz and public.f_unaccent(lower(nombre)) = public.f_unaccent(lower(g.subcategoria));
        if v_cat_id is null then
          insert into public.categorias (nombre, slug, parent_id, orden)
          values (g.subcategoria, private.slug_libre('categorias', private.slugify(g.subcategoria)), v_cat_raiz,
                  coalesce((select max(orden) from public.categorias where parent_id = v_cat_raiz), 0) + 1)
          returning id into v_cat_id;
          l_cat := l_cat + 1;
        end if;
      end if;

      -- --- Marca --------------------------------------------------------------
      v_marca_id := null;
      if g.marca <> '' then
        select id into v_marca_id from public.marcas
         where public.f_unaccent(lower(nombre)) = public.f_unaccent(lower(g.marca));
        if v_marca_id is null then
          insert into public.marcas (nombre, slug)
          values (g.marca, private.slug_libre('marcas', private.slugify(g.marca)))
          returning id into v_marca_id;
          l_marcas := l_marcas + 1;
        end if;
      end if;

      -- --- ¿El producto ya existe? (por el SKU de cualquiera de sus presentaciones) ---
      select array_agg(distinct v.producto_id) into v_prod_ids
        from public.variantes v
       where v.sku in (select nullif(btrim(x.val ->> 'sku'), '') from jsonb_array_elements(g.filas) as x(val));
      if coalesce(array_length(v_prod_ids, 1), 0) > 1 then
        raise exception 'Los SKU de este producto pertenecen a productos distintos en el panel.' using errcode = 'P0001';
      end if;
      v_prod_id := v_prod_ids[1];

      -- Datos del producto: se toman de la primera fila del grupo que los traiga.
      f := g.filas -> 0;
      v_etiquetas := coalesce(
        array(select jsonb_array_elements_text(coalesce(f -> 'etiquetas', '[]'::jsonb))), '{}');

      if v_prod_id is null then
        insert into public.productos (nombre, slug, descripcion, categoria_id, marca_id, etiquetas, activo)
        values (g.producto,
                private.slug_libre('productos', private.slugify(g.producto)),
                nullif(btrim(coalesce(f ->> 'descripcion', '')), ''),
                v_cat_id, v_marca_id, v_etiquetas,
                coalesce((f ->> 'activo')::boolean, true))
        returning id into v_prod_id;
        v_creada := true;
      else
        update public.productos set
          nombre       = g.producto,
          descripcion  = coalesce(nullif(btrim(coalesce(f ->> 'descripcion', '')), ''), descripcion),
          categoria_id = v_cat_id,
          marca_id     = coalesce(v_marca_id, marca_id),
          etiquetas    = case when cardinality(v_etiquetas) > 0 then v_etiquetas else etiquetas end,
          activo       = coalesce((f ->> 'activo')::boolean, activo)
        where id = v_prod_id
          and (nombre, descripcion, categoria_id, marca_id, etiquetas, activo)
              is distinct from
              (g.producto,
               coalesce(nullif(btrim(coalesce(f ->> 'descripcion', '')), ''), descripcion),
               v_cat_id, coalesce(v_marca_id, marca_id),
               case when cardinality(v_etiquetas) > 0 then v_etiquetas else etiquetas end,
               coalesce((f ->> 'activo')::boolean, activo));
        get diagnostics v_filas = row_count;
        v_prod_cambio := v_filas > 0;
      end if;

      -- --- Presentaciones ------------------------------------------------------
      v_filas := 0;
      for f, v_pos in select value, ordinality from jsonb_array_elements(g.filas) with ordinality
      loop
        v_sku := nullif(btrim(coalesce(f ->> 'sku', '')), '');
        v_var_id := null;
        if v_sku is not null then
          select id into v_var_id from public.variantes where sku = v_sku;
        end if;

        if v_var_id is null then
          if v_sku is null then  -- SKU autogenerado (igual que guardar_producto)
            select coalesce(max(substring(sku from '-([0-9]+)$')::integer), 0) + 1 into v_n
              from public.variantes
             where producto_id = v_prod_id and sku ~ ('^EV-' || lpad(v_prod_id::text, 5, '0') || '-[0-9]+$');
            v_sku := 'EV-' || lpad(v_prod_id::text, 5, '0') || '-' || lpad(v_n::text, 2, '0');
          end if;
          insert into public.variantes (
            producto_id, sku, nombre_presentacion, contenido_valor, contenido_unidad,
            unidad_venta, unidades_por_empaque, precio_unidad, precio_mayor, cantidad_min_mayor,
            en_oferta, precio_oferta, disponible, orden, activo)
          values (
            v_prod_id, v_sku,
            nullif(btrim(coalesce(f ->> 'presentacion', '')), ''),
            (f ->> 'contenido_valor')::numeric,
            nullif(btrim(coalesce(f ->> 'contenido_unidad', '')), ''),
            coalesce(nullif(btrim(coalesce(f ->> 'unidad_venta', '')), ''), 'individual'),
            coalesce((f ->> 'unidades_por_empaque')::integer, 1),
            (f ->> 'precio_unidad')::integer, (f ->> 'precio_mayor')::integer,
            (f ->> 'cantidad_min_mayor')::integer,
            coalesce((f ->> 'en_oferta')::boolean, false), (f ->> 'precio_oferta')::integer,
            coalesce((f ->> 'disponible')::boolean, true),
            coalesce((select max(orden) from public.variantes where producto_id = v_prod_id), 0) + 1,
            coalesce((f ->> 'activo')::boolean, true));
          l_vc := l_vc + 1;
        else
          -- La presentación debe pertenecer a ESTE producto.
          if not exists (select 1 from public.variantes where id = v_var_id and producto_id = v_prod_id) then
            raise exception 'El SKU % pertenece a otro producto.', v_sku using errcode = 'P0001';
          end if;
          -- Lo que viene vacío se conserva (nunca borra precios ya puestos).
          update public.variantes set
            nombre_presentacion  = coalesce(nullif(btrim(coalesce(f ->> 'presentacion', '')), ''), nombre_presentacion),
            contenido_valor      = coalesce((f ->> 'contenido_valor')::numeric, contenido_valor),
            contenido_unidad     = coalesce(nullif(btrim(coalesce(f ->> 'contenido_unidad', '')), ''), contenido_unidad),
            unidad_venta         = coalesce(nullif(btrim(coalesce(f ->> 'unidad_venta', '')), ''), unidad_venta),
            unidades_por_empaque = coalesce((f ->> 'unidades_por_empaque')::integer, unidades_por_empaque),
            precio_unidad        = coalesce((f ->> 'precio_unidad')::integer, precio_unidad),
            precio_mayor         = coalesce((f ->> 'precio_mayor')::integer, precio_mayor),
            cantidad_min_mayor   = coalesce((f ->> 'cantidad_min_mayor')::integer, cantidad_min_mayor),
            en_oferta            = coalesce((f ->> 'en_oferta')::boolean, en_oferta),
            precio_oferta        = coalesce((f ->> 'precio_oferta')::integer, precio_oferta),
            disponible           = coalesce((f ->> 'disponible')::boolean, disponible),
            activo               = coalesce((f ->> 'activo')::boolean, activo)
          where id = v_var_id
            and (nombre_presentacion, contenido_valor, contenido_unidad, unidad_venta, unidades_por_empaque,
                 precio_unidad, precio_mayor, cantidad_min_mayor, en_oferta, precio_oferta, disponible, activo)
                is distinct from
                (coalesce(nullif(btrim(coalesce(f ->> 'presentacion', '')), ''), nombre_presentacion),
                 coalesce((f ->> 'contenido_valor')::numeric, contenido_valor),
                 coalesce(nullif(btrim(coalesce(f ->> 'contenido_unidad', '')), ''), contenido_unidad),
                 coalesce(nullif(btrim(coalesce(f ->> 'unidad_venta', '')), ''), unidad_venta),
                 coalesce((f ->> 'unidades_por_empaque')::integer, unidades_por_empaque),
                 coalesce((f ->> 'precio_unidad')::integer, precio_unidad),
                 coalesce((f ->> 'precio_mayor')::integer, precio_mayor),
                 coalesce((f ->> 'cantidad_min_mayor')::integer, cantidad_min_mayor),
                 coalesce((f ->> 'en_oferta')::boolean, en_oferta),
                 coalesce((f ->> 'precio_oferta')::integer, precio_oferta),
                 coalesce((f ->> 'disponible')::boolean, disponible),
                 coalesce((f ->> 'activo')::boolean, activo));
          get diagnostics v_filas = row_count;
          if v_filas > 0 then l_va := l_va + 1; else l_vi := l_vi + 1; end if;
        end if;
      end loop;

      -- Producto terminado SIN error: recién ahora se suman sus contadores.
      if v_creada then
        c_prod_creados := c_prod_creados + 1;
      elsif v_prod_cambio then
        c_prod_act := c_prod_act + 1;
      else
        c_prod_igual := c_prod_igual + 1;
      end if;
      c_cat_creadas := c_cat_creadas + l_cat;
      c_marcas_creadas := c_marcas_creadas + l_marcas;
      c_var_creadas := c_var_creadas + l_vc;
      c_var_act := c_var_act + l_va;
      c_var_igual := c_var_igual + l_vi;

    exception when others then
      -- Se deshace SOLO este producto (incluidas sus categorías/marcas nuevas, que
      -- no se cuentan) y se sigue con el siguiente.
      v_errores := v_errores || jsonb_build_object(
        'producto', g.producto,
        'sku', nullif(btrim(coalesce(g.filas -> 0 ->> 'sku', '')), ''),
        'mensaje', sqlerrm);
    end;
  end loop;

  return jsonb_build_object(
    'productos_creados', c_prod_creados, 'productos_actualizados', c_prod_act, 'productos_sin_cambios', c_prod_igual,
    'variantes_creadas', c_var_creadas, 'variantes_actualizadas', c_var_act, 'variantes_sin_cambios', c_var_igual,
    'categorias_creadas', c_cat_creadas, 'marcas_creadas', c_marcas_creadas,
    'errores', v_errores);
end;
$$;

revoke execute on function public.importar_catalogo(jsonb) from public, anon;
grant execute on function public.importar_catalogo(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. guardar_precios(p_filas): edición rápida e importación de precios
-- ---------------------------------------------------------------------------
-- p_filas: lista de { id? | sku?, precio_unidad?, precio_mayor?, cantidad_min_mayor?,
--                     en_oferta?, precio_oferta?, disponible? }
--   · Solo se modifican las claves PRESENTES. Una clave con valor null BORRA ese dato
--     (así la cuadrícula puede quitar un precio); una clave ausente lo deja igual.
--   · Cada fila va en su propio sub-bloque: si una falla (p. ej. precio por mayor mayor
--     que el de unidad) se informa y las demás se guardan.
-- Devuelve: { actualizadas, sin_cambios, errores: [{ref, mensaje}] }
create or replace function public.guardar_precios(p_filas jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  f jsonb;
  v_ref text;
  v_id integer;
  v_filas integer;
  c_act integer := 0;
  c_igual integer := 0;
  v_errores jsonb := '[]'::jsonb;
begin
  if not private.tiene_rol(array['admin', 'editor']::public.rol_usuario[]) then
    raise exception 'No tienes permiso para cambiar precios.' using errcode = '42501';
  end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) = 0 then
    raise exception 'No hay filas para guardar.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_filas) > 1000 then
    raise exception 'Máximo 1000 filas por lote.' using errcode = 'P0001';
  end if;

  for f in select value from jsonb_array_elements(p_filas)
  loop
    v_ref := coalesce(nullif(btrim(coalesce(f ->> 'sku', '')), ''), f ->> 'id', '(sin referencia)');
    begin
      if nullif(f ->> 'id', '') is not null then
        v_id := (f ->> 'id')::integer;
      else
        select id into v_id from public.variantes where sku = nullif(btrim(coalesce(f ->> 'sku', '')), '');
      end if;
      if v_id is null or not exists (select 1 from public.variantes where id = v_id) then
        raise exception 'No existe una presentación con esa referencia.' using errcode = 'P0002';
      end if;

      update public.variantes set
        precio_unidad      = case when f ? 'precio_unidad'      then (f ->> 'precio_unidad')::integer      else precio_unidad end,
        precio_mayor       = case when f ? 'precio_mayor'       then (f ->> 'precio_mayor')::integer       else precio_mayor end,
        cantidad_min_mayor = case when f ? 'cantidad_min_mayor' then (f ->> 'cantidad_min_mayor')::integer else cantidad_min_mayor end,
        en_oferta          = case when f ? 'en_oferta'          then coalesce((f ->> 'en_oferta')::boolean, false) else en_oferta end,
        precio_oferta      = case when f ? 'precio_oferta'      then (f ->> 'precio_oferta')::integer      else precio_oferta end,
        disponible         = case when f ? 'disponible'         then coalesce((f ->> 'disponible')::boolean, true) else disponible end
      where id = v_id
        and (precio_unidad, precio_mayor, cantidad_min_mayor, en_oferta, precio_oferta, disponible)
            is distinct from
            (case when f ? 'precio_unidad'      then (f ->> 'precio_unidad')::integer      else precio_unidad end,
             case when f ? 'precio_mayor'       then (f ->> 'precio_mayor')::integer       else precio_mayor end,
             case when f ? 'cantidad_min_mayor' then (f ->> 'cantidad_min_mayor')::integer else cantidad_min_mayor end,
             case when f ? 'en_oferta'          then coalesce((f ->> 'en_oferta')::boolean, false) else en_oferta end,
             case when f ? 'precio_oferta'      then (f ->> 'precio_oferta')::integer      else precio_oferta end,
             case when f ? 'disponible'         then coalesce((f ->> 'disponible')::boolean, true) else disponible end);
      get diagnostics v_filas = row_count;
      if v_filas > 0 then c_act := c_act + 1; else c_igual := c_igual + 1; end if;
    exception when others then
      v_errores := v_errores || jsonb_build_object('ref', v_ref, 'mensaje', sqlerrm);
    end;
  end loop;

  return jsonb_build_object('actualizadas', c_act, 'sin_cambios', c_igual, 'errores', v_errores);
end;
$$;

revoke execute on function public.guardar_precios(jsonb) from public, anon;
grant execute on function public.guardar_precios(jsonb) to authenticated;
