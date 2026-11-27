import { cacheLife, cacheTag } from "next/cache";
import { esRangoVacio, exigir } from "@/lib/tienda/errores";
import { createPublicClient } from "@/lib/supabase/publico";
import {
  POR_PAGINA_CATALOGO,
  rangoCatalogo,
  type FiltrosCatalogo,
} from "@/lib/tienda/filtros-catalogo";
import { enlaceSeguro, imagenPermitida } from "@/lib/tienda/imagenes";
import type { VarianteDetalle } from "@/lib/tienda/producto";
import { aTarjeta, type FilaTienda, type ProductoTarjeta } from "@/lib/tienda/tarjeta";

/**
 * Consultas PÚBLICAS del catálogo (vista v_tienda_productos y funciones de
 * búsqueda). Se guardan en caché unos minutos porque, con visitante anónimo, la
 * base evalúa las reglas de seguridad fila por fila y cada consulta tarda cerca
 * de 1 s. Cuando el panel cambia productos o precios, se vacía la etiqueta
 * "catalogo" (ver lib/tienda/invalidar.ts) y los cambios se ven al instante.
 */

const COLUMNAS_TARJETA =
  "id, nombre, slug, marca_nombre, categoria_nombre, variantes_visibles, precio_desde, " +
  "hay_oferta, disponible, es_nuevo, destacado, imagen_url, imagen_miniatura_url, " +
  "presentacion_principal, precio_principal, " +
  "en_oferta_principal, precio_oferta_principal, " +
  "variante_principal_id, disponible_principal, created_at";

export type ResultadoCatalogo = {
  productos: ProductoTarjeta[];
  total: number;
  /** Página realmente mostrada (se acota al total). */
  pagina: number;
  totalPaginas: number;
};

const VACIO: ResultadoCatalogo = { productos: [], total: 0, pagina: 1, totalPaginas: 1 };

/**
 * Lista el catálogo según los filtros. `categoriaIds` ya viene resuelto (la
 * categoría pedida y sus hijas). Con búsqueda y orden "relevancia" se ordena por
 * lo parecido que es cada producto a lo escrito.
 */
export async function listarCatalogo(
  filtros: FiltrosCatalogo,
  categoriaIds: number[],
): Promise<ResultadoCatalogo> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 120, expire: 3600 });
  cacheTag("catalogo");

  const supabase = createPublicClient();

  let relevancia: Map<number, number> | null = null;
  if (filtros.q) {
    const { data, error: errorBusqueda } = await supabase.rpc("buscar_catalogo", {
      p_q: filtros.q,
      p_limite: 300,
    });
    exigir(errorBusqueda, "la búsqueda del catálogo");
    if (!data || data.length === 0) return VACIO;
    relevancia = new Map(data.map((d) => [d.id, d.relevancia]));
  }

  let consulta = supabase
    .from("v_tienda_productos")
    .select(COLUMNAS_TARJETA, { count: "exact" });
  if (relevancia) consulta = consulta.in("id", [...relevancia.keys()]);
  if (filtros.cat) {
    if (categoriaIds.length === 0) return VACIO; // categoría que no existe
    consulta = consulta.in("categoria_id", categoriaIds);
  }
  if (filtros.marcas.length > 0) consulta = consulta.in("marca_slug", filtros.marcas);
  if (filtros.min !== null) consulta = consulta.gte("precio_desde", filtros.min);
  if (filtros.max !== null) consulta = consulta.lte("precio_desde", filtros.max);
  if (filtros.ofertas) consulta = consulta.eq("hay_oferta", true);
  if (filtros.disponibles) consulta = consulta.eq("disponible", true);

  const porRelevancia = filtros.orden === "relevancia" && relevancia !== null;
  switch (filtros.orden) {
    case "nombre":
      consulta = consulta.order("nombre");
      break;
    case "precio_asc":
      consulta = consulta.order("precio_desde", { ascending: true });
      break;
    case "precio_desc":
      consulta = consulta.order("precio_desde", { ascending: false });
      break;
    case "recientes":
      consulta = consulta.order("created_at", { ascending: false });
      break;
    default:
      // Sin búsqueda: primero los destacados y luego por nombre.
      if (!porRelevancia) {
        consulta = consulta.order("destacado", { ascending: false }).order("nombre");
      }
  }
  consulta = consulta.order("id");

  if (porRelevancia && relevancia) {
    // Máximo 300 coincidencias: se traen todas, se ordenan por relevancia y se pagina aquí.
    const { data: crudo, error } = await consulta.limit(300);
    exigir(error, "los resultados de la búsqueda");
    if (!crudo) return VACIO;
    // El texto del select se arma por partes, así que TypeScript no infiere las columnas.
    const data = crudo as unknown as FilaTienda[];
    const ordenadas = [...data].sort(
      (a, b) =>
        (relevancia.get(b.id as number) ?? 0) - (relevancia.get(a.id as number) ?? 0) ||
        (a.id as number) - (b.id as number),
    );
    const r = rangoCatalogo(filtros.pagina, ordenadas.length);
    return {
      productos: ordenadas.slice(r.desde, r.hasta + 1).flatMap((f) => aTarjeta(f) ?? []),
      total: ordenadas.length,
      pagina: r.actual,
      totalPaginas: r.totalPaginas,
    };
  }

  const pedir = async (pagina: number) => {
    const desde = (pagina - 1) * POR_PAGINA_CATALOGO;
    const r = await consulta.range(desde, desde + POR_PAGINA_CATALOGO - 1);
    // PostgREST responde con un error (PGRST103) si el rango empieza después del último producto:
    // eso es normal. Cualquier OTRO error (tiempo de espera, base caída) se lanza para no guardarlo en la caché.
    if (!esRangoVacio(r.error)) exigir(r.error, "el listado del catálogo");
    return {
      filas: (r.data ?? []) as unknown as FilaTienda[],
      total: r.count ?? 0,
      fueraDeRango: esRangoVacio(r.error),
    };
  };

  let lectura = await pedir(filtros.pagina);
  // Página que ya no existe (enlace viejo o se filtró): se muestra la última que sí existe.
  if (lectura.fueraDeRango || (lectura.filas.length === 0 && lectura.total > 0)) {
    const primera = await pedir(1);
    if (primera.fueraDeRango) return VACIO;
    const r = rangoCatalogo(filtros.pagina, primera.total);
    lectura = r.actual === 1 ? primera : await pedir(r.actual);
  }
  const r = rangoCatalogo(filtros.pagina, lectura.total);
  return {
    productos: lectura.filas.flatMap((f) => aTarjeta(f) ?? []),
    total: lectura.total,
    pagina: r.actual,
    totalPaginas: r.totalPaginas,
  };
}

export type Facetas = {
  /** Productos directamente en cada categoría. */
  porCategoria: Record<number, number>;
  /** Marcas con productos visibles, de la A a la Z. */
  marcas: { id: number; nombre: string; slug: string; n: number }[];
};

/** Conteos para los filtros (categorías y marcas). Cuentan todo el catálogo visible. */
export async function obtenerFacetas(): Promise<Facetas> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  cacheTag("catalogo");

  const supabase = createPublicClient();
  const [{ data: conteos, error: errorConteos }, { data: marcas, error: errorMarcas }] = await Promise.all([
    supabase.rpc("conteos_catalogo"),
    supabase.from("marcas").select("id, nombre, slug").order("nombre"),
  ]);
  exigir(errorConteos, "los conteos del catálogo");
  exigir(errorMarcas, "las marcas");

  const porCategoria: Record<number, number> = {};
  const porMarca = new Map<number, number>();
  for (const c of conteos ?? []) {
    if (c.tipo === "categoria") porCategoria[c.id] = c.n;
    else porMarca.set(c.id, c.n);
  }
  return {
    porCategoria,
    marcas: (marcas ?? [])
      .filter((m) => porMarca.has(m.id))
      .map((m) => ({ ...m, n: porMarca.get(m.id) ?? 0 })),
  };
}

export type Sugerencia = {
  nombre: string;
  slug: string;
  marca: string | null;
  imagen: string | null;
};

/** Hasta 6 productos para el desplegable del buscador (RF-04). */
export async function sugerirProductos(q: string): Promise<Sugerencia[]> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 120, expire: 3600 });
  cacheTag("catalogo");

  const supabase = createPublicClient();
  const { data: hits, error: errorHits } = await supabase.rpc("buscar_catalogo", { p_q: q, p_limite: 6 });
  exigir(errorHits, "las sugerencias del buscador");
  if (!hits || hits.length === 0) return [];
  const { data, error: errorFilas } = await supabase
    .from("v_tienda_productos")
    .select("id, nombre, slug, marca_nombre, imagen_miniatura_url, imagen_url")
    .in("id", hits.map((h) => h.id));
  exigir(errorFilas, "las sugerencias del buscador");
  const por = new Map((data ?? []).map((f) => [f.id, f]));
  return hits.flatMap((h) => {
    const f = por.get(h.id);
    return f && f.nombre && f.slug
      ? [{ nombre: f.nombre, slug: f.slug, marca: f.marca_nombre, imagen: f.imagen_miniatura_url ?? f.imagen_url }]
      : [];
  });
}

export type DetalleProducto = {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string | null;
  marca: { nombre: string; slug: string } | null;
  categoria: { id: number; nombre: string; slug: string };
  esNuevo: boolean;
  variantes: VarianteDetalle[];
  imagenes: { url: string; miniatura: string | null }[];
  relacionados: ProductoTarjeta[];
};

const COLUMNAS_VARIANTE =
  "id, sku, nombre_presentacion, contenido_valor, contenido_unidad, unidad_venta, " +
  "unidades_por_empaque, peso_g, alto_cm, ancho_cm, largo_cm, precio_unidad, " +
  "en_oferta, precio_oferta, disponible, orden";

/**
 * Un producto visible con todas sus presentaciones, imágenes y hasta 4
 * relacionados (misma categoría). Null si no existe o no es público (RN-01).
 */
export async function obtenerProducto(slug: string): Promise<DetalleProducto | null> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 120, expire: 3600 });
  cacheTag("catalogo");

  const supabase = createPublicClient();
  const { data: p, error: errorProducto } = await supabase
    .from("v_tienda_productos")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  exigir(errorProducto, "el producto");
  if (!p || p.id === null || p.nombre === null || p.slug === null || p.categoria_id === null) {
    return null;
  }

  const [variantes, imagenes, relacionados] = await Promise.all([
    supabase.from("variantes").select(COLUMNAS_VARIANTE).eq("producto_id", p.id).order("orden").order("id"),
    supabase
      .from("producto_imagenes")
      .select("url, url_miniatura")
      .eq("producto_id", p.id)
      .order("es_principal", { ascending: false })
      .order("orden")
      .order("id"),
    supabase
      .from("v_tienda_productos")
      .select(COLUMNAS_TARJETA)
      .eq("categoria_id", p.categoria_id)
      .neq("id", p.id)
      .order("destacado", { ascending: false })
      .order("nombre")
      .limit(4),
  ]);

  exigir(variantes.error, "las presentaciones del producto");
  exigir(imagenes.error, "las imágenes del producto");
  exigir(relacionados.error, "los productos relacionados");

  return {
    id: p.id,
    nombre: p.nombre,
    slug: p.slug,
    descripcion: p.descripcion,
    marca: p.marca_nombre && p.marca_slug ? { nombre: p.marca_nombre, slug: p.marca_slug } : null,
    categoria: {
      id: p.categoria_id,
      nombre: p.categoria_nombre ?? "",
      slug: p.categoria_slug ?? "",
    },
    esNuevo: p.es_nuevo === true,
    variantes: (variantes.data ?? []) as unknown as VarianteDetalle[],
    imagenes: (imagenes.data ?? []).map((i) => ({ url: i.url, miniatura: i.url_miniatura })),
    relacionados: ((relacionados.data ?? []) as unknown as FilaTienda[]).flatMap(
      (f) => aTarjeta(f) ?? [],
    ),
  };
}

export type BannerInicio = {
  id: number;
  imagen: string;
  imagenMovil: string | null;
  enlace: string | null;
};

export type DatosInicio = {
  banners: BannerInicio[];
  ofertas: ProductoTarjeta[];
  nuevos: ProductoTarjeta[];
};

/** Lo que muestra la página de inicio (RF-01): banners, ofertas y productos nuevos. */
export async function obtenerInicio(): Promise<DatosInicio> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  cacheTag("catalogo");
  cacheTag("tienda");

  const supabase = createPublicClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const [banners, ofertas, nuevos] = await Promise.all([
    supabase
      .from("banners")
      .select("id, imagen_url, imagen_movil_url, enlace")
      .order("orden")
      .order("id")
      .limit(5),
    supabase
      .from("v_tienda_productos")
      .select(COLUMNAS_TARJETA)
      .eq("hay_oferta", true)
      .order("destacado", { ascending: false })
      .order("nombre")
      .limit(8),
    supabase
      .from("v_tienda_productos")
      .select(COLUMNAS_TARJETA)
      .eq("es_nuevo", true)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  exigir(banners.error, "los banners");
  exigir(ofertas.error, "las ofertas");
  exigir(nuevos.error, "los productos nuevos");

  const tarjetas = (r: { data: unknown }) =>
    ((r.data ?? []) as FilaTienda[]).flatMap((f) => aTarjeta(f) ?? []);

  return {
    banners: (banners.data ?? []).flatMap((b) => {
      const imagen = imagenPermitida(b.imagen_url, supabaseUrl);
      return imagen
        ? [
            {
              id: b.id,
              imagen,
              imagenMovil: imagenPermitida(b.imagen_movil_url, supabaseUrl),
              enlace: enlaceSeguro(b.enlace),
            },
          ]
        : [];
    }),
    ofertas: tarjetas(ofertas),
    nuevos: tarjetas(nuevos),
  };
}
