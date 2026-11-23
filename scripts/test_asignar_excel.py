"""
Pruebas de scripts/asignar_excel.py (solo biblioteca estándar).

Ejecutar desde la raíz del proyecto, en Git Bash:
    python -m unittest scripts/test_asignar_excel.py -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import asignar_excel as a  # noqa: E402


def excel(fila, desc, prov="CACHARRO", l1="1000", l2="900", inv="5"):
    return {"fila_excel": str(fila), "descripcion": desc, "proveedor": prov, "lista1": l1, "lista2": l2, "inventario": inv}


class TestPool(unittest.TestCase):
    def test_quita_lo_que_ya_tiene_dueno_y_guarda_las_pistas(self):
        revision = [
            {"sku": "A-1", "estado": "seguro", "fila_excel": "1"},
            {"sku": "A-2", "estado": "igual", "fila_excel": "2"},
            {"sku": "A-3", "estado": "revisar", "fila_excel": "3"},
            {"sku": "G-1", "estado": "varios", "fila_excel": "4 5 1"},  # la 1 ya tiene dueño: no es pista
            {"sku": "N-1", "estado": "ninguno", "fila_excel": ""},
        ]
        filas = [excel(i, f"PRODUCTO {i}") for i in range(1, 7)]
        pool, pistas = a.armar_pool(revision, filas)
        self.assertEqual(sorted(e["fila_excel"] for e in pool), ["4", "5", "6"])
        self.assertEqual(pistas, {"4": ["G-1"], "5": ["G-1"]})

    def test_repartir_en_lotes_contiguos_y_parejos(self):
        lotes = a.repartir(list(range(23)), 10)
        self.assertEqual([len(x) for x in lotes], [3, 3, 3, 2, 2, 2, 2, 2, 2, 2])
        self.assertEqual([i for lote in lotes for i in lote], list(range(23)))


class TestValidacion(unittest.TestCase):
    CATS = {("Aseo del hogar", "Jabones")}
    SKUS = {"EVC-00001-01"}

    def validar(self, filas, esperadas=None):
        return a.validar_asignacion(filas, esperadas or {f["fila_excel"] for f in filas}, self.CATS, self.SKUS)

    def fila(self, **kw):
        base = {c: "" for c in a.CAMPOS_ASIGNACION}
        base.update({"fila_excel": "1", "accion": "nuevo", "producto": "Jabón Rey", "categoria": "Aseo del hogar",
                     "subcategoria": "Jabones", "unidad_venta": "individual", "unidades_por_empaque": "1"})
        base.update(kw)
        return base

    def test_una_fila_correcta_no_da_errores(self):
        self.assertEqual(self.validar([self.fila()]), [])

    def test_nombre_en_mayusculas_o_categoria_inventada(self):
        self.assertTrue(self.validar([self.fila(producto="JABON REY")]))
        self.assertTrue(self.validar([self.fila(subcategoria="Inventada")]))

    def test_variante_no_lleva_identidad_y_exige_un_sku_real(self):
        ok = self.fila(accion="variante", sku_existente="EVC-00001-01", producto="", categoria="", subcategoria="")
        self.assertEqual(self.validar([ok]), [])
        self.assertTrue(self.validar([{**ok, "sku_existente": "EVC-99999-01"}]))
        self.assertTrue(self.validar([{**ok, "producto": "Otro"}]))

    def test_unidades_de_contenido_y_de_venta(self):
        self.assertTrue(self.validar([self.fila(contenido_valor="250", contenido_unidad="mililitros")]))
        self.assertTrue(self.validar([self.fila(contenido_valor="250")]))  # van juntos
        self.assertEqual(self.validar([self.fila(contenido_valor="0.5", contenido_unidad="L")]), [])
        # 12 unidades no puede ser "individual"
        self.assertTrue(self.validar([self.fila(unidades_por_empaque="12")]))
        self.assertEqual(self.validar([self.fila(unidad_venta="paquete", unidades_por_empaque="12")]), [])

    def test_omitir_pide_motivo(self):
        self.assertTrue(self.validar([self.fila(accion="omitir")]))
        self.assertEqual(self.validar([self.fila(accion="omitir", nota="duplicada de la fila 7")]), [])

    def test_filas_repetidas_ajenas_o_faltantes(self):
        f = self.fila()
        self.assertTrue(any("repetida" in e for e in self.validar([f, f])))
        self.assertTrue(any("no pertenece" in e for e in self.validar([f], esperadas={"2"})))
        self.assertTrue(any("falta la fila del Excel 9" in e for e in self.validar([f], esperadas={"1", "9"})))


PRODUCTOS = {"EVC-00072-01": {"producto": "Esmalte Bardot", "categoria": "Cuidado personal", "subcategoria": "Cosméticos", "marca": "Bardot"}}


def asignacion(fila, accion, **kw):
    base = {c: "" for c in a.CAMPOS_ASIGNACION}
    base.update({"fila_excel": str(fila), "accion": accion, "unidad_venta": "individual", "unidades_por_empaque": "1"})
    base.update(kw)
    return base


class TestDuplicados(unittest.TestCase):
    PROD = {
        "EVC-00723-01": {"producto": "Aceite para bebé", "categoria": "Cuidado personal", "subcategoria": "Implementos de belleza", "marca": ""},
        "EVC-00316-01": {"producto": "Cinta enmascarar pulgada", "categoria": "Útiles escolares y oficina", "subcategoria": "Útiles escolares", "marca": ""},
    }

    def test_nuevo_con_el_mismo_nombre_pasa_a_ser_presentacion_y_conserva_la_marca(self):
        n = asignacion(1, "nuevo", producto="Aceite para bebe", categoria="Cuidado personal",
                       subcategoria="Implementos de belleza", marca="Juhnio´s rold", presentacion="40 ml")
        salida, avisos = a.convertir_duplicados_exactos([n], self.PROD)
        self.assertEqual(salida[0]["accion"], "variante")
        self.assertEqual(salida[0]["sku_existente"], "EVC-00723-01")
        self.assertEqual((salida[0]["producto"], salida[0]["marca"]), ("", ""))
        self.assertEqual(salida[0]["presentacion"], "Juhnio´s rold · 40 ml")
        self.assertEqual(len(avisos), 1)

    def test_otro_nombre_o_otra_subcategoria_no_se_toca(self):
        otro = asignacion(2, "nuevo", producto="Aceite de bebé", categoria="Cuidado personal", subcategoria="Cuidado capilar")
        distinto = asignacion(3, "nuevo", producto="Cinta enmascarar 2 pulgadas", categoria="Útiles escolares y oficina",
                              subcategoria="Útiles escolares")
        salida, _ = a.convertir_duplicados_exactos([otro, distinto], self.PROD)
        self.assertEqual([x["accion"] for x in salida], ["nuevo", "nuevo"])

    def test_lista_los_nombres_parecidos_pero_no_los_iguales(self):
        n = asignacion(3, "nuevo", producto="Cinta enmascarar 2 pulgadas", categoria="Útiles escolares y oficina",
                       subcategoria="Útiles escolares")
        filas = a.posibles_duplicados([n], self.PROD)
        self.assertEqual(filas[0]["sku_existente"], "EVC-00316-01")


class TestSeparacion(unittest.TestCase):
    def fila(self, sku, producto="Jabón Rey", precio="1000"):
        base = {c: "" for c in a.CAMPOS_CATALOGO}
        base.update({"sku": sku, "producto": producto, "categoria": "Aseo del hogar", "subcategoria": "Jabones", "precio_unidad": precio})
        return base

    def test_con_duda_solo_si_dice_revisar(self):
        self.assertTrue(a.con_duda({"nota": "REVISAR: cantidad supuesta"}))
        self.assertFalse(a.con_duda({"nota": ""}))
        self.assertFalse(a.con_duda({"nota": "[convertida a presentación: el producto ya existía]"}))

    def test_la_presentacion_dudosa_de_un_producto_con_resto_confiable_lleva_ancla(self):
        confiables = [self.fila("EVP-00001-01")]
        dudosas = [self.fila("EVP-00001-02"), self.fila("EVP-00002-01", "Otro")]
        anclas = a.anclas_de_confiables(dudosas, confiables)
        self.assertEqual([x["sku"] for x in anclas], ["EVP-00001-01"])
        self.assertEqual(anclas[0]["precio_unidad"], "")  # el ancla no toca nada

    def test_un_producto_totalmente_dudoso_no_lleva_ancla(self):
        self.assertEqual(a.anclas_de_confiables([self.fila("EVP-00002-01", "Otro")], [self.fila("EVP-00001-01")]), [])


class TestArmar(unittest.TestCase):
    def armar(self, asignaciones, previos=None, genericos=frozenset()):
        excel_ = {"10": excel(10, "ESMALTE BARDOT #103", "BARDOT", "3378", "3250"),
                  "11": excel(11, "ESMALTE BARDOT #67", "BARDOT", "3378", "3250"),
                  "12": excel(12, "JABON REY*3", "CACHARRO", "5000", "3000"),
                  "13": excel(13, "JABON REY*6", "CACHARRO", "9000", "8000"),
                  "14": excel(14, "COSA SIN PRECIO", l1="")}
        costos = {k: {"costo": 2500, "stock": 4} for k in excel_}
        return a.armar_filas(asignaciones, excel_, costos, PRODUCTOS,
                             {"EVC-00072-01": ["EVC-00072-01"]}, set(genericos), previos or {})

    def test_variantes_de_un_existente_llevan_ancla_y_siguen_la_numeracion(self):
        r = self.armar([asignacion(10, "variante", sku_existente="EVC-00072-01", presentacion="#103"),
                        asignacion(11, "variante", sku_existente="EVC-00072-01", presentacion="#67")])
        skus = [f["sku"] for f in r["catalogo"]]
        self.assertEqual(skus, ["EVC-00072-01", "EVC-00072-02", "EVC-00072-03"])  # ancla + 2 nuevas
        self.assertEqual(r["catalogo"][0]["precio_unidad"], "")  # el ancla no toca nada
        self.assertEqual(r["catalogo"][1]["producto"], "Esmalte Bardot")  # identidad copiada del existente
        self.assertEqual([p["sku"] for p in r["precios"]], ["EVC-00072-02", "EVC-00072-03"])

    def test_si_el_ancla_es_generica_se_desactiva(self):
        r = self.armar([asignacion(10, "variante", sku_existente="EVC-00072-01", presentacion="#103")], genericos={"EVC-00072-01"})
        self.assertEqual(r["catalogo"][0]["sku"], "EVC-00072-01")
        self.assertEqual(r["catalogo"][0]["activo"], "no")
        self.assertEqual(r["desactivadas"], ["EVC-00072-01"])

    def test_nuevos_con_la_misma_identidad_son_un_solo_producto(self):
        ident = dict(producto="Jabón Rey", categoria="Aseo del hogar", subcategoria="Jabones")
        r = self.armar([asignacion(12, "nuevo", presentacion="3 unidades", **ident),
                        asignacion(13, "nuevo", presentacion="6 unidades", **ident)])
        self.assertEqual([f["sku"] for f in r["catalogo"]], ["EVP-00001-01", "EVP-00001-02"])

    def test_el_precio_por_mayor_dudoso_no_viaja_y_el_costo_si(self):
        r = self.armar([asignacion(12, "nuevo", producto="Jabón Rey", categoria="Aseo del hogar", subcategoria="Jabones")])
        self.assertEqual(r["catalogo"][0]["precio_mayor"], "")  # 3000 es el 60 % de 5000
        self.assertEqual(r["precios"][0]["costo"], 2500)
        self.assertEqual(r["precios"][0]["stock"], 4)
        r2 = self.armar([asignacion(10, "variante", sku_existente="EVC-00072-01")])
        self.assertEqual(r2["catalogo"][1]["precio_mayor"], 3250)

    def test_fila_sin_precio_no_se_importa(self):
        r = self.armar([asignacion(14, "nuevo", producto="Cosa", categoria="Aseo del hogar", subcategoria="Jabones")])
        self.assertEqual(r["catalogo"], [])
        self.assertEqual(r["revision"][0]["accion"], "SIN PRECIO")

    def test_repetir_conserva_los_sku_y_los_nuevos_continuan(self):
        ident = dict(producto="Jabón Rey", categoria="Aseo del hogar", subcategoria="Jabones")
        primera = self.armar([asignacion(12, "nuevo", **ident)])
        previos = {k: {"fila_excel": k, **v} for k, v in primera["asignados"].items()}
        segunda = self.armar([asignacion(12, "nuevo", **ident), asignacion(13, "nuevo", **ident)], previos=previos)
        self.assertEqual([f["sku"] for f in segunda["catalogo"]], ["EVP-00001-01", "EVP-00001-02"])


if __name__ == "__main__":
    unittest.main()
