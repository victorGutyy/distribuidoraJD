"""
Junta el emparejamiento automático (A) con las decisiones revisadas una por una
(decision_lote_N.csv) y genera los archivos finales de precios.

Uso (desde la raíz del proyecto, en Git Bash), después de emparejar_precios.py:
    python scripts/consolidar_precios.py
    python scripts/consolidar_precios.py "C:/ruta/listado de precio actualizadoEV.xlsx"   (agrega costo e inventario)

Crea en data/precios_ev/ (NO se sube a git):
    precios_para_importar.csv   formato "solo precios" del importador (SOLO filas seguras)
    revision_precios.csv        TODAS las variantes del catálogo con su estado, para que una persona revise
    excel_no_asignado.csv       filas del Excel que no quedaron en ninguna variante del catálogo
    precios_costos_para_importar.csv   (solo si pasas el .xlsx) lo mismo + columnas costo y stock (RF-32)

Una variante entra en precios_para_importar.csv únicamente si:
  - es coincidencia segura (A), o
  - fue revisada y marcada 'igual' con confianza 'alta',
  Y su fila del Excel no la reclama otra variante, Y no tiene un problema de datos
  que impida guardar el precio (p. ej. precio por mayor mayor que el precio unidad).

El COSTO es un dato privado (RN-14): solo se lee del .xlsx cuando tú lo pasas, y solo se escribe en
precios_costos_para_importar.csv (carpeta ignorada por git). Solo biblioteca estándar.
"""

from __future__ import annotations

import csv
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import emparejar_precios as ep  # noqa: E402  (lee el xlsx y redondea precios)

RAIZ = Path(__file__).resolve().parent.parent
CARPETA = RAIZ / "data" / "precios_ev"
CATALOGO = RAIZ / "data" / "importacion_ev.csv"

# Si el precio por mayor es menos de este % del precio unidad se avisa (posible error de digitación).
MINIMO_RELACION_MAYOR = 0.85


def entero(valor: str) -> int | None:
    valor = (valor or "").strip()
    return int(valor) if valor.isdigit() else None


def puede_guardar_mayor(l1: int | None, l2: int | None) -> bool:
    """El precio por mayor solo se guarda si existe, no supera al unitario y no parece un error."""
    return bool(l1 and l2 and MINIMO_RELACION_MAYOR * l1 <= l2 <= l1)


def alertas_de_precio(l1: int | None, l2: int | None, inventario: str, redondeado: str) -> list[str]:
    """Problemas de datos de una fila del Excel que una persona debe saber."""
    alertas = []
    if l1 is None:
        alertas.append("sin Lista 1 (precio unidad)")
    if l2 is None:
        alertas.append("sin Lista 2 (no tiene precio por mayor)")
    elif l1 is not None and l2 > l1:
        alertas.append("Lista 2 mayor que Lista 1: no se guarda el precio por mayor")
    elif l1 is not None and l2 < l1 * MINIMO_RELACION_MAYOR:
        alertas.append(f"Lista 2 muy baja frente a Lista 1 ({l2} vs {l1}): no se guarda el precio por mayor hasta confirmar")
    if redondeado:
        alertas.append("el Excel traía decimales: se redondeó a pesos enteros")
    try:
        if int(inventario) < 0:
            alertas.append("inventario negativo en el Excel")
    except (TypeError, ValueError):
        pass
    return alertas


def costo_y_stock(fila_excel: dict) -> dict:
    """Costo (pesos enteros con IVA) y existencias de una fila del Excel. Sin dato → None."""
    costo, _ = ep.parsear_precio(fila_excel.get("COSTO"))
    inventario = fila_excel.get("Inventario")
    stock = int(round(inventario)) if isinstance(inventario, (int, float)) else None
    return {"costo": costo, "stock": stock}


def leer_decisiones() -> dict[str, dict]:
    decisiones: dict[str, dict] = {}
    for ruta in sorted(CARPETA.glob("decision_lote_*.csv")):
        for fila in csv.DictReader(open(ruta, encoding="utf-8-sig")):
            decisiones[fila["sku"]] = fila
    return decisiones


def consolidar(ruta_xlsx: str | None = None) -> dict:
    catalogo = list(csv.DictReader(open(CATALOGO, encoding="utf-8-sig")))
    candidatos = {r["sku"]: r for r in csv.DictReader(open(CARPETA / "candidatos.csv", encoding="utf-8-sig"))}
    excel = {r["fila_excel"]: r for r in csv.DictReader(open(CARPETA / "excel_sin_costo.csv", encoding="utf-8-sig"))}
    decisiones = leer_decisiones()

    # 1) Estado propuesto de cada variante.
    filas = []
    for c in catalogo:
        sku = c["sku"]
        cand = candidatos[sku]
        d = decisiones.get(sku)
        estado, fila_excel, nota, confianza = "sin_revisar", "", "", ""
        if cand["nivel"] == "A":
            estado, fila_excel, confianza = "seguro", cand["c1_fila_excel"], "alta"
            nota = "coincidencia automática exacta"
        elif d:
            confianza, nota = d["confianza"], d["nota"]
            if d["decision"] == "igual":
                estado, fila_excel = ("igual" if confianza == "alta" else "revisar"), d["filas_excel"]
            elif d["decision"] == "duda":
                estado, fila_excel = "revisar", d["filas_excel"]
            elif d["decision"] == "varios":
                estado, fila_excel = "varios", d["filas_excel"]
            else:
                estado = "ninguno"
        filas.append({"c": c, "estado": estado, "fila_excel": fila_excel, "nota": nota, "confianza": confianza})

    # 2) Una fila del Excel solo puede alimentar a UNA variante.
    reclamos: dict[str, list[dict]] = defaultdict(list)
    for f in filas:
        if f["estado"] in ("seguro", "igual") and f["fila_excel"]:
            reclamos[f["fila_excel"]].append(f)
    for fila_excel, lista in reclamos.items():
        if len(lista) > 1:
            for f in lista:
                f["estado"] = "revisar"
                f["nota"] = (f["nota"] + "; " if f["nota"] else "") + f"la fila {fila_excel} del Excel la reclaman {len(lista)} variantes"

    # 3) Salidas.
    importables, revision, usadas = [], [], set()
    for f in filas:
        c, e = f["c"], excel.get(f["fila_excel"].split(" ")[0]) if f["fila_excel"] else None
        l1 = entero(e["lista1"]) if e else None
        l2 = entero(e["lista2"]) if e else None
        alertas = alertas_de_precio(l1, l2, e["inventario"], e["redondeado"]) if e else []
        revision.append({
            "sku": c["sku"], "producto": c["producto"], "marca": c["marca"], "presentacion": c["presentacion"],
            "estado": f["estado"], "confianza": f["confianza"], "fila_excel": f["fila_excel"],
            "descripcion_excel": e["descripcion"] if e else "", "proveedor_excel": e["proveedor"] if e else "",
            "lista1": l1 or "", "lista2": l2 or "", "inventario": e["inventario"] if e else "",
            "alertas": " | ".join(alertas), "nota": f["nota"],
        })
        if f["fila_excel"]:
            for x in f["fila_excel"].split(" "):
                if f["estado"] in ("seguro", "igual", "revisar", "varios"):
                    usadas.add(x)
        if f["estado"] in ("seguro", "igual") and l1:
            mayor = l2 if puede_guardar_mayor(l1, l2) else ""
            importables.append({
                "sku": c["sku"], "producto": c["producto"], "presentacion": c["presentacion"],
                "precio_unidad": l1, "precio_mayor": mayor, "cantidad_min_mayor": "",
                "en_oferta": "", "precio_oferta": "", "disponible": "",
                "_fila_excel": f["fila_excel"],
            })

    campos_rev = list(revision[0].keys())
    with open(CARPETA / "revision_precios.csv", "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=campos_rev)
        w.writeheader()
        w.writerows(revision)
    campos_imp = [k for k in importables[0].keys() if not k.startswith("_")]
    with open(CARPETA / "precios_para_importar.csv", "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=campos_imp)
        w.writeheader()
        w.writerows({k: v for k, v in r.items() if k in campos_imp} for r in importables)

    con_costos = 0
    if ruta_xlsx:
        por_fila = {str(x["_fila"]): costo_y_stock(x) for x in ep.leer_xlsx(Path(ruta_xlsx))}
        with open(CARPETA / "precios_costos_para_importar.csv", "w", newline="", encoding="utf-8-sig") as fh:
            w = csv.DictWriter(fh, fieldnames=campos_imp + ["costo", "stock"])
            w.writeheader()
            for r in importables:
                d = por_fila.get(r["_fila_excel"], {"costo": None, "stock": None})
                fila = {k: v for k, v in r.items() if k in campos_imp}
                fila["costo"] = d["costo"] if d["costo"] is not None else ""
                fila["stock"] = d["stock"] if d["stock"] is not None else ""
                con_costos += 1 if d["costo"] is not None else 0
                w.writerow(fila)
    with open(CARPETA / "excel_no_asignado.csv", "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh)
        w.writerow(["fila_excel", "descripcion", "proveedor", "lista1", "lista2", "inventario"])
        for k, e in excel.items():
            if k not in usadas:
                w.writerow([k, e["descripcion"], e["proveedor"], e["lista1"], e["lista2"], e["inventario"]])

    conteo = defaultdict(int)
    for f in filas:
        conteo[f["estado"]] += 1
    resumen = {"estados": dict(conteo), "importables": len(importables), "excel_no_asignado": len(excel) - len(usadas)}
    if ruta_xlsx:
        resumen["importables_con_costo"] = con_costos
    return resumen


if __name__ == "__main__":
    print(consolidar(sys.argv[1] if len(sys.argv) > 1 else None))
    sys.exit(0)
