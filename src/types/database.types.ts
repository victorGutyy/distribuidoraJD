export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      banners: {
        Row: {
          activo: boolean
          enlace: string | null
          id: number
          imagen_movil_url: string | null
          imagen_url: string
          orden: number
        }
        Insert: {
          activo?: boolean
          enlace?: string | null
          id?: never
          imagen_movil_url?: string | null
          imagen_url: string
          orden?: number
        }
        Update: {
          activo?: boolean
          enlace?: string | null
          id?: never
          imagen_movil_url?: string | null
          imagen_url?: string
          orden?: number
        }
        Relationships: []
      }
      categorias: {
        Row: {
          activa: boolean
          created_at: string
          icono_url: string | null
          id: number
          nombre: string
          orden: number
          parent_id: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          icono_url?: string | null
          id?: never
          nombre: string
          orden?: number
          parent_id?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          icono_url?: string | null
          id?: never
          nombre?: string
          orden?: number
          parent_id?: number | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          celular: string
          created_at: string
          direccion: string | null
          documento: string | null
          id: number
          nombre: string
          nombre_negocio: string | null
          referencia: string | null
          sector_id: number | null
          updated_at: string
        }
        Insert: {
          celular: string
          created_at?: string
          direccion?: string | null
          documento?: string | null
          id?: never
          nombre: string
          nombre_negocio?: string | null
          referencia?: string | null
          sector_id?: number | null
          updated_at?: string
        }
        Update: {
          celular?: string
          created_at?: string
          direccion?: string | null
          documento?: string | null
          id?: never
          nombre?: string
          nombre_negocio?: string | null
          referencia?: string | null
          sector_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectores"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion: {
        Row: {
          clave: string
          updated_at: string
          updated_by: string | null
          valor: Json
        }
        Insert: {
          clave: string
          updated_at?: string
          updated_by?: string | null
          valor: Json
        }
        Update: {
          clave?: string
          updated_at?: string
          updated_by?: string | null
          valor?: Json
        }
        Relationships: []
      }
      devoluciones: {
        Row: {
          cantidad: number
          created_at: string
          estado: string
          evidencia_url: string | null
          id: number
          motivo: string
          pedido_id: number
          pedido_item_id: number | null
          resolucion: string | null
        }
        Insert: {
          cantidad: number
          created_at?: string
          estado?: string
          evidencia_url?: string | null
          id?: never
          motivo: string
          pedido_id: number
          pedido_item_id?: number | null
          resolucion?: string | null
        }
        Update: {
          cantidad?: number
          created_at?: string
          estado?: string
          evidencia_url?: string | null
          id?: never
          motivo?: string
          pedido_id?: number
          pedido_item_id?: number | null
          resolucion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devoluciones_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_pedido_item_id_fkey"
            columns: ["pedido_item_id"]
            isOneToOne: false
            referencedRelation: "pedido_items"
            referencedColumns: ["id"]
          },
        ]
      }
      importaciones: {
        Row: {
          actualizadas: number
          archivo_nombre: string | null
          creadas: number
          created_at: string
          errores: Json | null
          filas_total: number
          id: number
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          actualizadas?: number
          archivo_nombre?: string | null
          creadas?: number
          created_at?: string
          errores?: Json | null
          filas_total?: number
          id?: never
          tipo: string
          usuario_id?: string | null
        }
        Update: {
          actualizadas?: number
          archivo_nombre?: string | null
          creadas?: number
          created_at?: string
          errores?: Json | null
          filas_total?: number
          id?: never
          tipo?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      marcas: {
        Row: {
          activa: boolean
          id: number
          logo_url: string | null
          nombre: string
          slug: string
        }
        Insert: {
          activa?: boolean
          id?: never
          logo_url?: string | null
          nombre: string
          slug: string
        }
        Update: {
          activa?: boolean
          id?: never
          logo_url?: string | null
          nombre?: string
          slug?: string
        }
        Relationships: []
      }
      municipios: {
        Row: {
          activo: boolean
          departamento: string
          id: number
          nombre: string
        }
        Insert: {
          activo?: boolean
          departamento?: string
          id?: never
          nombre: string
        }
        Update: {
          activo?: boolean
          departamento?: string
          id?: never
          nombre?: string
        }
        Relationships: []
      }
      pedido_historial: {
        Row: {
          created_at: string
          estado_anterior: Database["public"]["Enums"]["estado_pedido"] | null
          estado_nuevo: Database["public"]["Enums"]["estado_pedido"]
          id: number
          nota: string | null
          pedido_id: number
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          estado_anterior?: Database["public"]["Enums"]["estado_pedido"] | null
          estado_nuevo: Database["public"]["Enums"]["estado_pedido"]
          id?: never
          nota?: string | null
          pedido_id: number
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          estado_anterior?: Database["public"]["Enums"]["estado_pedido"] | null
          estado_nuevo?: Database["public"]["Enums"]["estado_pedido"]
          id?: never
          nota?: string | null
          pedido_id?: number
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_historial_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_items: {
        Row: {
          cantidad: number
          id: number
          nombre_producto: string
          pedido_id: number
          precio_base: number | null
          precio_unitario_aplicado: number
          presentacion: string | null
          sku: string
          subtotal: number
          tipo_precio: string
          variante_id: number | null
        }
        Insert: {
          cantidad: number
          id?: never
          nombre_producto: string
          pedido_id: number
          precio_base?: number | null
          precio_unitario_aplicado: number
          presentacion?: string | null
          sku: string
          subtotal: number
          tipo_precio: string
          variante_id?: number | null
        }
        Update: {
          cantidad?: number
          id?: never
          nombre_producto?: string
          pedido_id?: number
          precio_base?: number | null
          precio_unitario_aplicado?: number
          presentacion?: string | null
          sku?: string
          subtotal?: number
          tipo_precio?: string
          variante_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_items_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_items_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "variantes"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_item_costos: {
        Row: {
          costo: number | null
          pedido_item_id: number
        }
        Insert: {
          costo?: number | null
          pedido_item_id: number
        }
        Update: {
          costo?: number | null
          pedido_item_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_item_costos_pedido_item_id_fkey"
            columns: ["pedido_item_id"]
            isOneToOne: true
            referencedRelation: "pedido_items"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cliente_id: number
          costo_envio: number
          created_at: string
          descuento_mayor: number
          direccion_entrega: string | null
          estado: Database["public"]["Enums"]["estado_pedido"]
          fecha_entrega_estimada: string | null
          id: number
          ip_origen: string | null
          metodo_pago: string
          notas: string | null
          numero: string
          recoge_en_bodega: boolean
          sector_id: number | null
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          cliente_id: number
          costo_envio?: number
          created_at?: string
          descuento_mayor?: number
          direccion_entrega?: string | null
          estado?: Database["public"]["Enums"]["estado_pedido"]
          fecha_entrega_estimada?: string | null
          id?: never
          ip_origen?: string | null
          metodo_pago?: string
          notas?: string | null
          numero?: string
          recoge_en_bodega?: boolean
          sector_id?: number | null
          subtotal: number
          total: number
          updated_at?: string
        }
        Update: {
          cliente_id?: number
          costo_envio?: number
          created_at?: string
          descuento_mayor?: number
          direccion_entrega?: string | null
          estado?: Database["public"]["Enums"]["estado_pedido"]
          fecha_entrega_estimada?: string | null
          id?: never
          ip_origen?: string | null
          metodo_pago?: string
          notas?: string | null
          numero?: string
          recoge_en_bodega?: boolean
          sector_id?: number | null
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectores"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          sectores_asignados: number[]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id: string
          nombre: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          sectores_asignados?: number[]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          sectores_asignados?: number[]
          updated_at?: string
        }
        Relationships: []
      }
      producto_imagenes: {
        Row: {
          es_principal: boolean
          id: number
          orden: number
          producto_id: number
          url: string
          url_miniatura: string | null
        }
        Insert: {
          es_principal?: boolean
          id?: never
          orden?: number
          producto_id: number
          url: string
          url_miniatura?: string | null
        }
        Update: {
          es_principal?: boolean
          id?: never
          orden?: number
          producto_id?: number
          url?: string
          url_miniatura?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "producto_imagenes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_imagenes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_imagenes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_productos_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean
          busqueda: unknown
          categoria_id: number
          created_at: string
          descripcion: string | null
          destacado: boolean
          es_nuevo: boolean
          etiquetas: string[]
          fuente_pagina_pdf: number | null
          id: number
          marca_id: number | null
          nombre: string
          slug: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          busqueda?: unknown
          categoria_id: number
          created_at?: string
          descripcion?: string | null
          destacado?: boolean
          es_nuevo?: boolean
          etiquetas?: string[]
          fuente_pagina_pdf?: number | null
          id?: never
          marca_id?: number | null
          nombre: string
          slug: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          busqueda?: unknown
          categoria_id?: number
          created_at?: string
          descripcion?: string | null
          destacado?: boolean
          es_nuevo?: boolean
          etiquetas?: string[]
          fuente_pagina_pdf?: number | null
          id?: never
          marca_id?: number | null
          nombre?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "marcas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_publico"
            referencedColumns: ["marca_id"]
          },
        ]
      }
      sectores: {
        Row: {
          activo: boolean
          costo_envio: number
          dias_reparto: number[]
          id: number
          municipio_id: number
          nombre: string
        }
        Insert: {
          activo?: boolean
          costo_envio?: number
          dias_reparto?: number[]
          id?: never
          municipio_id: number
          nombre: string
        }
        Update: {
          activo?: boolean
          costo_envio?: number
          dias_reparto?: number[]
          id?: never
          municipio_id?: number
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "sectores_municipio_id_fkey"
            columns: ["municipio_id"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["id"]
          },
        ]
      }
      variante_costos: {
        Row: {
          costo: number | null
          stock: number | null
          stock_actualizado_at: string | null
          updated_at: string
          variante_id: number
        }
        Insert: {
          costo?: number | null
          stock?: number | null
          stock_actualizado_at?: string | null
          updated_at?: string
          variante_id: number
        }
        Update: {
          costo?: number | null
          stock?: number | null
          stock_actualizado_at?: string | null
          updated_at?: string
          variante_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "variante_costos_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: true
            referencedRelation: "variantes"
            referencedColumns: ["id"]
          },
        ]
      }
      variantes: {
        Row: {
          activo: boolean
          alto_cm: number | null
          ancho_cm: number | null
          cantidad_min_mayor: number | null
          contenido_unidad: string | null
          contenido_valor: number | null
          created_at: string
          disponible: boolean
          en_oferta: boolean
          id: number
          imagen_url: string | null
          largo_cm: number | null
          nombre_presentacion: string | null
          orden: number
          peso_g: number | null
          precio_mayor: number | null
          precio_oferta: number | null
          precio_unidad: number | null
          producto_id: number
          sku: string
          unidad_venta: string
          unidades_por_empaque: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          alto_cm?: number | null
          ancho_cm?: number | null
          cantidad_min_mayor?: number | null
          contenido_unidad?: string | null
          contenido_valor?: number | null
          created_at?: string
          disponible?: boolean
          en_oferta?: boolean
          id?: never
          imagen_url?: string | null
          largo_cm?: number | null
          nombre_presentacion?: string | null
          orden?: number
          peso_g?: number | null
          precio_mayor?: number | null
          precio_oferta?: number | null
          precio_unidad?: number | null
          producto_id: number
          sku: string
          unidad_venta?: string
          unidades_por_empaque?: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          alto_cm?: number | null
          ancho_cm?: number | null
          cantidad_min_mayor?: number | null
          contenido_unidad?: string | null
          contenido_valor?: number | null
          created_at?: string
          disponible?: boolean
          en_oferta?: boolean
          id?: never
          imagen_url?: string | null
          largo_cm?: number | null
          nombre_presentacion?: string | null
          orden?: number
          peso_g?: number | null
          precio_mayor?: number | null
          precio_oferta?: number | null
          precio_unidad?: number | null
          producto_id?: number
          sku?: string
          unidad_venta?: string
          unidades_por_empaque?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "variantes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variantes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variantes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_productos_admin"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_catalogo_publico: {
        Row: {
          categoria_id: number | null
          categoria_nombre: string | null
          categoria_slug: string | null
          created_at: string | null
          descripcion: string | null
          destacado: boolean | null
          disponible: boolean | null
          es_nuevo: boolean | null
          etiquetas: string[] | null
          hay_oferta: boolean | null
          id: number | null
          imagen_miniatura_url: string | null
          imagen_url: string | null
          marca_id: number | null
          marca_nombre: string | null
          marca_slug: string | null
          nombre: string | null
          precio_desde: number | null
          slug: string | null
          variante_principal_id: number | null
          variantes_visibles: number | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ganancia_pedidos: {
        Row: {
          costo_items: number | null
          ganancia_items: number | null
          items_sin_costo: number | null
          pedido_id: number | null
          venta_items: number | null
        }
        Relationships: []
      }
      v_inventario_admin: {
        Row: {
          activo: boolean | null
          categoria_nombre: string | null
          costo: number | null
          ganancia_unitaria: number | null
          marca_nombre: string | null
          margen_pct: number | null
          precio_unidad: number | null
          presentacion: string | null
          producto_id: number | null
          producto_nombre: string | null
          sku: string | null
          stock: number | null
          stock_actualizado_at: string | null
          texto_busqueda: string | null
          valor_inventario: number | null
          variante_id: number | null
        }
        Relationships: []
      }
      v_pedidos_admin: {
        Row: {
          cliente_id: number | null
          cliente_nombre: string | null
          costo_envio: number | null
          created_at: string | null
          descuento_mayor: number | null
          direccion_entrega: string | null
          estado: Database["public"]["Enums"]["estado_pedido"] | null
          fecha_entrega_estimada: string | null
          id: number | null
          municipio_nombre: string | null
          n_items: number | null
          n_unidades: number | null
          nombre_negocio: string | null
          notas: string | null
          numero: string | null
          recoge_en_bodega: boolean | null
          sector_id: number | null
          sector_nombre: string | null
          subtotal: number | null
          texto_busqueda: string | null
          total: number | null
          celular: string | null
        }
        Relationships: []
      }
      v_precios_admin: {
        Row: {
          activo: boolean | null
          cantidad_min_mayor: number | null
          categoria_id: number | null
          categoria_nombre: string | null
          categoria_padre_nombre: string | null
          disponible: boolean | null
          en_oferta: boolean | null
          id: number | null
          marca_id: number | null
          marca_nombre: string | null
          nombre_presentacion: string | null
          orden: number | null
          precio_mayor: number | null
          precio_oferta: number | null
          precio_unidad: number | null
          producto_activo: boolean | null
          producto_id: number | null
          producto_nombre: string | null
          sin_precio: boolean | null
          sku: string | null
          texto_busqueda: string | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "marcas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_publico"
            referencedColumns: ["marca_id"]
          },
          {
            foreignKeyName: "variantes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variantes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variantes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "v_productos_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      v_productos_admin: {
        Row: {
          activo: boolean | null
          categoria_id: number | null
          categoria_nombre: string | null
          categoria_padre_nombre: string | null
          created_at: string | null
          destacado: boolean | null
          es_nuevo: boolean | null
          estado: string | null
          hay_oferta: boolean | null
          id: number | null
          imagen_miniatura_url: string | null
          marca_id: number | null
          marca_nombre: string | null
          n_con_precio: number | null
          n_variantes: number | null
          nombre: string | null
          precio_max: number | null
          precio_min: number | null
          skus: string | null
          slug: string | null
          texto_busqueda: string | null
          tiene_imagen: boolean | null
          updated_at: string | null
          visible_en_tienda: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "marcas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "v_catalogo_publico"
            referencedColumns: ["marca_id"]
          },
        ]
      }
      v_tienda_productos: {
        Row: {
          cantidad_min_mayor_principal: number | null
          categoria_id: number | null
          categoria_nombre: string | null
          categoria_padre_id: number | null
          categoria_slug: string | null
          created_at: string | null
          descripcion: string | null
          destacado: boolean | null
          disponible: boolean | null
          disponible_principal: boolean | null
          en_oferta_principal: boolean | null
          es_nuevo: boolean | null
          etiquetas: string[] | null
          hay_oferta: boolean | null
          id: number | null
          imagen_miniatura_url: string | null
          imagen_url: string | null
          marca_id: number | null
          marca_nombre: string | null
          marca_slug: string | null
          nombre: string | null
          precio_desde: number | null
          precio_mayor_principal: number | null
          precio_oferta_principal: number | null
          precio_principal: number | null
          presentacion_principal: string | null
          slug: string | null
          texto_busqueda: string | null
          variante_principal_id: number | null
          variantes_visibles: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      cambiar_estado_pedido: {
        Args: {
          p_estado: Database["public"]["Enums"]["estado_pedido"]
          p_nota?: string
          p_pedido_id: number
        }
        Returns: Json
      }
      editar_items_pedido: {
        Args: { p_items: Json; p_nota: string; p_pedido_id: number }
        Returns: Json
      }
      crear_pedido: { Args: { p_datos: Json }; Returns: Json }
      buscar_catalogo: {
        Args: { p_limite?: number; p_q: string }
        Returns: {
          id: number
          relevancia: number
        }[]
      }
      conteos_catalogo: {
        Args: never
        Returns: {
          id: number
          n: number
          tipo: string
        }[]
      }
      f_unaccent: { Args: { texto: string }; Returns: string }
      guardar_costos: { Args: { p_filas: Json }; Returns: Json }
      resumen_costos: { Args: { p_desde: string }; Returns: Json }
      guardar_precios: { Args: { p_filas: Json }; Returns: Json }
      guardar_producto: {
        Args: { p_producto: Json; p_variantes: Json }
        Returns: number
      }
      importar_catalogo: { Args: { p_filas: Json }; Returns: Json }
    }
    Enums: {
      estado_pedido:
        | "nuevo"
        | "confirmado"
        | "en_preparacion"
        | "despachado"
        | "entregado"
        | "cancelado"
      rol_usuario: "admin" | "editor" | "vendedor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      estado_pedido: [
        "nuevo",
        "confirmado",
        "en_preparacion",
        "despachado",
        "entregado",
        "cancelado",
      ],
      rol_usuario: ["admin", "editor", "vendedor"],
    },
  },
} as const
