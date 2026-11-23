"""
Asigna las filas del Excel que NO tienen producto en el catálogo: o son una
presentación nueva de un producto que ya existe, o son un producto nuevo.

Dos pasos (desde la raíz del proyecto, en Git Bash):

  1) python scripts/asignar_excel.py preparar
       Separa las filas del Excel por asignar y las reparte en lotes con pistas
       (productos del catálogo parecidos). Crea en data/precios_ev/:
         asignar_lote_N.csv       filas del Excel de cada lote (una persona o agente las revisa)
         productos_existentes.csv catálogo actual agrupado por producto (para consultar)

  1b) python scripts/asignar_excel.py validar N
       Comprueba asignacion_lote_N.csv (columnas, categorías, unidades, filas completas).

  2) python scripts/asignar_excel.py armar "C:/ruta/listado de precio actualizadoEV.xlsx"
       Valida lo revisado (asignacion_lote_N.csv) y arma los archivos de importación:
         catalogo_nuevo_para_importar.csv        modo «Catálogo completo» del importador
         precios_costos_nuevo_para_importar.csv  modo «Solo precios» (con costo y existencias)
         revision_nuevos.csv                     lista legible para revisar antes de importar
       Los SKU nuevos (EVP-…) quedan guardados en sku_asignados_excel.csv y no cambian al repetir.

El precio, costo y existencias NUNCA se teclean: salen del Excel por el número de fila,
así que nadie puede equivocarse al copiarlos. Solo biblioteca estándar. Todo va a
data/precios_ev/ (ignorada por git: trae precios internos).
"""

from __future__ import annotations

import csv
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import emparejar_precios as ep  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
CARPETA = RAIZ / "data" / "precios_ev"
CATALOGO = RAIZ / "data" / "importacion_ev.csv"

ESTADOS_FIRMES = {"seguro", "igual", "revisar"}  # su fila de Excel ya tiene dueño (o lo espera)
N_LOTES = 10
N_SIMILARES = 4

# Lo que acepta el importador (src/lib/catalogo/producto-form.ts).
UNIDADES_CONTENIDO = ["g", "kg", "mg", "lb", "oz", "ml", "cc", "L", "und", "tabletas", "cápsulas", "sobres", "cm", "m"]
UNIDADES_VENTA = ["individual", "paquete", "display", "caja", "bolsa"]
ACCIONES = ["variante", "nuevo", "omitir"]
CAMPOS_ASIGNACION = [
    "fila_excel", "accion", "sku_existente", "producto", "categoria", "subcategoria", "marca",
    "presentacion", "contenido_valor", "contenido_unidad", "unidad_venta", "unidades_por_empaque", "nota",
]
MAX_NOMBRE = 80


def leer_csv(ruta: Path) -> list[dict]:
    with open(ruta, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def clave_orden(fila: dict) -> tuple:
    """Agrupa las filas parecidas: por proveedor y luego por nombre sin cifras ni signos."""
    palabras = [t for t in ep.normalizar(fila["descripcion"]).split() if not ep.tiene_digito(t)]
    return (fila["proveedor"], " ".join(palabras[:3]), ep.normalizar(fila["descripcion"]))


def armar_pool(revision: list[dict], excel: list[dict]) -> tuple[list[dict], dict[str, list[str]]]:
    """
    Filas del Excel por asignar = todas menos las que ya tienen dueño (seguro, igual, revisar).
    Devuelve (filas, pistas) donde pistas[fila_excel] = SKU de los productos genéricos
    («varios») que el primer revisor relacionó con esa fila.
    """
    con_dueno: set[str] = set()
    pistas: dict[str, list[str]] = defaultdict(list)
    for r in revision:
        filas = r["fila_excel"].split()
        if r["estado"] in ESTADOS_FIRMES:
            con_dueno.update(filas)
        elif r["estado"] == "varios":
            for x in filas:
                pistas[x].append(r["sku"])
    pool = [e for e in excel if e["fila_excel"] not in con_dueno]
    pool.sort(key=clave_orden)
    return pool, {k: v for k, v in pistas.items() if k not in con_dueno}


def repartir(filas: list, n: int) -> list[list]:
    """Reparte en n lotes contiguos de tamaño casi igual (las filas parecidas quedan juntas)."""
    tam, resto = divmod(len(filas), n)
    lotes, inicio = [], 0
    for i in range(n):
        fin = inicio + tam + (1 if i < resto else 0)
        lotes.append(filas[inicio:fin])
        inicio = fin
    return lotes


def productos_existentes(catalogo: list[dict]) -> list[dict]:
    """El catálogo agrupado por producto: SKU de referencia, identidad y presentaciones."""
    grupos: dict[tuple, dict] = {}
    for c in catalogo:
        k = (c["producto"], c["categoria"], c["subcategoria"], c["marca"])
        g = grupos.setdefault(k, {
            "sku_ref": c["sku"], "producto": c["producto"], "marca": c["marca"],
            "categoria": c["categoria"], "subcategoria": c["subcategoria"], "presentaciones": [],
        })
        g["presentaciones"].append(c["presentacion"] or "(sin presentación)")
    return [{**g, "presentaciones": " | ".join(g["presentaciones"])} for g in grupos.values()]


def similares(fila: dict, productos: list[dict], items: list[ep.Item], idx: dict[str, set[int]]) -> str:
    """Los productos del catálogo que más se parecen a una fila del Excel (pista, no decisión)."""
    e = ep.Item(fila["descripcion"], fila["proveedor"])
    puntajes = []
    for j in ep.candidatos_de(e, idx):
        s = ep.comparar(items[j], e)["puntaje"]
        if s > 0:
            puntajes.append((s, j))
    puntajes.sort(reverse=True)
    partes = []
    for s, j in puntajes[:N_SIMILARES]:
        p = productos[j]
        marca = f" [{p['marca']}]" if p["marca"] else ""
        partes.append(f"{p['sku_ref']} {p['producto']}{marca} ({p['presentaciones'][:40]})")
    return " ;; ".join(partes)


def numero_o_none(texto: str) -> float | None:
    """'250', '0,5' o '0.5' → número; vacío o inválido → None."""
    t = (texto or "").strip().replace(",", ".")
    try:
        return float(t) if t else None
    except ValueError:
        return None


def validar_asignacion(
    filas: list[dict],
    esperadas: set[str],
    categorias_validas: set[tuple[str, str]],
    skus_existentes: set[str],
) -> list[str]:
    """Errores de un archivo asignacion_lote_N.csv (vacío = todo bien). PURA, con pruebas."""
    errores: list[str] = []
    vistas: set[str] = set()
    for i, f in enumerate(filas, start=2):
        ref = f"línea {i} (fila Excel {f.get('fila_excel', '?')})"
        fe = (f.get("fila_excel") or "").strip()
        if fe in vistas:
            errores.append(f"{ref}: la fila del Excel está repetida")
        vistas.add(fe)
        if fe not in esperadas:
            errores.append(f"{ref}: esa fila no pertenece a este lote")
        accion = (f.get("accion") or "").strip()
        if accion not in ACCIONES:
            errores.append(f"{ref}: accion debe ser una de {ACCIONES}")
            continue
        if accion == "omitir":
            if not (f.get("nota") or "").strip():
                errores.append(f"{ref}: omitir necesita una nota con el motivo")
            continue
        if accion == "variante":
            sku = (f.get("sku_existente") or "").strip()
            if sku not in skus_existentes:
                errores.append(f"{ref}: sku_existente '{sku}' no es un sku_ref de productos_existentes.csv")
            for c in ("producto", "categoria", "subcategoria", "marca"):
                if (f.get(c) or "").strip():
                    errores.append(f"{ref}: en una variante deja vacío '{c}' (se copia del producto existente)")
        else:  # nuevo
            nombre = (f.get("producto") or "").strip()
            if not nombre:
                errores.append(f"{ref}: falta el nombre del producto")
            elif len(nombre) > MAX_NOMBRE:
                errores.append(f"{ref}: el nombre pasa de {MAX_NOMBRE} caracteres")
            elif nombre.isupper() and len(nombre) > 4:
                errores.append(f"{ref}: el nombre está TODO EN MAYÚSCULAS; escríbelo normal (Ej.: «Esmalte Bardot»)")
            par = ((f.get("categoria") or "").strip(), (f.get("subcategoria") or "").strip())
            if par not in categorias_validas:
                errores.append(f"{ref}: categoría/subcategoría '{par[0]} > {par[1]}' no está en categorias_validas.csv")
            if (f.get("sku_existente") or "").strip():
                errores.append(f"{ref}: un producto nuevo no lleva sku_existente")
        # Presentación (variante o nuevo)
        unidad = (f.get("contenido_unidad") or "").strip()
        valor = (f.get("contenido_valor") or "").strip()
        if unidad and unidad not in UNIDADES_CONTENIDO:
            errores.append(f"{ref}: contenido_unidad '{unidad}' no es válida {UNIDADES_CONTENIDO}")
        if bool(unidad) != bool(valor):
            errores.append(f"{ref}: contenido_valor y contenido_unidad van juntos (o los dos vacíos)")
        if valor and (numero_o_none(valor) is None or (numero_o_none(valor) or 0) <= 0):
            errores.append(f"{ref}: contenido_valor '{valor}' debe ser un número mayor que 0")
        venta = (f.get("unidad_venta") or "").strip() or "individual"
        if venta not in UNIDADES_VENTA:
            errores.append(f"{ref}: unidad_venta '{venta}' no es válida {UNIDADES_VENTA}")
        paq = (f.get("unidades_por_empaque") or "").strip() or "1"
        if not paq.isdigit() or int(paq) < 1 or int(paq) > 10000:
            errores.append(f"{ref}: unidades_por_empaque '{paq}' debe ser un entero de 1 en adelante")
        elif venta == "individual" and int(paq) > 1:
            errores.append(f"{ref}: si trae {paq} unidades, unidad_venta debe ser paquete, caja, display o bolsa")
        if len((f.get("presentacion") or "").strip()) > 60:
            errores.append(f"{ref}: presentacion pasa de 60 caracteres")
    for faltante in sorted(esperadas - vistas, key=lambda x: int(x) if x.isdigit() else 0):
        errores.append(f"falta la fila del Excel {faltante}")
    return errores


def validar(n: int) -> int:
    ruta = CARPETA / f"asignacion_lote_{n}.csv"
    if not ruta.exists():
        print(f"No existe {ruta}")
        return 1
    esperadas = {r["fila_excel"] for r in leer_csv(CARPETA / f"asignar_lote_{n}.csv")}
    categorias = {(r["categoria"], r["subcategoria"]) for r in leer_csv(CARPETA / "categorias_validas.csv")}
    skus = {r["sku_ref"] for r in leer_csv(CARPETA / "productos_existentes.csv")}
    with open(ruta, encoding="utf-8-sig", newline="") as f:
        lector = csv.DictReader(f)
        if lector.fieldnames != CAMPOS_ASIGNACION:
            print("Las columnas deben ser exactamente:", ",".join(CAMPOS_ASIGNACION))
            return 1
        filas = list(lector)
    errores = validar_asignacion(filas, esperadas, categorias, skus)
    for e in errores[:60]:
        print("ERROR:", e)
    resumen = {a: sum(1 for f in filas if f["accion"] == a) for a in ACCIONES}
    print(f"{len(filas)} filas ({resumen}); {len(errores)} errores")
    return 1 if errores else 0


def preparar() -> dict:
    revision = leer_csv(CARPETA / "revision_precios.csv")
    excel = leer_csv(CARPETA / "excel_sin_costo.csv")
    catalogo = leer_csv(CATALOGO)
    nombre_de = {r["sku"]: r["producto"] for r in catalogo}

    pool, pistas = armar_pool(revision, excel)
    productos = productos_existentes(catalogo)
    items = [ep.Item(" ".join([p["producto"], p["marca"]]), p["marca"]) for p in productos]
    idx = ep.indice_inverso(items)

    pares = sorted({(c["categoria"], c["subcategoria"]) for c in catalogo if c["subcategoria"]})
    with open(CARPETA / "categorias_validas.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["categoria", "subcategoria"])
        w.writerows(pares)
    marcas = sorted({c["marca"] for c in catalogo if c["marca"]})
    with open(CARPETA / "marcas_existentes.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["marca"])
        w.writerows([m] for m in marcas)

    with open(CARPETA / "productos_existentes.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["sku_ref", "producto", "marca", "categoria", "subcategoria", "presentaciones"])
        w.writeheader()
        w.writerows(productos)

    for viejo in CARPETA.glob("asignar_lote_*.csv"):
        viejo.unlink()
    for n, lote in enumerate(repartir(pool, N_LOTES), start=1):
        with open(CARPETA / f"asignar_lote_{n}.csv", "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(["fila_excel", "descripcion", "proveedor", "lista1", "pista_producto_generico", "productos_parecidos"])
            for e in lote:
                pista = " ;; ".join(f"{s} {nombre_de.get(s, '')}" for s in pistas.get(e["fila_excel"], []))
                w.writerow([e["fila_excel"], e["descripcion"], e["proveedor"], e["lista1"], pista, similares(e, productos, items, idx)])
    return {"filas_por_asignar": len(pool), "con_pista_de_generico": sum(1 for e in pool if e["fila_excel"] in pistas), "lotes": N_LOTES}


# ---------------------------------------------------------------- armar los archivos de importación

import consolidar_precios as cp  # noqa: E402  (regla del precio por mayor y lectura de costo/existencias)

PREFIJO_SKU_NUEVO = "EVP"  # P = lista de Precios del proveedor (EVC = catálogo del PDF, EV = creados en el panel)
CAMPOS_CATALOGO = [
    "sku", "producto", "categoria", "subcategoria", "marca", "descripcion", "etiquetas", "presentacion",
    "contenido_valor", "contenido_unidad", "unidad_venta", "unidades_por_empaque", "precio_unidad",
    "precio_mayor", "cantidad_min_mayor", "en_oferta", "precio_oferta", "disponible", "activo", "pagina_pdf",
]


def clave_producto(producto: str, categoria: str, subcategoria: str, marca: str) -> str:
    """Igual que el importador: el mismo texto sin tildes ni mayúsculas es el mismo producto."""
    return "|".join(ep.normalizar(x) for x in (producto, categoria, subcategoria, marca))


def sufijo_de(sku: str) -> int:
    """'EVC-00072-03' → 3 (0 si no tiene sufijo numérico)."""
    pieza = sku.rsplit("-", 1)[-1]
    return int(pieza) if pieza.isdigit() else 0


def base_de(sku: str) -> str:
    """'EVC-00072-03' → 'EVC-00072'."""
    return sku.rsplit("-", 1)[0]


def nombre_normalizado(nombre: str) -> str:
    """Nombre sin tildes, mayúsculas, plurales ni palabras vacías: sirve para comparar productos."""
    return " ".join(ep.tokens(nombre))


def convertir_duplicados_exactos(asignaciones: list[dict], productos: dict[str, dict]) -> tuple[list[dict], list[str]]:
    """
    Un producto «nuevo» con el MISMO nombre y subcategoría que uno existente es en realidad una
    presentación de ese producto (el importador no los fusiona: crearía dos fichas iguales).
    Se convierte en «variante»; la marca, si la trae, pasa al nombre de la presentación para no perderla.
    PURA, con pruebas. Devuelve (asignaciones nuevas, avisos).
    """
    indice: dict[tuple[str, str], list[str]] = defaultdict(list)
    for ref, p in productos.items():
        indice[(nombre_normalizado(p["producto"]), ep.normalizar(p["subcategoria"]))].append(ref)
    resultado, avisos = [], []
    for a in asignaciones:
        if a["accion"] == "nuevo":
            candidatos = indice.get((nombre_normalizado(a["producto"]), ep.normalizar(a["subcategoria"])), [])
            if len(candidatos) == 1:
                marca = a["marca"].strip()
                pres = a["presentacion"].strip()
                if marca and marca.lower() not in pres.lower():
                    pres = f"{marca} · {pres}" if pres else marca
                nota = (a["nota"] + " " if a["nota"] else "") + "[convertida a presentación: el producto ya existía]"
                a = {**a, "accion": "variante", "sku_existente": candidatos[0], "producto": "", "categoria": "",
                     "subcategoria": "", "marca": "", "presentacion": pres[:60], "nota": nota}
                avisos.append(f"fila {a['fila_excel']}: ya existía «{productos[candidatos[0]]['producto']}» ({candidatos[0]})")
        resultado.append(a)
    return resultado, avisos


def posibles_duplicados(asignaciones: list[dict], productos: dict[str, dict]) -> list[dict]:
    """Productos nuevos cuyo nombre contiene al de uno existente (o al revés) en la misma subcategoría."""
    existentes = [(set(nombre_normalizado(p["producto"]).split()), ref, p) for ref, p in productos.items()]
    vistos: set[tuple] = set()
    filas = []
    for a in asignaciones:
        if a["accion"] != "nuevo":
            continue
        clave = (a["producto"], a["categoria"], a["subcategoria"], a["marca"])
        if clave in vistos:
            continue
        vistos.add(clave)
        ts = set(nombre_normalizado(a["producto"]).split())
        for te, ref, p in existentes:
            if ts and te and min(len(ts), len(te)) >= 2 and (ts <= te or te <= ts) and p["subcategoria"] == a["subcategoria"]:
                filas.append({"fila_excel": a["fila_excel"], "producto_nuevo": a["producto"], "marca_nueva": a["marca"],
                              "sku_existente": ref, "producto_existente": p["producto"], "subcategoria": a["subcategoria"]})
                break
    return filas


def armar_filas(
    asignaciones: list[dict],
    excel: dict[str, dict],
    costos: dict[str, dict],
    productos: dict[str, dict],
    skus_por_producto: dict[str, list[str]],
    genericos: set[str],
    previos: dict[str, dict],
) -> dict:
    """
    Convierte las decisiones en filas listas para importar. PURA, con pruebas.

    asignaciones : filas de asignacion_lote_N.csv (todas las del conjunto)
    excel        : fila_excel → {descripcion, proveedor, lista1, lista2, inventario}
    costos       : fila_excel → {costo, stock}
    productos    : sku_ref → identidad {producto, categoria, subcategoria, marca}
    skus_por_producto : sku_ref → todos los SKU actuales de ese producto
    genericos    : SKU de variantes «varios» sin precio (se desactivan si reciben presentaciones)
    previos      : fila_excel → {sku, clave} de corridas anteriores (los SKU no cambian al repetir)
    """
    catalogo: list[dict] = []
    precios: list[dict] = []
    revision: list[dict] = []
    nuevos_previos = {v["sku"] for v in previos.values()}
    num_producto: dict[str, int] = {}
    siguiente = 0
    for v in previos.values():
        if v["clave"] and v["sku"].startswith(PREFIJO_SKU_NUEVO + "-"):
            num_producto.setdefault(v["clave"], int(v["sku"].split("-")[1]))
            siguiente = max(siguiente, int(v["sku"].split("-")[1]))
    pres_en_producto: dict[str, int] = defaultdict(int)
    for v in previos.values():
        if v["clave"] and v["sku"].startswith(PREFIJO_SKU_NUEVO + "-"):
            pres_en_producto[v["clave"]] = max(pres_en_producto[v["clave"]], sufijo_de(v["sku"]))
    ultimo_sufijo: dict[str, int] = {}  # base del producto existente → último sufijo usado
    anclas: dict[str, dict] = {}
    nuevas_en_existente: dict[str, int] = defaultdict(int)
    asignados: dict[str, dict] = {}

    for a in sorted(asignaciones, key=lambda r: int(r["fila_excel"])):
        fe = a["fila_excel"]
        x = excel[fe]
        l1 = cp.entero(x["lista1"])
        l2 = cp.entero(x["lista2"])
        accion = a["accion"]
        if accion == "omitir":
            revision.append({"fila_excel": fe, "accion": "omitir", "producto": "", "presentacion": "",
                             "sku": "", "descripcion_excel": x["descripcion"], "lista1": l1 or "", "nota": a["nota"]})
            continue
        if not l1:
            revision.append({"fila_excel": fe, "accion": "SIN PRECIO", "producto": a.get("producto", ""), "presentacion": a.get("presentacion", ""),
                             "sku": "", "descripcion_excel": x["descripcion"], "lista1": "", "nota": "el Excel no trae Lista 1: no se importa"})
            continue
        if accion == "variante":
            ref = a["sku_existente"]
            ident = productos[ref]
            base = base_de(ref)
            # Un SKU EVP- de una corrida anterior (cuando era «nuevo») no sirve para una variante: se rehace.
            if fe in previos and not previos[fe]["sku"].startswith(PREFIJO_SKU_NUEVO + "-"):
                sku = previos[fe]["sku"]
            else:
                if base not in ultimo_sufijo:
                    ultimo_sufijo[base] = max((sufijo_de(s) for s in skus_por_producto.get(ref, [ref])), default=0)
                    ultimo_sufijo[base] = max(ultimo_sufijo[base], max((sufijo_de(s) for s in nuevos_previos if base_de(s) == base), default=0))
                ultimo_sufijo[base] += 1
                sku = f"{base}-{ultimo_sufijo[base]:02d}"
            clave = clave_producto(**{k: ident[k] for k in ("producto", "categoria", "subcategoria", "marca")})
            nuevas_en_existente[ref] += 1
            anclas[ref] = ident
        else:
            ident = {k: a[k].strip() for k in ("producto", "categoria", "subcategoria", "marca")}
            clave = clave_producto(**ident)
            if fe in previos:
                sku = previos[fe]["sku"]
            else:
                if clave not in num_producto:
                    siguiente += 1
                    num_producto[clave] = siguiente
                pres_en_producto[clave] += 1
                sku = f"{PREFIJO_SKU_NUEVO}-{num_producto[clave]:05d}-{pres_en_producto[clave]:02d}"
        mayor = l2 if cp.puede_guardar_mayor(l1, l2) else ""
        fila = {
            "sku": sku, "producto": ident["producto"], "categoria": ident["categoria"],
            "subcategoria": ident["subcategoria"], "marca": ident["marca"], "descripcion": "", "etiquetas": "",
            "presentacion": a["presentacion"].strip(), "contenido_valor": a["contenido_valor"].strip().replace(",", "."),
            "contenido_unidad": a["contenido_unidad"].strip(), "unidad_venta": (a["unidad_venta"].strip() or "individual"),
            "unidades_por_empaque": (a["unidades_por_empaque"].strip() or "1"), "precio_unidad": l1,
            "precio_mayor": mayor, "cantidad_min_mayor": "", "en_oferta": "", "precio_oferta": "",
            "disponible": "", "activo": "", "pagina_pdf": "",
        }
        catalogo.append(fila)
        c = costos.get(fe, {"costo": None, "stock": None})
        precios.append({
            "sku": sku, "producto": ident["producto"], "presentacion": fila["presentacion"],
            "precio_unidad": l1, "precio_mayor": mayor, "cantidad_min_mayor": "", "en_oferta": "",
            "precio_oferta": "", "disponible": "",
            "costo": c["costo"] if c["costo"] is not None else "", "stock": c["stock"] if c["stock"] is not None else "",
        })
        revision.append({"fila_excel": fe, "accion": accion, "producto": ident["producto"], "presentacion": fila["presentacion"],
                         "sku": sku, "descripcion_excel": x["descripcion"], "lista1": l1, "nota": a["nota"]})
        asignados[fe] = {"sku": sku, "clave": clave}

    # Productos existentes que reciben presentaciones: una fila «ancla» con un SKU que ya existe
    # (así el importador encuentra el producto y NO crea uno duplicado). Si el ancla es una variante
    # genérica sin precio, se desactiva: ya la reemplazan las presentaciones nuevas.
    filas_ancla = []
    for ref, ident in anclas.items():
        existentes = skus_por_producto.get(ref, [ref])
        for sku in existentes:
            if sku in genericos and nuevas_en_existente[ref] > 0:
                filas_ancla.append({**{k: "" for k in CAMPOS_CATALOGO}, "sku": sku, **{k: ident[k] for k in ("producto", "categoria", "subcategoria", "marca")}, "activo": "no"})
        if not any(f["sku"] in existentes for f in filas_ancla):
            filas_ancla.append({**{k: "" for k in CAMPOS_CATALOGO}, "sku": ref, **{k: ident[k] for k in ("producto", "categoria", "subcategoria", "marca")}})
    return {"catalogo": filas_ancla + catalogo, "precios": precios, "revision": revision, "asignados": asignados,
            "desactivadas": [f["sku"] for f in filas_ancla if f["activo"] == "no"]}


def con_duda(asignacion: dict) -> bool:
    """Una fila con «REVISAR» en la nota espera una decisión humana antes de publicarse."""
    return "REVISAR" in (asignacion.get("nota") or "")


def anclas_de_confiables(filas_dudosas: list[dict], filas_confiables: list[dict]) -> list[dict]:
    """
    Las presentaciones dudosas de un producto NUEVO cuyo resto sí es confiable necesitan un SKU ya
    importado como ancla: así el importador reconoce el producto y no crea uno duplicado. PURA.
    """
    primer_sku: dict[tuple, str] = {}
    for f in filas_confiables:
        if f["precio_unidad"] != "" and f["sku"].startswith(PREFIJO_SKU_NUEVO + "-"):
            primer_sku.setdefault((f["producto"], f["categoria"], f["subcategoria"], f["marca"]), f["sku"])
    anclas, vistas = [], set()
    for f in filas_dudosas:
        clave = (f["producto"], f["categoria"], f["subcategoria"], f["marca"])
        if f["precio_unidad"] != "" and clave in primer_sku and clave not in vistas:
            vistas.add(clave)
            anclas.append({**{k: "" for k in CAMPOS_CATALOGO}, "sku": primer_sku[clave],
                           "producto": clave[0], "categoria": clave[1], "subcategoria": clave[2], "marca": clave[3]})
    return anclas


def escribir_csv(ruta: Path, campos: list[str], filas: list[dict]) -> None:
    with open(ruta, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=campos, extrasaction="ignore")
        w.writeheader()
        w.writerows(filas)


def armar(ruta_xlsx: str) -> int:
    asignaciones: list[dict] = []
    for n in range(1, N_LOTES + 1):
        ruta = CARPETA / f"asignacion_lote_{n}.csv"
        if not ruta.exists():
            print(f"Falta {ruta.name}: se arma solo con los lotes que existen.")
            continue
        errores = validar_lote_silencioso(n)
        if errores:
            print(f"El lote {n} tiene {len(errores)} errores; corrígelo antes (validar {n}).")
            return 1
        asignaciones += leer_csv(ruta)
    if not asignaciones:
        print("No hay asignaciones.")
        return 1

    excel = {r["fila_excel"]: r for r in leer_csv(CARPETA / "excel_sin_costo.csv")}
    costos = {str(x["_fila"]): cp.costo_y_stock(x) for x in ep.leer_xlsx(Path(ruta_xlsx))}
    productos = {r["sku_ref"]: r for r in leer_csv(CARPETA / "productos_existentes.csv")}
    catalogo_csv = leer_csv(CATALOGO)
    por_identidad: dict[tuple, list[str]] = defaultdict(list)
    for c in catalogo_csv:
        por_identidad[(c["producto"], c["categoria"], c["subcategoria"], c["marca"])].append(c["sku"])
    skus_por_producto = {
        r["sku_ref"]: por_identidad[(r["producto"], r["categoria"], r["subcategoria"], r["marca"])] for r in productos.values()
    }
    genericos = {r["sku"] for r in leer_csv(CARPETA / "revision_precios.csv") if r["estado"] == "varios"}
    ruta_prev = CARPETA / "sku_asignados_excel.csv"
    previos = {r["fila_excel"]: r for r in leer_csv(ruta_prev)} if ruta_prev.exists() else {}

    asignaciones, avisos = convertir_duplicados_exactos(asignaciones, productos)
    for aviso in avisos:
        print("Convertida a presentación:", aviso)
    escribir_csv(CARPETA / "posibles_duplicados.csv",
                 ["fila_excel", "producto_nuevo", "marca_nueva", "sku_existente", "producto_existente", "subcategoria"],
                 posibles_duplicados(asignaciones, productos))

    # 1) Se asignan los SKU a TODAS las filas (así no cambian entre corridas).
    r = armar_filas(asignaciones, excel, costos, productos, skus_por_producto, genericos, previos)
    todos = {**previos, **{k: {"fila_excel": k, **v} for k, v in r["asignados"].items()}}
    escribir_csv(ruta_prev, ["fila_excel", "sku", "clave"], list(todos.values()))

    # 2) Se separan lo confiable (se importa ya) y lo que lleva «REVISAR» (se revisa antes de publicar).
    campos_precios = ["sku", "producto", "presentacion", "precio_unidad", "precio_mayor", "cantidad_min_mayor", "en_oferta",
                      "precio_oferta", "disponible", "costo", "stock"]
    campos_rev = ["lote", "fila_excel", "accion", "producto", "presentacion", "sku", "descripcion_excel", "lista1", "nota"]
    conjuntos = {
        "confiable": [a for a in asignaciones if not con_duda(a)],
        "dudoso": [a for a in asignaciones if con_duda(a)],
    }
    resultados = {k: armar_filas(v, excel, costos, productos, skus_por_producto, genericos, todos) for k, v in conjuntos.items()}
    # Las dudosas de productos nuevos con resto confiable llevan un ancla ya importada (sin duplicar el producto).
    resultados["dudoso"]["catalogo"] = (
        anclas_de_confiables(resultados["dudoso"]["catalogo"], resultados["confiable"]["catalogo"])
        + resultados["dudoso"]["catalogo"]
    )
    nombres = {"confiable": "", "dudoso": "_dudoso"}
    revision_total = []
    for k, res in resultados.items():
        escribir_csv(CARPETA / f"catalogo_nuevo{nombres[k]}_para_importar.csv", CAMPOS_CATALOGO, res["catalogo"])
        escribir_csv(CARPETA / f"precios_costos_nuevo{nombres[k]}_para_importar.csv", campos_precios, res["precios"])
        revision_total += [{"lote": k, **x} for x in res["revision"]]
    escribir_csv(CARPETA / "revision_nuevos.csv", campos_rev, revision_total)
    resumen = {}
    for k, res in resultados.items():
        acciones = defaultdict(int)
        for x in res["revision"]:
            acciones[x["accion"]] += 1
        resumen[k] = {"filas_catalogo": len(res["catalogo"]), "precios": len(res["precios"]), "acciones": dict(acciones),
                      "variantes_genericas_desactivadas": len(res["desactivadas"])}
    print(resumen)
    return 0


def validar_lote_silencioso(n: int) -> list[str]:
    esperadas = {r["fila_excel"] for r in leer_csv(CARPETA / f"asignar_lote_{n}.csv")}
    categorias = {(r["categoria"], r["subcategoria"]) for r in leer_csv(CARPETA / "categorias_validas.csv")}
    skus = {r["sku_ref"] for r in leer_csv(CARPETA / "productos_existentes.csv")}
    return validar_asignacion(leer_csv(CARPETA / f"asignacion_lote_{n}.csv"), esperadas, categorias, skus)


def main(argv: list[str]) -> int:
    if len(argv) < 2 or argv[1] not in ("preparar", "validar", "armar"):
        print(__doc__)
        return 1
    if argv[1] == "preparar":
        print(preparar())
        return 0
    if argv[1] == "validar":
        return validar(int(argv[2])) if len(argv) == 3 and argv[2].isdigit() else 1
    if len(argv) != 3:
        print('Uso: python scripts/asignar_excel.py armar "C:/ruta/listado de precio actualizadoEV.xlsx"')
        return 1
    return armar(argv[2])


if __name__ == "__main__":
    sys.exit(main(sys.argv))
