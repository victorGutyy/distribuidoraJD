"""
Pruebas de scripts/consolidar_precios.py (solo biblioteca estándar).

Ejecutar desde la raíz del proyecto, en Git Bash:
    python -m unittest scripts/test_consolidar_precios.py -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import consolidar_precios as c  # noqa: E402


class TestPrecioMayor(unittest.TestCase):
    def test_descuento_normal_se_guarda(self):
        self.assertTrue(c.puede_guardar_mayor(1000, 900))
        self.assertTrue(c.puede_guardar_mayor(1000, 1000))

    def test_mayor_superior_al_unitario_no_se_guarda(self):
        self.assertFalse(c.puede_guardar_mayor(1450, 1500))

    def test_descuento_exagerado_no_se_guarda_hasta_confirmar(self):
        self.assertFalse(c.puede_guardar_mayor(3000, 2000))

    def test_sin_lista_2_no_se_guarda(self):
        self.assertFalse(c.puede_guardar_mayor(1000, None))
        self.assertFalse(c.puede_guardar_mayor(None, 900))


class TestAlertas(unittest.TestCase):
    def test_sin_problemas(self):
        self.assertEqual(c.alertas_de_precio(1000, 900, "5", ""), [])

    def test_lista_2_mayor(self):
        self.assertTrue(any("mayor que Lista 1" in a for a in c.alertas_de_precio(1450, 1500, "5", "")))

    def test_lista_2_muy_baja_y_sin_lista_2(self):
        self.assertTrue(any("muy baja" in a for a in c.alertas_de_precio(3000, 2000, "5", "")))
        self.assertTrue(any("sin Lista 2" in a for a in c.alertas_de_precio(1000, None, "5", "")))

    def test_inventario_negativo_y_redondeo(self):
        alertas = c.alertas_de_precio(1000, 900, "-2", "sí")
        self.assertTrue(any("negativo" in a for a in alertas))
        self.assertTrue(any("redondeó" in a for a in alertas))


class TestCostoYStock(unittest.TestCase):
    def test_numeros_normales(self):
        self.assertEqual(c.costo_y_stock({"COSTO": 9081, "Inventario": 66}), {"costo": 9081, "stock": 66})

    def test_texto_con_decimales_se_redondea(self):
        self.assertEqual(c.costo_y_stock({"COSTO": "$ 1405.8", "Inventario": 3})["costo"], 1406)

    def test_sin_costo_o_costo_cero_es_sin_dato(self):
        self.assertIsNone(c.costo_y_stock({"COSTO": None, "Inventario": 1})["costo"])
        self.assertIsNone(c.costo_y_stock({"COSTO": 0, "Inventario": 1})["costo"])

    def test_el_stock_cero_y_el_negativo_son_datos_validos(self):
        self.assertEqual(c.costo_y_stock({"COSTO": 100, "Inventario": 0})["stock"], 0)
        self.assertEqual(c.costo_y_stock({"COSTO": 100, "Inventario": -17})["stock"], -17)

    def test_stock_ausente_es_sin_dato(self):
        self.assertIsNone(c.costo_y_stock({"COSTO": 100, "Inventario": None})["stock"])


if __name__ == "__main__":
    unittest.main()
