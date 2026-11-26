"""Pruebas de las partes puras de rescatar_maestro.py. Ejecutar: python -m unittest scripts/test_rescatar_maestro.py"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import rescatar_maestro as rm  # noqa: E402


class TestUtilidades(unittest.TestCase):
    def test_a_entero_acepta_pesos_y_decimales_de_texto(self):
        self.assertEqual(rm.a_entero("$ 8687.24"), 8687)
        self.assertEqual(rm.a_entero(1731.0), 1731)
        self.assertIsNone(rm.a_entero(None))
        self.assertIsNone(rm.a_entero(""))
        self.assertIsNone(rm.a_entero("abc"))

    def test_sku_base_quita_el_numero_de_foto(self):
        self.assertEqual(rm.sku_base("EVC-00018_2.jpg"), "EVC-00018")
        self.assertEqual(rm.sku_base("EVC-00018.jpg"), "EVC-00018")

    def test_tokens_ignora_tildes_mayusculas_y_palabras_de_una_letra(self):
        self.assertEqual(rm.tokens("Maíz PIRA – x 2"), {"maiz", "pira"})

    def test_distancia_de_huellas(self):
        self.assertEqual(rm.distancia(0b1010, 0b1010), 0)
        self.assertEqual(rm.distancia(0b1010, 0b0101), 4)


class TestClasificarMayor(unittest.TestCase):
    def test_descuento_normal_se_aplica(self):
        self.assertEqual(rm.clasificar_mayor(1000, 830), "aplicar")
        self.assertEqual(rm.clasificar_mayor(1000, 700), "aplicar")

    def test_descuento_exagerado_o_mayor_que_el_detal_se_confirma(self):
        self.assertEqual(rm.clasificar_mayor(4000, 1), "confirmar_bajo")
        self.assertEqual(rm.clasificar_mayor(3000, 2000), "confirmar_bajo")
        self.assertEqual(rm.clasificar_mayor(1000, 1000), "confirmar_alto")
        self.assertEqual(rm.clasificar_mayor(1000, 1200), "confirmar_alto")

    def test_sin_mayor(self):
        self.assertEqual(rm.clasificar_mayor(1000, 0), "sin_mayor")


class TestEmparejar(unittest.TestCase):
    def test_asigna_uno_a_uno_dentro_de_la_pagina(self):
        evc = {
            "EVC-00001": dict(sku="EVC-00001", nombre="Hey lady – Protectores", pagina=5, marca="", pres={"15 unidades"}),
            "EVC-00002": dict(sku="EVC-00002", nombre="Hey lady – Nocturnas", pagina=5, marca="", pres={"8 unidades"}),
        }
        docx = [
            dict(img="a", nombre="Hey lady", detalle="Protectores · 15 unidades", pagina=5),
            dict(img="b", nombre="Hey lady", detalle="Nocturnas · 8 unidades", pagina=5),
        ]
        self.assertEqual(rm.emparejar_docx_con_sku(docx, evc), ["EVC-00001", "EVC-00002"])

    def test_no_mezcla_paginas_ni_repite_sku(self):
        evc = {"EVC-00001": dict(sku="EVC-00001", nombre="Lenteja", pagina=2, marca="", pres={"460 g"})}
        docx = [
            dict(img="a", nombre="Lenteja", detalle="460 gramos", pagina=2),
            dict(img="b", nombre="Lenteja", detalle="460 gramos", pagina=9),
            dict(img="c", nombre="Lenteja", detalle="460 gramos", pagina=2),
        ]
        r = rm.emparejar_docx_con_sku(docx, evc)
        self.assertEqual(r.count("EVC-00001"), 1)
        self.assertIsNone(r[1])


if __name__ == "__main__":
    unittest.main()
