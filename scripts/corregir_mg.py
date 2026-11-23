"""
Propone corregir las presentaciones del catálogo que dicen «mg» cuando el producto es
un líquido (ml) o una crema/pasta (g). El error viene del PDF: «ml» se leyó como «mg».

Evidencia, de más a menos fuerte:
  1. El Excel del proveedor, para ese mismo producto, dice «110GR» o «30 ML» con el mismo número.
  2. El tipo de producto (shampoo, aceite, loción → ml; crema, pomada, polvo → g).
  3. Nada: queda como «dudoso» para que una persona decida.
Los medicamentos (categoría Farmacia) NO se tocan sin evidencia del Excel: ahí «mg» suele ser real.

Uso (desde la raíz del proyecto, en Git Bash; antes hay que haber corrido emparejar y consolidar):
    python scripts/corregir_mg.py

Crea en data/precios_ev/ (ignorada por git):
    correcciones_mg.csv   una fila por presentación con «mg», con la propuesta y su evidencia

Solo biblioteca estándar.
"""

from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import emparejar_precios as ep  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
CARPETA = RAIZ / "data" / "precios_ev"
CATALOGO = RAIZ / "data" / "importacion_ev.csv"

LIQUIDOS = {
    "shampoo", "champu", "acondicionador", "aceite", "locion", "splash", "colonia", "spray", "brillo",
    "tinta", "espuma", "jarabe", "removedor", "repelente", "desinfectante", "silicona", "ambientador",
    "suavizante", "detergente", "limpiador", "gotas", "agua", "vinagre", "alcohol", "enjuague", "perfume",
    "humectante", "ablandador", "tonico", "laca", "gel", "esencia", "neutralizante", "blanqueador",
}
SOLIDOS = {"crema", "pomada", "polvo", "polvos", "talco", "pasta", "unguento", "mascarilla", "tratamiento", "cera", "jabon", "barra"}
PATRON_EXCEL = re.compile(r"(\d+(?:[.,]\d+)?)\s*(GRAMOS|GRS|GR|G|MILILITROS|MLS|ML|CC|MG)\b", re.I)


def unidad_en_excel(descripcion: str, valor: float) -> str | None:
    """Unidad (g, ml o mg) con la que el Excel escribe ese mismo número, o None."""
    for num, u in PATRON_EXCEL.findall(descripcion or ""):
        if abs(float(num.replace(",", ".")) - valor) < 1e-9:
            u = u.upper()
            return "ml" if u in ("ML", "MLS", "MILILITROS", "CC") else ("mg" if u == "MG" else "g")
    return None


def unidad_por_tipo(producto: str) -> str | None:
    """ml o g según las palabras del nombre. Si dice «líquid» o es un líquido conocido, ml."""
    palabras = set(ep.normalizar(producto).lower().split())
    if "liquido" in palabras or "liquida" in palabras:
        return "ml"
    if palabras & LIQUIDOS and not palabras & {"crema", "pomada", "polvo", "polvos", "talco", "pasta"}:
        return "ml"
    if palabras & SOLIDOS:
        return "g"
    return None


def presentacion_nueva(texto: str, unidad: str) -> str:
    """'15 mg · 12 unidades' → '15 ml · 12 unidades' (solo cambia la unidad del contenido)."""
    return re.sub(r"(\d[\d.,]*)\s*mg\b", rf"\1 {unidad}", texto, count=1)


def proponer(variante: dict, descripciones_excel: list[str]) -> dict:
    """Propuesta para UNA presentación con mg. PURA, con pruebas."""
    try:
        valor = float((variante["contenido_valor"] or "").replace(",", "."))
    except ValueError:
        valor = None
    unidad, origen, evidencia = None, "dudoso", ""
    if valor is not None:
        for d in descripciones_excel:
            u = unidad_en_excel(d, valor)
            if u:
                unidad, origen, evidencia = u, "Excel", d
                break
    if unidad is None and variante["categoria"] != "Farmacia":
        u = unidad_por_tipo(variante["producto"])
        if u:
            unidad, origen = u, "tipo de producto"
    if unidad is None or unidad == "mg":
        return {"propuesta": "", "origen": "dudoso" if unidad is None else "Excel (es mg de verdad)",
                "evidencia": evidencia, "presentacion_nueva": ""}
    return {"propuesta": unidad, "origen": origen, "evidencia": evidencia,
            "presentacion_nueva": presentacion_nueva(variante["presentacion"], unidad)}


def main() -> int:
    with open(CATALOGO, encoding="utf-8-sig", newline="") as f:
        catalogo = list(csv.DictReader(f))
    with open(CARPETA / "revision_precios.csv", encoding="utf-8-sig", newline="") as f:
        revision = {r["sku"]: r for r in csv.DictReader(f)}
    with open(CARPETA / "excel_sin_costo.csv", encoding="utf-8-sig", newline="") as f:
        excel = {r["fila_excel"]: r["descripcion"] for r in csv.DictReader(f)}

    filas = []
    for c in catalogo:
        if c["contenido_unidad"] != "mg":
            continue
        r = revision.get(c["sku"], {})
        descs = [excel[x] for x in (r.get("fila_excel") or "").split()[:3] if x in excel]
        p = proponer(c, descs)
        filas.append({
            "sku": c["sku"], "producto": c["producto"], "marca": c["marca"], "categoria": c["categoria"],
            "subcategoria": c["subcategoria"], "presentacion_actual": c["presentacion"],
            "contenido_valor": c["contenido_valor"], "unidad_propuesta": p["propuesta"],
            "presentacion_nueva": p["presentacion_nueva"], "origen": p["origen"],
            "evidencia_excel": p["evidencia"], "estado_coincidencia": r.get("estado", ""),
        })
    campos = list(filas[0].keys())
    with open(CARPETA / "correcciones_mg.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=campos)
        w.writeheader()
        w.writerows(filas)
    conteo: dict[str, int] = {}
    for x in filas:
        conteo[x["origen"]] = conteo.get(x["origen"], 0) + 1
    print({"presentaciones_con_mg": len(filas), "por_origen": conteo})
    return 0


if __name__ == "__main__":
    sys.exit(main())
