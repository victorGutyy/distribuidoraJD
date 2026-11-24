"""
Empareja el Excel de precios del proveedor con el catálogo (SKU de EV).

El Excel NO trae SKU: solo "Descripción", "Categoría" (en realidad el proveedor o
la marca), COSTO, Lista 1 (detal), Lista 2 (por mayor), Impto e Inventario. Para no
equivocarnos de precio, este script compara nombre, marca y presentación (con sus
cifras: 460 g, 12 unidades, #7…) y clasifica cada variante del catálogo en:

  A  coincidencia segura: mismas palabras, mismas cifras, mejor opción en ambos
     sentidos y sin segunda opción parecida. Es la única que se propone sin revisión.
  B  probable: hay un candidato bueno pero algo no cuadra (marca, número, etc.).
     Una persona (o yo) la revisa antes de usarla.
  C  sin candidato claro.

Uso (desde la raíz del proyecto, en Git Bash):
    python scripts/emparejar_precios.py "C:/ruta/listado de precio actualizadoEV.xlsx"

Crea en data/precios_ev/ (NO se sube a git: contiene precios internos):
    candidatos.csv       una fila por variante del catálogo, con sus 3 mejores candidatos
    excel_sin_par.csv    filas del Excel que no quedaron emparejadas con nada seguro

NUNCA copia la columna COSTO a los archivos de salida. Solo biblioteca estándar.
"""

from __future__ import annotations

import csv
import difflib
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CATALOGO = RAIZ / "data" / "importacion_ev.csv"
SALIDA = RAIZ / "data" / "precios_ev"

# Palabras que no distinguen un producto de otro.
PALABRAS_VACIAS = {"DE", "LA", "EL", "LOS", "LAS", "Y", "CON", "PARA", "EN", "DEL", "POR", "A", "AL"}
# Palabras de empaque: se quitan porque el catálogo las escribe distinto ("12 unidades" / "*12").
PALABRAS_EMPAQUE = {"UNIDAD", "UNIDADES", "UNDS", "UND", "UN", "X", "UNID", "INDIVIDUAL", "PAQUETE", "PAQ"}

UMBRAL_TOKEN_PARECIDO = 0.84
UMBRAL_A = 0.80
UMBRAL_B = 0.55
MARGEN_A = 0.10


# ---------------------------------------------------------------- texto

def normalizar(texto: str) -> str:
    """Mayúsculas, sin tildes, unidades unificadas (460 GR → 460G) y sin signos."""
    s = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode().upper()
    s = re.sub(r"(\d)\s*/\s*(\d)", r"\1_\2", s)  # fracciones: 1/2 → 1_2
    s = re.sub(r"(\d)[.,](\d)", r"\1_\2", s)  # decimales: 8.5 → 8_5
    s = s.replace("*", " ").replace("/", " ").replace("-", " ").replace("+", " ").replace("#", " #")
    s = re.sub(r"(\d)\s*(GRAMOS|GRS|GR|G)\b", r"\1G", s)
    s = re.sub(r"(\d)\s*(MILILITROS|MLS|ML)\b", r"\1ML", s)
    s = re.sub(r"(\d)\s*(KILOGRAMOS|KILOS|KILO|KGS|KG)\b", r"\1KG", s)
    s = re.sub(r"(\d)\s*(LITROS|LTS|LT|L)\b", r"\1L", s)
    s = re.sub(r"(\d)\s*(CENTIMETROS|CMS|CM)\b", r"\1CM", s)
    s = re.sub(r"(\d)\s*(METROS|MTS|MT|M)\b", r"\1M", s)
    s = re.sub(r"(\d)\s*(TABLETAS|TABLETA|TAB|CAPSULAS|CAPSULA|CAPS)\b", r"\1", s)
    s = re.sub(r"(\d)\s*(UNIDADES|UNIDAD|UNDS|UND|UNID|UN|U)\b", r"\1", s)
    s = re.sub(r"[^A-Z0-9_# ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def raiz(token: str) -> str:
    """Quita plural y 'e' final para que ACEITES = ACEITE y PINCELES = PINCEL."""
    if len(token) > 4 and token.endswith("S") and not token.endswith("SS"):
        token = token[:-1]
    if len(token) > 4 and token.endswith("E"):
        token = token[:-1]
    return token


def tiene_digito(token: str) -> bool:
    return any(c.isdigit() for c in token)


def tokens(texto: str) -> list[str]:
    salida = []
    for t in normalizar(texto).split():
        if t in PALABRAS_VACIAS or t in PALABRAS_EMPAQUE:
            continue
        salida.append(t if tiene_digito(t) else raiz(t))
    return salida


def tokens_parecen(a: str, b: str) -> bool:
    if a == b:
        return True
    if tiene_digito(a) or tiene_digito(b):
        return False  # las cifras deben ser idénticas
    if len(a) < 5 or len(b) < 5:
        return False
    return difflib.SequenceMatcher(None, a, b).ratio() >= UMBRAL_TOKEN_PARECIDO


# ---------------------------------------------------------------- precios

def parsear_precio(valor) -> tuple[int | None, bool]:
    """Devuelve (pesos enteros o None, redondeado?). '$ 1551.05' → (1551, True)."""
    if valor is None or valor == "":
        return None, False
    if isinstance(valor, (int, float)):
        numero = float(valor)
    else:
        limpio = re.sub(r"[^\d.,-]", "", str(valor)).replace(",", ".")
        try:
            numero = float(limpio)
        except ValueError:
            return None, False
    if numero <= 0:
        return None, False
    entero = int(round(numero))
    return entero, abs(numero - entero) > 1e-9


# ---------------------------------------------------------------- lectura del xlsx (sin librerías)

_NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def _col_a_indice(ref: str) -> int:
    letras = re.match(r"[A-Z]+", ref).group(0)
    n = 0
    for c in letras:
        n = n * 26 + (ord(c) - 64)
    return n - 1


_NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_NS_PAQ = "http://schemas.openxmlformats.org/package/2006/relationships"


def _ruta_de_hoja(z: zipfile.ZipFile, hoja: str | None) -> str:
    """Ruta interna de una hoja por su nombre (la primera si no se indica)."""
    libro = ET.fromstring(z.read("xl/workbook.xml"))
    hojas = libro.find("m:sheets", _NS).findall("m:sheet", _NS)
    elegida = next((h for h in hojas if hoja is None or h.get("name") == hoja), None)
    if elegida is None:
        raise KeyError(f"El archivo no tiene una hoja llamada «{hoja}»")
    rid = elegida.get(f"{{{_NS_REL}}}id")
    for rel in ET.fromstring(z.read("xl/_rels/workbook.xml.rels")).findall(f"{{{_NS_PAQ}}}Relationship"):
        if rel.get("Id") == rid:
            destino = rel.get("Target")
            return destino.lstrip("/") if destino.startswith("/") else "xl/" + destino
    raise KeyError("No se encontró la hoja dentro del archivo")


def leer_xlsx(ruta: Path, hoja: str | None = None) -> list[dict]:
    """Lee una hoja de un .xlsx (la primera por defecto) como lista de dicts, solo con zipfile + xml."""
    with zipfile.ZipFile(ruta) as z:
        compartidas: list[str] = []
        if "xl/sharedStrings.xml" in z.namelist():
            raiz_xml = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in raiz_xml.findall("m:si", _NS):
                compartidas.append("".join(t.text or "" for t in si.iter(f"{{{_NS['m']}}}t")))
        sheet = ET.fromstring(z.read(_ruta_de_hoja(z, hoja)))

    filas: list[list] = []
    for fila in sheet.find("m:sheetData", _NS).findall("m:row", _NS):
        valores: dict[int, object] = {}
        for c in fila.findall("m:c", _NS):
            v = c.find("m:v", _NS)
            if c.get("t") == "inlineStr":  # texto escrito dentro de la celda (otros programas lo usan)
                valor = "".join(t.text or "" for t in c.iter(f"{{{_NS['m']}}}t"))
            elif v is None or v.text is None:
                continue
            elif c.get("t") == "s":
                valor = compartidas[int(v.text)]
            elif c.get("t") in ("str", "e"):
                valor = v.text
            elif c.get("t") == "b":
                valor = bool(int(v.text))
            else:
                n = float(v.text)
                valor = int(n) if n == int(n) else n
            valores[_col_a_indice(c.get("r"))] = valor
        if valores:
            filas.append([valores.get(i) for i in range(max(valores) + 1)])

    encabezado = [str(h).strip() for h in filas[0]]
    resultado = []
    for numero, fila in enumerate(filas[1:], start=2):
        d = {encabezado[i]: (fila[i] if i < len(fila) else None) for i in range(len(encabezado))}
        d["_fila"] = numero  # número de fila en el Excel, para que la persona lo encuentre
        resultado.append(d)
    return resultado


# ---------------------------------------------------------------- emparejamiento

class Item:
    """Un lado de la comparación (variante del catálogo o fila del Excel)."""

    def __init__(self, texto: str, extra_libre: str = ""):
        self.tokens = tokens(texto)
        self.libres = tokens(extra_libre)  # proveedor/marca: no penalizan si sobran
        self.numeros = sorted(t for t in self.tokens if tiene_digito(t))


def comparar(c: Item, e: Item) -> dict:
    """Compara una variante del catálogo con una fila del Excel."""
    usados: set[int] = set()
    pares = 0
    sin_par_c: list[str] = []
    for t in c.tokens:
        for i, u in enumerate(e.tokens):
            if i not in usados and tokens_parecen(t, u):
                usados.add(i)
                pares += 1
                break
        else:
            sin_par_c.append(t)
    sin_par_e = [
        u for i, u in enumerate(e.tokens)
        if i not in usados and not any(tokens_parecen(u, l) for l in c.libres + e.libres)
    ]
    n_c = len(c.tokens)
    n_e = len([u for u in e.tokens if not any(tokens_parecen(u, l) for l in e.libres)]) or 1
    dice = 2 * pares / (n_c + n_e) if (n_c + n_e) else 0
    mismas_cifras = c.numeros == e.numeros
    cifras_distintas = len(set(c.numeros) ^ set(e.numeros))
    puntaje = max(dice - 0.15 * cifras_distintas, 0)
    return {
        "puntaje": puntaje,
        "sin_par_catalogo": sin_par_c,
        "sin_par_excel": sin_par_e,
        "mismas_cifras": mismas_cifras,
    }


def indice_inverso(items: list[Item]) -> dict[str, set[int]]:
    """token → posiciones, con clave por raíz y por prefijo de 4 letras (tolera erratas)."""
    idx: dict[str, set[int]] = {}
    for pos, it in enumerate(items):
        for t in it.tokens:
            idx.setdefault(t, set()).add(pos)
            if not tiene_digito(t) and len(t) >= 5:
                idx.setdefault("~" + t[:4], set()).add(pos)
    return idx


def candidatos_de(c: Item, idx: dict[str, set[int]]) -> set[int]:
    pos: set[int] = set()
    for t in c.tokens:
        pos |= idx.get(t, set())
        if not tiene_digito(t) and len(t) >= 5:
            pos |= idx.get("~" + t[:4], set())
    return pos


def emparejar(catalogo: list[dict], excel: list[dict]) -> list[dict]:
    items_c = [
        Item(" ".join([c["producto"], c["marca"], c["presentacion"]]), c["marca"]) for c in catalogo
    ]
    items_e = [Item(e["Descripción"] or "", e.get("Categoría") or "") for e in excel]
    idx = indice_inverso(items_e)

    # Todas las comparaciones razonables (solo pares que comparten alguna palabra).
    por_catalogo: list[list[tuple[float, int, dict]]] = []
    por_excel: dict[int, list[tuple[float, int]]] = {}
    for j, c in enumerate(items_c):
        lista = []
        for i in candidatos_de(c, idx):
            r = comparar(c, items_e[i])
            if r["puntaje"] > 0:
                lista.append((r["puntaje"], i, r))
                por_excel.setdefault(i, []).append((r["puntaje"], j))
        lista.sort(key=lambda x: -x[0])
        por_catalogo.append(lista[:5])
    for v in por_excel.values():
        v.sort(reverse=True)

    resultado = []
    for j, lista in enumerate(por_catalogo):
        nivel, motivo = "C", "sin candidato"
        if lista:
            p1, i1, r1 = lista[0]
            p2 = lista[1][0] if len(lista) > 1 else 0.0
            mejor_excel = por_excel[i1]
            es_mutuo = mejor_excel[0][1] == j
            otro_excel = mejor_excel[1][0] if len(mejor_excel) > 1 else 0.0
            margen = min(p1 - p2, (mejor_excel[0][0] - otro_excel) if es_mutuo else 0)
            limpio = not r1["sin_par_catalogo"] and not r1["sin_par_excel"] and r1["mismas_cifras"]
            if p1 >= UMBRAL_A and limpio and es_mutuo and margen >= MARGEN_A:
                nivel, motivo = "A", "mismas palabras y cifras; mejor opción en ambos sentidos"
            elif p1 >= UMBRAL_B:
                razones = []
                if not r1["mismas_cifras"]:
                    razones.append("cifras distintas")
                if r1["sin_par_catalogo"]:
                    razones.append("catálogo tiene de más: " + " ".join(r1["sin_par_catalogo"]))
                if r1["sin_par_excel"]:
                    razones.append("Excel tiene de más: " + " ".join(r1["sin_par_excel"]))
                if not es_mutuo:
                    razones.append("otro producto del catálogo encaja mejor con esa fila")
                if p1 - p2 < MARGEN_A and len(lista) > 1:
                    razones.append("hay otra opción casi igual")
                nivel, motivo = "B", "; ".join(razones) or "puntaje medio"
        resultado.append({"nivel": nivel, "motivo": motivo, "candidatos": lista})
    return resultado


# ---------------------------------------------------------------- salida

def _fila_excel(e: dict) -> dict:
    l1, red1 = parsear_precio(e.get("Lista 1"))
    l2, red2 = parsear_precio(e.get("Lista 2"))
    return {
        "fila_excel": e["_fila"],
        "descripcion": e.get("Descripción") or "",
        "proveedor": e.get("Categoría") or "",
        "lista1": l1,
        "lista2": l2,
        "inventario": e.get("Inventario"),
        "redondeado": "sí" if (red1 or red2) else "",
    }


def escribir_salidas(catalogo: list[dict], excel: list[dict], resultado: list[dict]) -> dict:
    SALIDA.mkdir(parents=True, exist_ok=True)
    campos = ["sku", "producto", "marca", "presentacion", "unidad_venta", "nivel", "motivo"]
    for k in (1, 2, 3):
        campos += [f"c{k}_{n}" for n in ("fila_excel", "descripcion", "proveedor", "lista1", "lista2", "inventario", "puntaje")]
    usadas_a: set[int] = set()
    with open(SALIDA / "candidatos.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=campos)
        w.writeheader()
        for c, r in zip(catalogo, resultado):
            fila = {k: c.get(k, "") for k in ("sku", "producto", "marca", "presentacion", "unidad_venta")}
            fila["nivel"], fila["motivo"] = r["nivel"], r["motivo"]
            for k, (p, i, _) in enumerate(r["candidatos"][:3], start=1):
                d = _fila_excel(excel[i])
                fila.update({
                    f"c{k}_fila_excel": d["fila_excel"], f"c{k}_descripcion": d["descripcion"],
                    f"c{k}_proveedor": d["proveedor"], f"c{k}_lista1": d["lista1"] or "",
                    f"c{k}_lista2": d["lista2"] or "", f"c{k}_inventario": d["inventario"],
                    f"c{k}_puntaje": f"{p:.2f}",
                })
                if k == 1 and r["nivel"] == "A":
                    usadas_a.add(i)
            w.writerow(fila)
    with open(SALIDA / "excel_sin_par.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["fila_excel", "descripcion", "proveedor", "lista1", "lista2", "inventario"])
        for i, e in enumerate(excel):
            if i not in usadas_a:
                d = _fila_excel(e)
                w.writerow([d["fila_excel"], d["descripcion"], d["proveedor"], d["lista1"] or "", d["lista2"] or "", d["inventario"]])
    escribir_excel_limpio(excel)
    escribir_lotes(catalogo, excel, resultado)
    conteo = {n: sum(1 for r in resultado if r["nivel"] == n) for n in "ABC"}
    conteo["excel_sin_par"] = len(excel) - len(usadas_a)
    return conteo


def escribir_excel_limpio(excel: list[dict]) -> None:
    """Copia del Excel sin la columna COSTO y con precios ya en pesos enteros."""
    with open(SALIDA / "excel_sin_costo.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["fila_excel", "descripcion", "proveedor", "lista1", "lista2", "inventario", "redondeado"])
        for e in excel:
            d = _fila_excel(e)
            w.writerow([d["fila_excel"], d["descripcion"], d["proveedor"], d["lista1"] or "", d["lista2"] or "", d["inventario"], d["redondeado"]])


def escribir_lotes(catalogo: list[dict], excel: list[dict], resultado: list[dict], tamano: int = 190) -> int:
    """Reparte las variantes NO seguras (B y C) en lotes para revisarlas una por una."""
    pendientes = [(c, r) for c, r in zip(catalogo, resultado) if r["nivel"] != "A"]
    pendientes.sort(key=lambda x: x[0]["sku"])
    for viejo in SALIDA.glob("lote_*.csv"):
        viejo.unlink()
    n_lotes = 0
    for inicio in range(0, len(pendientes), tamano):
        n_lotes += 1
        with open(SALIDA / f"lote_{n_lotes}.csv", "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(["sku", "producto", "marca", "presentacion", "unidad_venta", "nivel", "sugeridos_fila_excel"])
            for c, r in pendientes[inicio:inicio + tamano]:
                sugeridos = " ".join(str(excel[x[1]]["_fila"]) for x in r["candidatos"][:3])
                w.writerow([c["sku"], c["producto"], c["marca"], c["presentacion"], c["unidad_venta"], r["nivel"], sugeridos])
    return n_lotes


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__)
        return 1
    excel = leer_xlsx(Path(argv[1]))
    catalogo = list(csv.DictReader(open(CATALOGO, encoding="utf-8-sig")))
    print(f"Excel: {len(excel)} filas · Catálogo: {len(catalogo)} variantes")
    conteo = escribir_salidas(catalogo, excel, emparejar(catalogo, excel))
    print("Resultado:", conteo)
    print(f"Archivos en {SALIDA}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
