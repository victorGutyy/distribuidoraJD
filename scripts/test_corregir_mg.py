"""
Pruebas de scripts/corregir_mg.py (solo biblioteca estándar).

Ejecutar desde la raíz del proyecto, en Git Bash:
    python -m unittest scripts/test_corregir_mg.py -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import corregir_mg as m  # noqa: E402


def var(producto, presentacion, valor, categoria="Cuidado personal"):
    return {"producto": producto, "presentacion": presentacion, "contenido_valor": valor, "categoria": categoria}


class TestUnidades(unittest.TestCase):
    def test_el_excel_manda(self):
        self.assertEqual(m.unidad_en_excel("MENTHUS JUHNIUS AZUL 110GR", 110), "g")
        self.assertEqual(m.unidad_en_excel("SILICONA LIQUIDA*30 ML", 30), "ml")
        self.assertEqual(m.unidad_en_excel("AMPICILINA 500 MG*10", 500), "mg")
        self.assertIsNone(m.unidad_en_excel("SILICONA LIQUIDA*30 ML", 60))  # otro número

    def test_por_tipo_de_producto(self):
        self.assertEqual(m.unidad_por_tipo("Pantene shampoo"), "ml")
        self.assertEqual(m.unidad_por_tipo("Silicona líquida"), "ml")
        self.assertEqual(m.unidad_por_tipo("Crema para el cuerpo"), "g")
        self.assertEqual(m.unidad_por_tipo("Pomada regeneradora"), "g")
        self.assertIsNone(m.unidad_por_tipo("Pegante de uñas"))

    def test_cambia_solo_la_unidad_del_contenido(self):
        self.assertEqual(m.presentacion_nueva("15 mg · 12 unidades", "ml"), "15 ml · 12 unidades")
        self.assertEqual(m.presentacion_nueva("110 mg", "g"), "110 g")
        self.assertEqual(m.presentacion_nueva("1,5 mg", "ml"), "1,5 ml")


class TestProponer(unittest.TestCase):
    def test_con_evidencia_del_excel(self):
        p = m.proponer(var("Removedor", "30 mg", "30"), ["REMOVEDOR CHARLESTON*30ML"])
        self.assertEqual((p["propuesta"], p["origen"], p["presentacion_nueva"]), ("ml", "Excel", "30 ml"))

    def test_sin_excel_usa_el_tipo(self):
        p = m.proponer(var("Pantene shampoo", "18 mg · 12 unidades", "18"), [])
        self.assertEqual((p["propuesta"], p["origen"]), ("ml", "tipo de producto"))

    def test_un_medicamento_sin_evidencia_no_se_toca(self):
        p = m.proponer(var("Amoxicilina", "500 mg · 10 tabletas", "500", "Farmacia"), [])
        self.assertEqual((p["propuesta"], p["origen"]), ("", "dudoso"))

    def test_si_el_excel_dice_mg_el_mg_es_real(self):
        p = m.proponer(var("Ampicilina", "500 mg · 10 tabletas", "500", "Farmacia"), ["AMPICILINA 500 MG*10"])
        self.assertEqual(p["propuesta"], "")
        self.assertIn("mg de verdad", p["origen"])

    def test_producto_de_tipo_desconocido_queda_dudoso(self):
        p = m.proponer(var("Pegante de uñas", "3 mg", "3"), [])
        self.assertEqual(p["origen"], "dudoso")


if __name__ == "__main__":
    unittest.main()
