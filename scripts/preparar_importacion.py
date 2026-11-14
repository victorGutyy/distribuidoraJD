"""
Prepara el catálogo para importarlo al panel (F3a).

Lee   data/catalogo_jd_corregido.csv   (una fila por tarjeta del PDF)
Crea  data/importacion_ev.csv          (una fila por PRESENTACIÓN, formato de la plantilla)
      data/sku_asignados.csv           (SKU ya asignados: NO cambian al volver a ejecutar)
      data/revision/*.csv|md           (informes para que una persona revise)

Qué hace (reglas explicadas en cada función):
  - separa varias presentaciones escritas en una sola fila ("130 gramos | 200 gramos")
  - interpreta "460 gramos" → contenido 460 g, y "12 unidades" → paquete de 12
  - separa la MARCA del detalle ("Aceite de soya | La soberana")
  - une las filas que son presentaciones del mismo producto y quita duplicados
  - corrige categorías evidentes (el atún no es un grano)
  - asigna SKU estables EVC-00001-01 ("C" = catálogo inicial: no choca con los
    EV-00001-01 que genera el panel al crear productos a mano)

Uso (desde la raíz del proyecto, en Git Bash):
    python scripts/preparar_importacion.py
    python scripts/preparar_importacion.py --reiniciar-sku   (solo ANTES de la primera importación)

No instala nada: solo biblioteca estándar de Python. NO modifica el CSV de origen.
"""

from __future__ import annotations

import collections
import csv
import re
import sys
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "data" / "catalogo_jd_corregido.csv"
DESTINO = RAIZ / "data" / "importacion_ev.csv"
SKU_ASIGNADOS = RAIZ / "data" / "sku_asignados.csv"
DECISIONES_MARCAS = RAIZ / "data" / "marcas_decisiones.csv"
CARPETA_REVISION = RAIZ / "data" / "revision"
PREFIJO_SKU = "EVC"

# Columnas de la plantilla de importación (el importador del panel usa las mismas).
COLUMNAS = [
    "sku", "producto", "categoria", "subcategoria", "marca", "descripcion",
    "etiquetas", "presentacion", "contenido_valor", "contenido_unidad",
    "unidad_venta", "unidades_por_empaque", "precio_unidad", "precio_mayor",
    "cantidad_min_mayor", "en_oferta", "precio_oferta", "disponible", "activo",
    "pagina_pdf",
]


# ---------------------------------------------------------------------------
# Utilidades de texto
# ---------------------------------------------------------------------------
def limpiar(texto: str) -> str:
    """Quita espacios sobrantes (el PDF trae muchos espacios dobles)."""
    return re.sub(r"\s+", " ", texto or "").strip()


def norm(texto: str) -> str:
    """Para COMPARAR: sin tildes, en minúsculas y sin espacios repetidos."""
    sin_tildes = unicodedata.normalize("NFD", limpiar(texto))
    sin_tildes = "".join(c for c in sin_tildes if unicodedata.category(c) != "Mn")
    return sin_tildes.lower()


def partes(texto: str) -> list[str]:
    """Divide por "|" y limpia; descarta los vacíos."""
    return [p for p in (limpiar(x) for x in (texto or "").split("|")) if p]


# ---------------------------------------------------------------------------
# Presentación: "460 gramos", "130 gramos | 200 gramos", "250 / 450 / 800 mililitros"
# ---------------------------------------------------------------------------
UNIDADES = {
    "gramos": "g", "gramo": "g", "gr": "g", "g": "g",
    "kilos": "kg", "kilo": "kg", "kg": "kg",
    "miligramos": "mg", "miligramo": "mg", "mg": "mg",
    "mililitros": "ml", "mililitro": "ml", "ml": "ml",
    "litros": "L", "litro": "L", "lt": "L", "l": "L",
    "libras": "lb", "libra": "lb", "lb": "lb",
    "onzas": "oz", "onza": "oz", "oz": "oz",
    "cc": "cc",
    "metros": "m", "metro": "m", "mts": "m", "mt": "m", "m": "m",
    "cm": "cm",
}
_UNIDAD_RE = re.compile(
    r"\b(" + "|".join(sorted(UNIDADES, key=len, reverse=True)) + r")\b", re.I
)
_NUMERO_RE = re.compile(r"\d[\d.,]*")


def parsear_numero(texto: str) -> float | None:
    """'1.500' → 1500 (punto = miles) · '0,5' → 0.5 · '250' → 250."""
    t = texto.strip().rstrip(".,")
    if re.fullmatch(r"\d{1,3}(\.\d{3})+", t):
        return float(t.replace(".", ""))
    if re.fullmatch(r"\d+,\d+", t):
        return float(t.replace(",", "."))
    if re.fullmatch(r"\d+(\.\d+)?", t):
        return float(t)
    return None


def formatear_numero(valor: float) -> str:
    return str(int(valor)) if float(valor).is_integer() else str(valor).replace(".", ",")


def parsear_presentacion(texto: str) -> tuple[list[dict], list[str]]:
    """
    Devuelve (items, avisos). Cada item: {texto, valor, unidad}.
      "130 gramos | 200 gramos"        → 2 items
      "250 / 450 / 800 mililitros"     → 3 items (la unidad final vale para todos)
      "1.500 metros"                   → valor 1500, unidad m
    Lo que no se entiende queda como texto libre (valor/unidad = None) con un aviso.
    """
    items: list[dict] = []
    avisos: list[str] = []
    for parte in partes(texto):
        if "+" in parte:
            items.append({"texto": parte, "valor": None, "unidad": None})
            avisos.append(f"presentación compuesta «{parte}»: revisar")
            continue
        unidades = list(_UNIDAD_RE.finditer(parte))
        numeros = _NUMERO_RE.findall(parte)
        if not unidades or not numeros:
            items.append({"texto": parte, "valor": None, "unidad": None})
            avisos.append(f"presentación sin número o unidad «{parte}»")
            continue
        ultima = unidades[-1]
        abreviatura = UNIDADES[ultima.group(1).lower()]
        resto = limpiar(parte[ultima.end():])  # descriptores tras la unidad
        for n in numeros:
            valor = parsear_numero(n)
            if valor is None:
                items.append({"texto": parte, "valor": None, "unidad": None})
                avisos.append(f"número ilegible en «{parte}»")
                continue
            etiqueta = f"{formatear_numero(valor)} {abreviatura}"
            if resto and len(numeros) == 1:
                etiqueta += f" {resto}"
            items.append({"texto": etiqueta, "valor": valor, "unidad": abreviatura})
    return items, avisos


# ---------------------------------------------------------------------------
# Unidad de venta: "Individual", "12 unidades", "12 unidades | Individual"
# ---------------------------------------------------------------------------
_PAQUETE_RE = re.compile(
    r"^(\d+)\s*(unidades|unidad|piezas|pieza|pares|par|und|uds?)\b\s*(.*)$", re.I
)


def parsear_unidad_venta(texto: str) -> tuple[list[dict], list[str]]:
    """
    Devuelve (items, avisos). Cada item: {tipo, n, extra, promo}.
      "Individual" o vacío     → individual, 1
      "12 unidades"            → paquete, 12   (suposición hasta resolver la pregunta
                                                abierta #7 del cliente; se corrige luego)
      "Pague 1, lleve 2"       → individual + etiqueta de promoción
      "6 unidades    metálico" → paquete 6 con el descriptor "metálico"
    """
    if not limpiar(texto):
        return [{"tipo": "individual", "n": 1, "extra": "", "promo": None}], []
    items: list[dict] = []
    avisos: list[str] = []
    for bruta in re.split(r"[|/]", texto):
        parte = limpiar(bruta)
        if not parte:
            continue
        m = _PAQUETE_RE.match(parte)
        if re.fullmatch(r"individual", parte, re.I):
            item = {"tipo": "individual", "n": 1, "extra": "", "promo": None}
        elif m:
            item = {"tipo": "paquete", "n": int(m.group(1)), "extra": limpiar(m.group(3)), "promo": None}
        elif re.match(r"pague\b", parte, re.I):
            # Sin la coma: las etiquetas del archivo se separan por comas.
            item = {"tipo": "individual", "n": 1, "extra": "", "promo": parte.replace(",", "")}
        else:
            item = {"tipo": "individual", "n": 1, "extra": parte, "promo": None}
            avisos.append(f"unidad de venta no reconocida «{parte}»")
        if item not in items:  # "Individual | Individual" → uno solo
            items.append(item)
    return items, avisos


# ---------------------------------------------------------------------------
# Detalle / marca ("marca_o_detalle")
# ---------------------------------------------------------------------------
_CONTENIDO_RE = re.compile(
    r"^(\d+)\s*(tabletas?|c[aá]psulas?|sobres?|ampollas?|tiras?)$", re.I
)
# Valores que describen una VARIANTE (color, medida…), nunca una marca.
_ATRIBUTO_RE = re.compile(
    r"^(colores?|medidas?|n[uú]meros?|tama[nñ]os?|tallas?|sabores?|surtidos?|variedades?|"
    r"modelos?|dise[nñ]os?|motivos?|im[aá]genes|fluorescentes?|met[aá]lic[oa]s?|"
    r"(blanc|negr|roj|azul|verd|amarill|rosad|gris|morad|naranj|caf[eé]|dorad|platead|transparent)[oa]?s?|"
    r"para \$\s*\d+.*|sin empaque.*)$",
    re.I,
)
# Palabras que delatan un TAMAÑO, MEDIDA, SABOR o CANTIDAD (no una marca) aunque
# vengan dentro de una frase ("Mora azul", "Línea escolar", "Cinta ancha"). Es
# preferible dejar un detalle sin marca (se revisa a mano) que inventar una marca.
_PALABRAS_ATRIBUTO_RE = re.compile(
    r"\b(colores?|color|medidas?|n[uú]meros?|tama[nñ]os?|tallas?|sabores?|surtid[oa]s?|"
    r"variedades?|modelos?|dise[nñ]os?|motivos?|im[aá]genes|fluorescentes?|met[aá]lic[oa]s?|"
    r"grandes?|peque[nñ][oa]s?|median[oa]s?|gruesa?s?|delgad[oa]s?|carta|oficio|"
    r"ni[nñ][oa]s?|adultos?|original(es)?|tonos?|empaque|l[ií]nea|hojas?|pulgadas?|"
    r"cent[ií]metros?|mil[ií]metros?|yardas?|partes?|galletas?|paquetes?|unidades?|"
    r"pares?|piezas?|onzas?|gramos?|metros?|litros?|chorros?|doble|sencill[oa]s?|"
    r"rosado|morado|escarchad[oa]s?|borrable|cuartos?|"
    r"vainilla|fresa|sand[ií]a|lim[oó]n|limonadas?|mora|chocolate|coco|naranja|mandarina|"
    r"menta|uva|manzana|pi[nñ]a|cereza|durazno|maracuy[aá]|tropical|arequipe|banano|lulo|"
    r"guan[aá]bana|mango|frutos?)\b",
    re.I,
)


def es_atributo(valor: str) -> bool:
    """
    ¿Describe una variante (tamaño, medida, color, sabor, cantidad…) y NO una marca?
    Cualquier dígito cuenta como atributo ("40 hojas", "16 pulgadas", "7 TRS").
    """
    v = limpiar(valor)
    return bool(
        re.search(r"\d", v)
        or _ATRIBUTO_RE.match(v)
        or _PALABRAS_ATRIBUTO_RE.search(v)
    )


def clasificar_detalle(texto: str) -> dict:
    """
    Separa el campo `marca_o_detalle` en: contenido ("100 tabletas"), candidatos
    (posible marca o detalle) y si venía con "|".
    """
    contenido = None
    candidatos: list[str] = []
    lista = partes(texto)
    for p in lista:
        m = _CONTENIDO_RE.match(p)
        if m and contenido is None:
            contenido = {"valor": float(m.group(1)), "unidad": norm(m.group(2)).rstrip("s") + "s"}
        else:
            candidatos.append(p)
    return {"contenido": contenido, "candidatos": candidatos, "con_barra": len(lista) > 1}


def decidir_marca(
    detalle: dict,
    frecuencias: collections.Counter,
    decisiones: dict[str, tuple[bool, str]],
) -> tuple[str, str, str]:
    """
    Devuelve (marca, detalle_texto, origen). `origen` explica por qué se decidió
    (para el informe de revisión).
      - Una decisión humana (data/marcas_decisiones.csv) manda sobre todo.
      - Un atributo ("Colores", "Para $500") nunca es marca.
      - Con "|": el ÚLTIMO candidato es la marca y los anteriores son el detalle.
      - Sin "|": es marca si se repite en 2 o más tarjetas; si no, es detalle.
    """
    candidatos = detalle["candidatos"]
    if not candidatos:
        return "", "", "sin dato"

    def decision(valor: str) -> tuple[bool, str] | None:
        return decisiones.get(norm(valor))

    marca, restos = "", list(candidatos)
    origen = "heurística"
    if detalle["con_barra"] and len(candidatos) >= 1:
        ultimo = candidatos[-1]
        d = decision(ultimo)
        if d is not None:
            origen = "decisión humana"
            if d[0]:
                marca, restos = d[1] or ultimo, candidatos[:-1]
        elif not es_atributo(ultimo):
            marca, restos = ultimo, candidatos[:-1]
    elif len(candidatos) == 1:
        unico = candidatos[0]
        d = decision(unico)
        if d is not None:
            origen = "decisión humana"
            if d[0]:
                marca, restos = d[1] or unico, []
        elif not es_atributo(unico) and frecuencias[norm(unico)] >= 2:
            marca, restos = unico, []
    return marca, " / ".join(restos), origen


def cargar_decisiones() -> dict[str, tuple[bool, str]]:
    """data/marcas_decisiones.csv: valor, es_marca (si/no), marca_normalizada."""
    if not DECISIONES_MARCAS.exists():
        return {}
    decisiones: dict[str, tuple[bool, str]] = {}
    with open(DECISIONES_MARCAS, encoding="utf-8-sig", newline="") as f:
        for fila in csv.DictReader(f):
            es_marca = norm(fila.get("es_marca", "")) in ("si", "s", "1", "true")
            decisiones[norm(fila["valor"])] = (es_marca, limpiar(fila.get("marca_normalizada", "")))
    return decisiones


# ---------------------------------------------------------------------------
# Categorías
# ---------------------------------------------------------------------------
_ENLATADO_RE = re.compile(r"\b(at[uú]n|sardinas?|conservas?|ensalada de at[uú]n)\b", re.I)


def corregir_categoria(categoria: str, subcategoria: str, nombre: str) -> tuple[str, str, bool]:
    """Devuelve (categoria, subcategoria, fue_corregida)."""
    if subcategoria == "Granos y harinas" and _ENLATADO_RE.search(nombre):
        return "Víveres y despensa", "Enlatados", True
    return categoria, subcategoria, False


# ---------------------------------------------------------------------------
# SKU estables
# ---------------------------------------------------------------------------
class AsignadorSku:
    """
    Asigna EVC-00001 a cada producto y EVC-00001-01 a cada presentación, y lo
    guarda en data/sku_asignados.csv. Al volver a ejecutar, lo ya asignado NO cambia
    (si cambiara, importar dos veces duplicaría productos).
    """

    def __init__(self, ruta: Path | None = SKU_ASIGNADOS, cargar: bool = True):
        self.ruta = ruta
        self.productos: dict[str, str] = {}
        self.variantes: dict[str, str] = {}
        if cargar and ruta and ruta.exists():
            with open(ruta, encoding="utf-8-sig", newline="") as f:
                for fila in csv.DictReader(f):
                    destino = self.productos if fila["tipo"] == "producto" else self.variantes
                    destino[fila["clave"]] = fila["sku"]

    def _siguiente_producto(self) -> int:
        numeros = [int(s.split("-")[1]) for s in self.productos.values()]
        return max(numeros, default=0) + 1

    def producto(self, clave: str) -> str:
        if clave not in self.productos:
            self.productos[clave] = f"{PREFIJO_SKU}-{self._siguiente_producto():05d}"
        return self.productos[clave]

    def variante(self, clave_producto: str, clave_variante: str) -> str:
        sku_producto = self.producto(clave_producto)
        clave = f"{clave_producto}||{clave_variante}"
        if clave not in self.variantes:
            usados = [
                int(s.rsplit("-", 1)[1])
                for s in self.variantes.values()
                if s.startswith(sku_producto + "-")
            ]
            self.variantes[clave] = f"{sku_producto}-{max(usados, default=0) + 1:02d}"
        return self.variantes[clave]

    def guardar(self) -> None:
        if not self.ruta:
            return
        with open(self.ruta, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f)
            w.writerow(["tipo", "clave", "sku"])
            for clave, sku in sorted(self.productos.items(), key=lambda kv: kv[1]):
                w.writerow(["producto", clave, sku])
            for clave, sku in sorted(self.variantes.items(), key=lambda kv: kv[1]):
                w.writerow(["variante", clave, sku])


# ---------------------------------------------------------------------------
# Conversión principal
# ---------------------------------------------------------------------------
def variantes_de_fila(fila: dict, detalle: dict) -> tuple[list[dict], list[str]]:
    """Convierte UNA fila del origen en 1 o más presentaciones."""
    pres, av1 = parsear_presentacion(fila["presentacion"])
    uvs, av2 = parsear_unidad_venta(fila["unidad_venta"])
    avisos = av1 + av2

    # Combinar presentación y unidad de venta. En los datos reales nunca vienen
    # varias de las dos a la vez; si pasara, se empareja por posición y se avisa.
    if len(pres) > 1 and len(uvs) > 1:
        avisos.append("varias presentaciones Y varias unidades de venta: emparejadas por posición")
        total = max(len(pres), len(uvs))
        pares = [(pres[i] if i < len(pres) else None, uvs[i] if i < len(uvs) else uvs[-1]) for i in range(total)]
    elif len(pres) > 1:
        pares = [(p, uvs[0]) for p in pres]
    elif len(uvs) > 1:
        pares = [(pres[0] if pres else None, u) for u in uvs]
    else:
        pares = [(pres[0] if pres else None, uvs[0])]

    resultado: list[dict] = []
    for p, u in pares:
        nombre_partes: list[str] = []
        valor = unidad = None
        if p:
            nombre_partes.append(p["texto"])
            valor, unidad = p["valor"], p["unidad"]
        if detalle["contenido"]:
            c = detalle["contenido"]
            nombre_partes.append(f"{formatear_numero(c['valor'])} {c['unidad']}")
            if valor is None:  # el contenido por empaque solo sirve si no hay otro
                valor, unidad = c["valor"], c["unidad"]
        if u["tipo"] == "paquete":
            nombre_partes.append(f"{u['n']} unidades" + (f" {u['extra']}" if u["extra"] else ""))
        elif u["extra"]:
            nombre_partes.append(u["extra"])
        resultado.append({
            "presentacion": " · ".join(nombre_partes),
            "contenido_valor": valor,
            "contenido_unidad": unidad,
            "unidad_venta": u["tipo"],
            "unidades_por_empaque": u["n"],
            "promo": u["promo"],
        })
    return resultado, avisos


def clave_variante(v: dict) -> str:
    return "|".join(str(x) for x in (norm(v["presentacion"]), v["unidad_venta"], v["unidades_por_empaque"], v["contenido_valor"], v["contenido_unidad"]))


def convertir(filas: list[dict], decisiones: dict, asignador: AsignadorSku) -> dict:
    """Convierte todo el catálogo. Devuelve filas de salida e informes."""
    # Frecuencia de cada valor suelto (para decidir si es una marca).
    frecuencias: collections.Counter = collections.Counter()
    for f in filas:
        cand = clasificar_detalle(f["marca_o_detalle"])["candidatos"]
        if len(cand) == 1 and not clasificar_detalle(f["marca_o_detalle"])["con_barra"]:
            frecuencias[norm(cand[0])] += 1

    productos: dict[tuple, dict] = collections.OrderedDict()
    revision: list[dict] = []
    correcciones_categoria = 0

    for f in filas:
        cat, sub, corregida = corregir_categoria(f["categoria_propuesta"], f["subcategoria_propuesta"], f["nombre"])
        correcciones_categoria += corregida
        detalle = clasificar_detalle(f["marca_o_detalle"])
        marca, detalle_texto, origen = decidir_marca(detalle, frecuencias, decisiones)
        vars_, avisos = variantes_de_fila(f, detalle)
        nombre = limpiar(f["nombre"])
        clave = (norm(sub), norm(nombre), norm(marca), norm(detalle_texto))
        prod = productos.setdefault(clave, {
            "nombre": nombre, "categoria": cat, "subcategoria": sub, "marca": marca,
            "detalle": detalle_texto, "pagina": f["pagina_pdf"], "variantes": collections.OrderedDict(),
            "etiquetas": set(), "origen_marca": origen,
        })
        for v in vars_:
            if v["promo"]:
                prod["etiquetas"].add(v["promo"])
            prod["variantes"].setdefault(clave_variante(v), v)  # duplicados exactos se funden
        for a in avisos:
            revision.append({"pagina_pdf": f["pagina_pdf"], "nombre": nombre, "motivo": a, "texto_original": f["texto_original"]})
        if f.get("nota_revision", "").startswith("categoría asignada"):
            revision.append({"pagina_pdf": f["pagina_pdf"], "nombre": nombre, "motivo": f"categoría asignada automáticamente: {cat} › {sub}", "texto_original": f["texto_original"]})

    # ¿Un mismo producto (nombre + marca) tiene varios detalles distintos? Entonces
    # el detalle forma parte del NOMBRE para distinguirlos; si no, va a la descripción.
    detalles_por_base = collections.defaultdict(set)
    for (sub, nombre_n, marca_n, detalle_n), p in productos.items():
        detalles_por_base[(sub, nombre_n, marca_n)].add(detalle_n)

    salida: list[dict] = []
    nombres_usados: collections.Counter = collections.Counter()
    for (sub_n, nombre_n, marca_n, detalle_n), p in productos.items():
        distingue = len(detalles_por_base[(sub_n, nombre_n, marca_n)]) > 1
        nombre_final = f"{p['nombre']} – {p['detalle']}" if (distingue and p["detalle"]) else p["nombre"]
        descripcion = "" if (distingue or not p["detalle"]) else p["detalle"]
        nombres_usados[(sub_n, norm(nombre_final), marca_n)] += 1
        clave_producto = f"{sub_n}|{norm(nombre_final)}|{marca_n}|{detalle_n}"
        for v in p["variantes"].values():
            salida.append({
                "sku": asignador.variante(clave_producto, clave_variante(v)),
                "producto": nombre_final,
                "categoria": p["categoria"],
                "subcategoria": p["subcategoria"],
                "marca": p["marca"],
                "descripcion": descripcion,
                "etiquetas": ", ".join(sorted(p["etiquetas"])),
                "presentacion": v["presentacion"],
                "contenido_valor": "" if v["contenido_valor"] is None else formatear_numero(v["contenido_valor"]),
                "contenido_unidad": v["contenido_unidad"] or "",
                "unidad_venta": v["unidad_venta"],
                "unidades_por_empaque": v["unidades_por_empaque"],
                "precio_unidad": "", "precio_mayor": "", "cantidad_min_mayor": "",
                "en_oferta": "no", "precio_oferta": "",
                "disponible": "si", "activo": "si",
                "pagina_pdf": p["pagina"],
            })
    return {
        "salida": salida,
        "revision": revision,
        "frecuencias": frecuencias,
        "n_productos": len(productos),
        "correcciones_categoria": correcciones_categoria,
        "productos": productos,
    }


# ---------------------------------------------------------------------------
# Archivos de salida
# ---------------------------------------------------------------------------
def escribir_csv(ruta: Path, columnas: list[str], filas: list[dict]) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with open(ruta, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=columnas)
        w.writeheader()
        w.writerows(filas)


def main() -> None:
    # --reiniciar-sku: vuelve a numerar desde EVC-00001 e IGNORA data/sku_asignados.csv.
    # ⚠️ Úsalo SOLO antes de la primera importación al panel. Después, los SKU ya
    # están en la base de datos y cambiarlos duplicaría todo el catálogo.
    reiniciar = "--reiniciar-sku" in sys.argv
    with open(ORIGEN, encoding="utf-8-sig", newline="") as f:
        filas = list(csv.DictReader(f))
    decisiones = cargar_decisiones()
    asignador = AsignadorSku(cargar=not reiniciar)
    r = convertir(filas, decisiones, asignador)
    asignador.guardar()

    escribir_csv(DESTINO, COLUMNAS, r["salida"])
    escribir_csv(CARPETA_REVISION / "filas_a_revisar.csv", ["pagina_pdf", "nombre", "motivo", "texto_original"], r["revision"])

    # Marcas: qué se decidió y por qué, para que una persona lo corrija.
    cuenta_marcas = collections.Counter(p["marca"] for p in r["productos"].values() if p["marca"])
    candidatas = []
    for valor, veces in r["frecuencias"].most_common():
        original = next((p["marca"] for p in r["productos"].values() if norm(p["marca"]) == valor and p["marca"]), "")
        candidatas.append({
            "valor": original or valor, "veces_como_valor_suelto": veces,
            "decision_actual": "MARCA" if original else "detalle del producto",
            "es_marca (si/no)": "", "marca_normalizada": "",
        })
    escribir_csv(CARPETA_REVISION / "marcas_candidatas.csv",
                 ["valor", "veces_como_valor_suelto", "decision_actual", "es_marca (si/no)", "marca_normalizada"], candidatas)

    categorias = collections.Counter((p["categoria"], p["subcategoria"]) for p in r["productos"].values())
    escribir_csv(CARPETA_REVISION / "categorias.csv", ["categoria", "subcategoria", "productos"],
                 [{"categoria": c, "subcategoria": s, "productos": n} for (c, s), n in sorted(categorias.items())])

    sin_pres = sum(1 for v in r["salida"] if not v["presentacion"])
    resumen = f"""# Resumen de la preparación de la importación

- Filas en el CSV de origen: **{len(filas)}**
- Productos resultantes: **{r['n_productos']}**
- Presentaciones (filas de `importacion_ev.csv`): **{len(r['salida'])}**
- Marcas distintas asignadas: **{len(cuenta_marcas)}** ({sum(cuenta_marcas.values())} productos con marca)
- Categorías corregidas automáticamente (atún/conservas → Enlatados): **{r['correcciones_categoria']}** filas
- Presentaciones sin texto de presentación: **{sin_pres}**
- Avisos para revisar a mano: **{len(r['revision'])}** (ver `filas_a_revisar.csv`)

## Cómo revisar las marcas
1. Abre `data/revision/marcas_candidatas.csv` en Excel.
2. En `es_marca (si/no)` escribe **si** o **no** para los valores que quieras corregir
   (y en `marca_normalizada` el nombre correcto si hace falta).
3. Guarda el archivo como `data/marcas_decisiones.csv` (columnas: valor, es_marca, marca_normalizada).
4. Vuelve a ejecutar `python scripts/preparar_importacion.py`.

Los SKU ya asignados (`data/sku_asignados.csv`) **no cambian** al volver a ejecutar.
"""
    (CARPETA_REVISION / "resumen.md").write_text(resumen, encoding="utf-8")
    print(resumen)


if __name__ == "__main__":
    main()
