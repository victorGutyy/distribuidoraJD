"""
Rescata fotos y precios del catálogo maestro (Excel + Word) y los cruza con lo que ya hay en la base.

Entradas (rutas por argumento):
  --docx     Catalogo_Distribuidora_EV.docx   (cada producto del portafolio con su foto y su página)
  --maestro  Catalogo_Distribuidora_EV_maestro.xlsx (hoja «Catalogo»: referencia, costo, Lista 1/2, cruce)
  --db       data/precios_ev/maestro/db_snapshot.json (copia de solo lectura de la base; ver --ayuda-db)

Salidas (en data/fotos_maestro y data/precios_ev/maestro, ambas ignoradas por git: tienen precios y fotos):
  fotos_maestro/subir_sin_foto/EVC-xxxxx.jpg   fotos para productos que hoy NO tienen ninguna
  fotos_maestro/reemplazar/EVC-xxxxx_2.jpg     fotos del documento para productos cuya foto actual está equivocada
  fotos_maestro/reporte_fotos.csv              qué se hizo con cada producto
  precios_ev/maestro/precios_mayor_para_importar.csv   precio por mayor del maestro que falta en la base
  precios_ev/maestro/mayor_a_confirmar.csv     casos raros (mayor muy bajo, igual o mayor que el detal, ambiguos)

Solo biblioteca estándar + Pillow (para comparar fotos por su «huella» visual).
"""

from __future__ import annotations

import argparse
import collections
import csv
import io
import json
import os
import re
import shutil
import sys
import unicodedata
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import emparejar_precios as ep  # noqa: E402  (lector de xlsx sin dependencias)

RAIZ = Path(__file__).resolve().parent.parent
UMBRAL_FOTO = 20  # distancia de huella (de 256 bits) por debajo de la cual dos fotos son «la misma»


# ----------------------------------------------------------------------------- utilidades puras
def tokens(texto: str | None) -> set[str]:
    s = unicodedata.normalize("NFD", texto or "").lower()
    s = re.sub(r"[̀-ͯ]", "", s)
    return {w for w in re.sub(r"[^a-z0-9 ]", " ", s).split() if len(w) > 1}


def a_entero(valor) -> int | None:
    """'$ 8687.24' → 8687; vacío → None."""
    if valor in (None, ""):
        return None
    try:
        return int(round(float(str(valor).replace("$", "").replace(" ", "").replace(",", "."))))
    except ValueError:
        return None


def huella(imagen, n: int = 16) -> int:
    """dHash de n×n bits: dos fotos iguales (aunque de distinto tamaño) dan huellas casi iguales."""
    g = imagen.convert("L").resize((n + 1, n))
    px = list(g.getdata())
    bits = 0
    for y in range(n):
        for x in range(n):
            bits = (bits << 1) | (1 if px[y * (n + 1) + x] > px[y * (n + 1) + x + 1] else 0)
    return bits


def distancia(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def sku_base(nombre_archivo: str) -> str:
    """'EVC-00018_2.jpg' → 'EVC-00018'."""
    return re.sub(r"_\d+$", "", nombre_archivo.split(".")[0])


def clasificar_mayor(detal: int, mayor: int) -> str:
    """aplicar | confirmar_bajo | confirmar_alto, según el descuento por mayor frente al detal."""
    if not mayor or not detal:
        return "sin_mayor"
    r = mayor / detal
    if r >= 1:
        return "confirmar_alto"
    if r < 0.70:
        return "confirmar_bajo"
    return "aplicar"


# ----------------------------------------------------------------------------- lectura del docx
def leer_docx(ruta: Path):
    """Productos del documento en orden: foto, nombre, detalle y página. Devuelve (productos, zip)."""
    z = zipfile.ZipFile(ruta)
    cuerpo = z.read("word/document.xml").decode("utf-8")
    rels = z.read("word/_rels/document.xml.rels").decode("utf-8")
    destino = {}
    for m in re.finditer(r"<Relationship ([^>]*)/>", rels):
        a = dict(re.findall(r'(\w+)="([^"]*)"', m.group(1)))
        destino[a["Id"]] = a["Target"]
    toks = []
    for t in re.finditer(r"<w:t[^>]*>([^<]*)</w:t>|r:embed=\"([^\"]+)\"", cuerpo):
        toks.append(("T", t.group(1)) if t.group(1) is not None else ("I", destino[t.group(2)]))
    productos, i = [], 0
    while i < len(toks):
        if (
            toks[i][0] == "I"
            and i + 3 < len(toks)
            and all(toks[i + k][0] == "T" for k in (1, 2, 3))
            and toks[i + 3][1].startswith("Pág. PDF")
        ):
            productos.append(
                dict(
                    img=toks[i][1],
                    nombre=toks[i + 1][1],
                    detalle=toks[i + 2][1].strip(),
                    pagina=int(toks[i + 3][1].split()[-1]),
                )
            )
            i += 4
        else:
            i += 1
    return productos, z


# ----------------------------------------------------------------------------- emparejar con la base
def productos_evc(importacion_csv: Path):
    """Productos EVC con su página (de la importación original)."""
    evc = {}
    for r in csv.DictReader(open(importacion_csv, encoding="utf-8-sig")):
        k = r["sku"][:9]
        e = evc.setdefault(
            k, dict(sku=k, nombre=r["producto"], pagina=int(r["pagina_pdf"] or 0), marca=r["marca"], pres=set())
        )
        e["pres"].add(r["presentacion"])
    return evc


def emparejar_docx_con_sku(productos, evc):
    """
    Cada producto del documento → su SKU EVC. Se compara dentro de la MISMA página (nombre, marca y
    presentación) y se asigna uno a uno, de mayor a menor parecido; a igualdad gana el que ocupa la
    misma posición en la página (el documento y la importación siguen el mismo orden).
    """
    por_pagina = collections.defaultdict(list)
    for e in sorted(evc.values(), key=lambda e: e["sku"]):
        por_pagina[e["pagina"]].append(e)
    docx_por_pagina = collections.defaultdict(list)
    for i, p in enumerate(productos):
        docx_por_pagina[p["pagina"]].append(i)

    salida = [None] * len(productos)
    for pagina, indices in docx_por_pagina.items():
        candidatos = por_pagina.get(pagina, [])
        pares = []
        for pos_d, i in enumerate(indices):
            p = productos[i]
            a, d = tokens(p["nombre"]), tokens(p["detalle"])
            for pos_e, e in enumerate(candidatos):
                propios = tokens(e["marca"]).union(*[tokens(x) for x in e["pres"]]) if e["pres"] else tokens(e["marca"])
                puntaje = len(a & tokens(e["nombre"])) / max(1, len(a)) + 0.5 * len(d & propios) / max(1, len(d))
                cercania = abs(pos_d / max(1, len(indices)) - pos_e / max(1, len(candidatos)))
                if puntaje >= 0.6:
                    pares.append((puntaje - 0.2 * cercania, i, e["sku"]))
        pares.sort(reverse=True)
        libres_d, usados_e = set(indices), set()
        for _puntaje, i, sku in pares:
            if i in libres_d and sku not in usados_e:
                salida[i] = sku
                libres_d.discard(i)
                usados_e.add(sku)
    return salida


# ----------------------------------------------------------------------------- principal
def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--docx", required=True, type=Path)
    ap.add_argument("--maestro", required=True, type=Path)
    ap.add_argument("--db", type=Path, default=RAIZ / "data/precios_ev/maestro/db_snapshot.json")
    args = ap.parse_args()

    from PIL import Image  # noqa: PLC0415

    db = json.load(open(args.db, encoding="utf-8"))
    productos_bd = {p["id"]: p for p in db["prods"]}
    con_foto = {i["producto_id"] for i in db["imgs"]}
    costo = {c["variante_id"]: c for c in db["costos"]}
    evc2pid = collections.defaultdict(set)
    for v in db["vars"]:
        m = re.match(r"(EVC-\d{5})-", v["sku"])
        if m:
            evc2pid[m.group(1)].add(v["producto_id"])

    docx, z = leer_docx(args.docx)
    evc = productos_evc(RAIZ / "data/importacion_ev.csv")
    sku_de = emparejar_docx_con_sku(docx, evc)
    repetidos = {s for s, n in collections.Counter(x for x in sku_de if x).items() if n > 1}

    # huellas de las fotos extraídas (alta resolución) y de las del documento
    extraidas = {}
    for carpeta in ("imagenes_pdf", "imagenes_pdf_revisar"):
        for f in (RAIZ / "data" / carpeta).glob("*.jpg"):
            extraidas[f.stem] = (huella(Image.open(f)), f)
    h_doc = [huella(Image.open(io.BytesIO(z.read("word/" + p["img"])))) for p in docx]

    sal = RAIZ / "data/fotos_maestro"
    for sub in ("subir_sin_foto", "reemplazar"):
        shutil.rmtree(sal / sub, ignore_errors=True)
        (sal / sub).mkdir(parents=True, exist_ok=True)

    reporte = []
    for i, p in enumerate(docx):
        X = sku_de[i]
        if not X:
            reporte.append((i, p["pagina"], p["nombre"], "", "sin producto por nombre", ""))
            continue
        if X in repetidos:
            reporte.append((i, p["pagina"], p["nombre"], X, "ambiguo (varios del documento caen en el mismo producto)", ""))
            continue
        pids = evc2pid.get(X, set())
        tiene = any(x in con_foto for x in pids)
        propias = [(distancia(h_doc[i], h), n) for n, (h, _f) in extraidas.items() if sku_base(n) == X]
        mejor_propia = min(propias) if propias else (999, None)
        global_ = min((distancia(h_doc[i], h), n) for n, (h, _f) in extraidas.items())
        # Los productos hoy ocultos (activo = no) se reactivan con reactivar_productos_para_importar.csv:
        # también necesitan su foto, así que no se descartan.
        if mejor_propia[0] < UMBRAL_FOTO:
            if tiene:
                reporte.append((i, p["pagina"], p["nombre"], X, "ya correcta", ""))
            else:
                destino = sal / "subir_sin_foto" / f"{X}.jpg"
                shutil.copy(extraidas[mejor_propia[1]][1], destino)
                reporte.append((i, p["pagina"], p["nombre"], X, "SUBIR: foto propia en revisión confirmada por el documento", destino.name))
        elif global_[0] < UMBRAL_FOTO:
            if tiene:
                reporte.append((i, p["pagina"], p["nombre"], X, f"revisar: el documento usa la foto de {sku_base(global_[1])}", ""))
            else:
                destino = sal / "subir_sin_foto" / f"{X}.jpg"
                shutil.copy(extraidas[global_[1]][1], destino)
                reporte.append((i, p["pagina"], p["nombre"], X, f"SUBIR: foto compartida con {sku_base(global_[1])}", destino.name))
        else:
            datos = z.read("word/" + p["img"])
            if tiene:
                destino = sal / "reemplazar" / f"{X}_2.jpg"
                destino.write_bytes(datos)
                reporte.append((i, p["pagina"], p["nombre"], X, "REEMPLAZAR: la foto actual no corresponde al documento", destino.name))
            else:
                destino = sal / "subir_sin_foto" / f"{X}.jpg"
                destino.write_bytes(datos)
                reporte.append((i, p["pagina"], p["nombre"], X, "SUBIR: foto nueva del documento", destino.name))

    with open(sal / "reporte_fotos.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["n", "pagina", "producto_documento", "sku", "decision", "archivo"])
        w.writerows(reporte)

    # ------------------------------------------------------------------ precios por mayor
    filas = ep.leer_xlsx(args.maestro, "Catalogo")
    por_precio_costo = collections.defaultdict(list)
    for v in db["vars"]:
        por_precio_costo[(v["precio_unidad"], costo.get(v["id"], {}).get("costo"))].append(v)
    nombre_prod = {v["id"]: productos_bd[v["producto_id"]]["nombre"] for v in db["vars"]}

    aplicar, confirmar = [], []
    for r in filas:
        detal = a_entero(r.get("Precio detal (Lista 1)"))
        if not detal:
            continue
        c = a_entero(r.get("Costo"))
        mayor = a_entero(r.get("Precio mayor (Lista 2)")) or 0
        vs = por_precio_costo.get((detal, c), [])
        if not vs or any((v["precio_mayor"] or 0) == mayor for v in vs):
            continue
        if not mayor:
            continue  # el maestro no trae mayor: no hay nada que aplicar
        ref = r["Referencia (lista de precios)"]
        tipo = clasificar_mayor(detal, mayor)
        if len(vs) > 1:
            confirmar.append((ref, detal, mayor, "ambigua: varias presentaciones con el mismo precio y costo", ", ".join(v["sku"] for v in vs[:4])))
        elif tipo == "aplicar":
            v = vs[0]
            aplicar.append(
                dict(
                    sku=v["sku"], producto=nombre_prod[v["id"]], presentacion=v["nombre_presentacion"] or "",
                    precio_unidad=detal, precio_mayor=mayor, cantidad_min_mayor="", en_oferta="", precio_oferta="",
                    disponible="", costo="", stock="",
                )
            )
        else:
            confirmar.append((ref, detal, mayor, "mayor muy bajo (<70 %)" if tipo == "confirmar_bajo" else "mayor igual o superior al detal", vs[0]["sku"]))

    sal_p = RAIZ / "data/precios_ev/maestro"
    with open(sal_p / "precios_mayor_para_importar.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(aplicar[0].keys()))
        w.writeheader()
        w.writerows(aplicar)
    with open(sal_p / "mayor_a_confirmar.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["referencia", "precio_detal", "precio_mayor_maestro", "motivo", "sku_candidato"])
        w.writerows(confirmar)

    resumen = collections.Counter(d.split(":")[0].split(" (")[0] for *_x, d, _a in reporte)
    print("Fotos:", dict(resumen))
    print("Archivos a subir:", len(list((sal / "subir_sin_foto").glob("*.jpg"))), "| a reemplazar:", len(list((sal / "reemplazar").glob("*.jpg"))))
    print("Precios por mayor a importar:", len(aplicar), "| a confirmar:", len(confirmar))


if __name__ == "__main__":
    main()
