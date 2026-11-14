"""
Pruebas de scripts/preparar_importacion.py (solo biblioteca estándar).

Ejecutar desde la raíz del proyecto, en Git Bash:
    python -m unittest scripts/test_preparar_importacion.py -v
"""

import collections
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import preparar_importacion as p  # noqa: E402


class TestNumeros(unittest.TestCase):
    def test_miles_y_decimales(self):
        self.assertEqual(p.parsear_numero("1.500"), 1500)
        self.assertEqual(p.parsear_numero("0,5"), 0.5)
        self.assertEqual(p.parsear_numero("250"), 250)
        self.assertIsNone(p.parsear_numero("abc"))

    def test_formato(self):
        self.assertEqual(p.formatear_numero(250.0), "250")
        self.assertEqual(p.formatear_numero(0.5), "0,5")


class TestPresentacion(unittest.TestCase):
    def test_simple(self):
        items, avisos = p.parsear_presentacion("460 gramos")
        self.assertEqual(items, [{"texto": "460 g", "valor": 460.0, "unidad": "g"}])
        self.assertEqual(avisos, [])

    def test_varias_con_barra(self):
        items, _ = p.parsear_presentacion("130 gramos | 200 gramos | 500 gramos")
        self.assertEqual([i["valor"] for i in items], [130, 200, 500])
        self.assertTrue(all(i["unidad"] == "g" for i in items))

    def test_unidad_compartida_al_final(self):
        items, _ = p.parsear_presentacion("250 / 450 / 800 mililitros")
        self.assertEqual([(i["valor"], i["unidad"]) for i in items], [(250, "ml"), (450, "ml"), (800, "ml")])

    def test_miles_con_punto(self):
        items, _ = p.parsear_presentacion("1.500 metros")
        self.assertEqual((items[0]["valor"], items[0]["unidad"]), (1500, "m"))

    def test_otras_unidades(self):
        for texto, unidad in [("500 miligramos", "mg"), ("4 onzas", "oz"), ("2 cc", "cc"), ("2 litros", "L"), ("1 libras", "lb")]:
            items, _ = p.parsear_presentacion(texto)
            self.assertEqual(items[0]["unidad"], unidad, texto)

    def test_compuesta_se_marca_para_revisar(self):
        items, avisos = p.parsear_presentacion("200 gramos + 40 gramos")
        self.assertIsNone(items[0]["valor"])
        self.assertEqual(len(avisos), 1)

    def test_vacia(self):
        self.assertEqual(p.parsear_presentacion(""), ([], []))


class TestUnidadVenta(unittest.TestCase):
    def test_individual_y_vacia(self):
        for t in ["Individual", "", "   "]:
            items, avisos = p.parsear_unidad_venta(t)
            self.assertEqual((items[0]["tipo"], items[0]["n"]), ("individual", 1))
            self.assertEqual(avisos, [])

    def test_paquete(self):
        items, _ = p.parsear_unidad_venta("12 unidades")
        self.assertEqual((items[0]["tipo"], items[0]["n"]), ("paquete", 12))

    def test_varias_presentaciones(self):
        items, _ = p.parsear_unidad_venta("12 unidades | Individual")
        self.assertEqual([(i["tipo"], i["n"]) for i in items], [("paquete", 12), ("individual", 1)])
        items, _ = p.parsear_unidad_venta("6 unidades / Individual")
        self.assertEqual(len(items), 2)

    def test_repetidas_se_unen(self):
        items, _ = p.parsear_unidad_venta("Individual | Individual")
        self.assertEqual(len(items), 1)

    def test_descriptor_extra_y_piezas(self):
        items, _ = p.parsear_unidad_venta("6 unidades                metálico")
        self.assertEqual((items[0]["n"], items[0]["extra"]), (6, "metálico"))
        items, _ = p.parsear_unidad_venta("3 piezas | Individual")
        self.assertEqual(items[0]["n"], 3)

    def test_promocion(self):
        items, _ = p.parsear_unidad_venta("Pague 1, lleve 2")
        self.assertEqual(items[0]["promo"], "Pague 1 lleve 2")
        self.assertEqual(items[0]["tipo"], "individual")

    def test_desconocida_avisa(self):
        _, avisos = p.parsear_unidad_venta("docena surtida")
        self.assertEqual(len(avisos), 1)


class TestDetalleYMarca(unittest.TestCase):
    def marca(self, texto, frec=None, decisiones=None):
        d = p.clasificar_detalle(texto)
        return p.decidir_marca(d, collections.Counter(frec or {}), decisiones or {})

    def test_ultimo_de_la_barra_es_la_marca(self):
        marca, detalle, _ = self.marca("Aceite de soya | La soberana")
        self.assertEqual((marca, detalle), ("La soberana", "Aceite de soya"))

    def test_farmacia_contenido_no_es_marca(self):
        d = p.clasificar_detalle("Genfar | 100 tabletas")
        self.assertEqual(d["contenido"], {"valor": 100.0, "unidad": "tabletas"})
        marca, detalle, _ = self.marca("Genfar | 100 tabletas")
        self.assertEqual((marca, detalle), ("Genfar", ""))

    def test_solo_contenido(self):
        marca, detalle, _ = self.marca("300 tabletas")
        self.assertEqual((marca, detalle), ("", ""))

    def test_atributos_nunca_son_marca(self):
        for t in ["Colores", "Medidas", "Números", "Blanco", "Blancas", "Para $500", "Sin empaque individual"]:
            marca, detalle, _ = self.marca(t, frec={p.norm(t): 99})
            self.assertEqual(marca, "", t)
            self.assertEqual(detalle, t, t)

    def test_tamanos_medidas_y_sabores_no_son_marca(self):
        # Casos reales que la primera versión confundía con marcas.
        for t in ["Grande", "Pequeño", "Carta", "Oficio", "Niños", "Original", "Tonos", "40 hojas",
                  "16 pulgadas", "6 galletas", "Onzas", "Línea 5 unidades", "Vainilla", "Mora azul",
                  "Chocolate de leche", "Borrable", "Escarchado", "Empaque individual"]:
            self.assertTrue(p.es_atributo(t), t)
            marca, _, _ = self.marca(t, frec={p.norm(t): 50})
            self.assertEqual(marca, "", t)

    def test_marcas_reales_se_conservan(self):
        for t in ["La soberana", "Oral-Plus", "Doña Lupe", "Arepa repa", "Catalina", "La Española",
                  "De la Abuela", "BUENGUSTO", "Offi-esco", "Genfar", "American generics"]:
            self.assertFalse(p.es_atributo(t), t)

    def test_valor_suelto_repetido_es_marca(self):
        marca, _, _ = self.marca("La soberana", frec={"la soberana": 12})
        self.assertEqual(marca, "La soberana")

    def test_valor_suelto_unico_es_detalle(self):
        marca, detalle, _ = self.marca("Algo raro", frec={"algo raro": 1})
        self.assertEqual((marca, detalle), ("", "Algo raro"))

    def test_decision_humana_manda(self):
        dec = {"algo raro": (True, "Algo Raro S.A.")}
        marca, _, origen = self.marca("Algo raro", frec={"algo raro": 1}, decisiones=dec)
        self.assertEqual((marca, origen), ("Algo Raro S.A.", "decisión humana"))
        dec = {"la soberana": (False, "")}
        marca, detalle, _ = self.marca("La soberana", frec={"la soberana": 12}, decisiones=dec)
        self.assertEqual((marca, detalle), ("", "La soberana"))


class TestCategoria(unittest.TestCase):
    def test_atun_a_enlatados(self):
        self.assertEqual(p.corregir_categoria("Víveres y despensa", "Granos y harinas", "Lomitos de atún en agua"),
                         ("Víveres y despensa", "Enlatados", True))

    def test_lo_demas_no_cambia(self):
        self.assertEqual(p.corregir_categoria("Víveres y despensa", "Granos y harinas", "Lenteja"),
                         ("Víveres y despensa", "Granos y harinas", False))


class TestSku(unittest.TestCase):
    def test_estables_y_consecutivos(self):
        a = p.AsignadorSku(ruta=None)
        self.assertEqual(a.variante("prod-a", "v1"), "EVC-00001-01")
        self.assertEqual(a.variante("prod-a", "v2"), "EVC-00001-02")
        self.assertEqual(a.variante("prod-b", "v1"), "EVC-00002-01")
        # Pedir de nuevo lo mismo devuelve lo mismo
        self.assertEqual(a.variante("prod-a", "v1"), "EVC-00001-01")

    def test_no_choca_con_el_formato_del_panel(self):
        a = p.AsignadorSku(ruta=None)
        self.assertTrue(a.variante("x", "y").startswith("EVC-"))


def fila(**kw):
    base = {"pagina_pdf": "1", "categoria_propuesta": "Víveres y despensa", "subcategoria_propuesta": "Granos y harinas",
            "nombre": "Lenteja", "marca_o_detalle": "", "presentacion": "", "unidad_venta": "Individual",
            "texto_original": "", "nota_revision": ""}
    base.update(kw)
    return base


class TestConvertir(unittest.TestCase):
    def convertir(self, filas):
        return p.convertir(filas, {}, p.AsignadorSku(ruta=None))

    def test_filas_del_mismo_producto_son_presentaciones(self):
        r = self.convertir([fila(nombre="Lentejas Doña Lupe", presentacion="250 gramos"),
                            fila(nombre="Lentejas Doña Lupe", presentacion="400 gramos")])
        self.assertEqual(r["n_productos"], 1)
        self.assertEqual([v["sku"] for v in r["salida"]], ["EVC-00001-01", "EVC-00001-02"])
        self.assertEqual([v["presentacion"] for v in r["salida"]], ["250 g", "400 g"])

    def test_duplicados_exactos_se_funden(self):
        r = self.convertir([fila(presentacion="425 gramos"), fila(presentacion="425 gramos")])
        self.assertEqual(len(r["salida"]), 1)

    def test_una_fila_con_varias_presentaciones_se_expande(self):
        r = self.convertir([fila(nombre="Colbón", presentacion="20 gramos | 40 gramos | 125 gramos")])
        self.assertEqual(r["n_productos"], 1)
        self.assertEqual(len(r["salida"]), 3)

    def test_unidad_de_venta_multiple_se_expande(self):
        r = self.convertir([fila(nombre="Super glue", unidad_venta="12 unidades | Individual")])
        self.assertEqual([(v["unidad_venta"], v["unidades_por_empaque"]) for v in r["salida"]],
                         [("paquete", 12), ("individual", 1)])

    def test_detalle_distingue_productos_con_el_mismo_nombre(self):
        r = self.convertir([fila(nombre="Miel", marca_o_detalle="Para $500"), fila(nombre="Miel", marca_o_detalle="Para $800")])
        self.assertEqual(r["n_productos"], 2)
        self.assertEqual(sorted(v["producto"] for v in r["salida"]), ["Miel – Para $500", "Miel – Para $800"])

    def test_detalle_unico_va_a_la_descripcion_no_al_nombre(self):
        r = self.convertir([fila(nombre="Lapicero Kiut", marca_o_detalle="Colores")])
        self.assertEqual(r["salida"][0]["producto"], "Lapicero Kiut")
        self.assertEqual(r["salida"][0]["descripcion"], "Colores")

    def test_campos_de_precio_quedan_vacios_y_activo(self):
        v = self.convertir([fila()])["salida"][0]
        self.assertEqual((v["precio_unidad"], v["precio_mayor"], v["activo"], v["disponible"]), ("", "", "si", "si"))
        self.assertEqual(set(v), set(p.COLUMNAS))

    def test_promocion_va_a_etiquetas(self):
        v = self.convertir([fila(unidad_venta="Pague 1, lleve 2")])["salida"][0]
        self.assertEqual(v["etiquetas"], "Pague 1 lleve 2")

    def test_farmacia_contenido_en_la_presentacion(self):
        r = self.convertir([fila(subcategoria_propuesta="Farmacia", nombre="Acetaminofén",
                                 marca_o_detalle="Genfar | 100 tabletas", presentacion="500 miligramos", unidad_venta="")])
        v = r["salida"][0]
        self.assertEqual(v["marca"], "Genfar")
        self.assertEqual(v["presentacion"], "500 mg · 100 tabletas")
        self.assertEqual((v["contenido_valor"], v["contenido_unidad"]), ("500", "mg"))


if __name__ == "__main__":
    unittest.main()
