"""
Pruebas de scripts/emparejar_precios.py (solo biblioteca estándar).

Ejecutar desde la raíz del proyecto, en Git Bash:
    python -m unittest scripts/test_emparejar_precios.py -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import emparejar_precios as e  # noqa: E402


def cat(producto, marca="", presentacion="", sku="X"):
    return {"sku": sku, "producto": producto, "marca": marca, "presentacion": presentacion, "unidad_venta": ""}


def exc(desc, prov="", fila=2):
    return {"Descripción": desc, "Categoría": prov, "Lista 1": 1000, "Lista 2": 900, "Inventario": 5, "_fila": fila}


class TestNormalizar(unittest.TestCase):
    def test_unidades(self):
        self.assertEqual(e.normalizar("ARVEJA*460 GR"), "ARVEJA 460G")
        self.assertEqual(e.normalizar("Arveja 460 gramos"), "ARVEJA 460G")
        self.assertEqual(e.normalizar("Aceite 240 ML"), "ACEITE 240ML")

    def test_tildes_y_signos(self):
        self.assertEqual(e.normalizar("Café Doña Lupe"), "CAFE DONA LUPE")

    def test_fracciones_y_decimales(self):
        self.assertIn("1_2", e.normalizar("cinta 1/2"))
        self.assertIn("8_5", e.normalizar("guante #8.5"))

    def test_unidades_de_empaque_pegadas_al_numero(self):
        self.assertEqual(e.tokens("Mordisquetas 24 unidades"), e.tokens("MORDISQUETAS*24"))


class TestTokens(unittest.TestCase):
    def test_plural_y_singular_son_iguales(self):
        self.assertEqual(e.tokens("pinceles"), e.tokens("pincel"))
        self.assertEqual(e.tokens("aceites"), e.tokens("aceite"))

    def test_quita_palabras_vacias(self):
        # "ACEITE" queda como raíz "ACEIT" (para que aceite = aceites); lo importante es que "de la" desaparece
        self.assertEqual(e.tokens("aceite de la casa"), ["ACEIT", "CASA"])

    def test_cifras_deben_ser_identicas(self):
        self.assertFalse(e.tokens_parecen("460G", "400G"))
        self.assertTrue(e.tokens_parecen("460G", "460G"))

    def test_errata_parecida(self):
        self.assertTrue(e.tokens_parecen("JOHNSON", "JHONSON"))
        self.assertFalse(e.tokens_parecen("SHAMPOO", "ACONDICIONADOR"))


class TestPrecio(unittest.TestCase):
    def test_enteros(self):
        self.assertEqual(e.parsear_precio(1500), (1500, False))

    def test_texto_con_decimales(self):
        self.assertEqual(e.parsear_precio("$ 1551.05"), (1551, True))
        self.assertEqual(e.parsear_precio("$ 8687.24"), (8687, True))

    def test_cero_y_vacio_son_sin_precio(self):
        self.assertEqual(e.parsear_precio(0), (None, False))
        self.assertEqual(e.parsear_precio(None), (None, False))


class TestEmparejar(unittest.TestCase):
    def nivel(self, catalogo, excel):
        return [r["nivel"] for r in e.emparejar(catalogo, excel)]

    def test_coincidencia_segura(self):
        r = e.emparejar(
            [cat("Arveja verde", "La soberana", "460 g")],
            [exc("SOBERANA ARVEJA VERDE*460GR", "LA SOBERANA"), exc("LENTEJA SOBERANA*460GR", "LA SOBERANA", 3)],
        )
        self.assertEqual(r[0]["nivel"], "A")
        self.assertEqual(r[0]["candidatos"][0][1], 0)

    def test_cifras_distintas_no_es_segura(self):
        # 460 g contra 500 g: mismo nombre, otra presentación → no se debe asignar el precio
        self.assertNotEqual(self.nivel([cat("Arveja verde", "", "460 g")], [exc("ARVEJA VERDE*500GR")])[0], "A")

    def test_marca_distinta_no_es_segura(self):
        niveles = self.nivel(
            [cat("Lapicero Ipen en gel negro", "", "12 unidades")],
            [exc("LAPICERO OFFI ESCO GEL(NEGRO)*12 UNIDADES", "PAPELERIA")],
        )
        self.assertNotEqual(niveles[0], "A")

    def test_producto_generico_con_varios_en_excel_no_es_segura(self):
        # "Polvos Nailen" del catálogo frente a #0 y #7 del Excel: no se sabe cuál
        niveles = self.nivel(
            [cat("Polvos Nailen")],
            [exc("POLVOS NAILEN #0", "NAILEN"), exc("POLVOS NAILEN #7", "NAILEN", 3)],
        )
        self.assertNotEqual(niveles[0], "A")

    def test_dos_del_catalogo_para_la_misma_fila_no_es_segura(self):
        niveles = self.nivel(
            [cat("Tijera peluquera", sku="A"), cat("Tijera peluquera fina", sku="B")],
            [exc("TIJERA PELUQUERA FINA", "CACHARRO")],
        )
        self.assertEqual(niveles.count("A"), 1)  # solo la que coincide completa

    def test_sin_candidato(self):
        self.assertEqual(self.nivel([cat("Lenteja")], [exc("CORTINA FIESTA")])[0], "C")


if __name__ == "__main__":
    unittest.main()
