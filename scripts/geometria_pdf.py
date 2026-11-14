"""
Lectura de la GEOMETRÍA de una página del portafolio en PDF: dónde está cada foto y
dónde está el texto de cada producto, para poder emparejarlos.

El PDF salió de Word: cada producto es un bloque de líneas con viñeta "❖" (nombre,
marca o detalle, presentación, forma de venta) puesto justo DEBAJO de su foto.
Solo usa pypdf (sin instalar nada más).
"""
from __future__ import annotations

from dataclasses import dataclass, field

from pypdf import PdfReader

VINETA = "❖"
# Separación entre la viñeta y el texto de la misma línea, en puntos del PDF.
SEPARACION_VINETA = 18.0
# Un bloque está debajo de una foto si su primera línea queda a menos de esto de su borde inferior.
MAX_DISTANCIA_BAJO_FOTO = 130.0
# Dos fotos están en la misma fila si sus bordes inferiores difieren menos de esto.
TOLERANCIA_FILA = 8.0


@dataclass
class Foto:
    nombre: str          # "Image15"
    x: float
    y: float             # borde INFERIOR (el PDF mide desde abajo)
    ancho: float
    alto: float
    pagina: int
    datos: bytes = b""
    ext: str = "jpg"

    @property
    def centro_x(self) -> float:
        return self.x + self.ancho / 2

    @property
    def arriba(self) -> float:
        return self.y + self.alto


@dataclass
class Bloque:
    x: float                                  # x de la viñeta
    y_superior: float                         # y de la primera línea
    lineas: list[str] = field(default_factory=list)
    foto: Foto | None = None
    confianza: str = ""                       # "orden", "cercania", ""

    @property
    def texto(self) -> str:
        return " / ".join(self.lineas)

    @property
    def centro_x(self) -> float:
        # El texto se reparte hacia la derecha de la viñeta: se estima su ancho.
        ancho = max((len(t) for t in self.lineas), default=0) * 5.0 + SEPARACION_VINETA
        return self.x + ancho / 2


def _multiplicar(a: list[float], b: list[float]) -> list[float]:
    """a × b con matrices de PDF [a b c d e f] (vector fila)."""
    return [
        a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
        a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
        a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5],
    ]


def _normalizar(texto: str) -> str:
    return " ".join(texto.split())


def leer_pagina(lector: PdfReader, numero: int, con_datos: bool = True) -> tuple[list[Foto], list[Bloque]]:
    """Fotos y bloques de texto de UNA página (numero empieza en 1), con el emparejamiento ya hecho."""
    pagina = lector.pages[numero - 1]
    posiciones: dict[str, list[float]] = {}
    segmentos: list[tuple[float, float, str]] = []

    def antes(operador, argumentos, cm, tm):
        if operador == b"Do" and argumentos:
            nombre = str(argumentos[0]).lstrip("/")
            posiciones.setdefault(nombre, [float(v) for v in cm])

    def texto(t, cm, tm, fuente, tamano):
        t = _normalizar(t)
        if t:
            m = _multiplicar([float(v) for v in tm], [float(v) for v in cm])
            segmentos.append((m[4], m[5], t))

    pagina.extract_text(visitor_operand_before=antes, visitor_text=texto)

    fotos: list[Foto] = []
    por_nombre = {}
    if con_datos:
        for im in pagina.images:
            por_nombre[im.name.rsplit(".", 1)[0]] = im
    for nombre, cm in posiciones.items():
        ancho, alto = abs(cm[0]), abs(cm[3])
        if ancho < 20 or alto < 20:
            continue
        foto = Foto(nombre, cm[4], cm[5], ancho, alto, numero)
        im = por_nombre.get(nombre)
        if im is not None:
            foto.datos = im.data
            foto.ext = im.name.rsplit(".", 1)[-1].lower()
        fotos.append(foto)

    # --- Líneas con viñeta: todo lo que está en la misma altura, entre esta viñeta y la siguiente ---
    viñetas = [(x, y) for x, y, t in segmentos if t == VINETA]
    lineas: list[tuple[float, float, str]] = []
    for x, y in viñetas:
        siguiente = min((vx for vx, vy in viñetas if abs(vy - y) < 1.5 and vx > x + 5), default=float("inf"))
        partes = sorted(
            (s for s in segmentos if abs(s[1] - y) < 1.5 and x + SEPARACION_VINETA - 3 <= s[0] < siguiente - 1 and s[2] != VINETA),
            key=lambda s: s[0],
        )
        lineas.append((x, y, _normalizar(" ".join(p[2] for p in partes))))
    lineas = [l for l in lineas if l[2]]

    # --- Agrupar en bloques: misma columna (x) y líneas seguidas hacia abajo ---
    lineas.sort(key=lambda l: (round(l[0] / 4), -l[1]))
    bloques: list[Bloque] = []
    for x, y, t in lineas:
        ultimo = bloques[-1] if bloques else None
        if ultimo and abs(ultimo.x - x) < 5 and 0 < (ultimo.y_inferior - y) < 40:
            ultimo.lineas.append(t)
            ultimo.y_inferior = y  # type: ignore[attr-defined]
        else:
            nuevo = Bloque(x, y, [t])
            nuevo.y_inferior = y  # type: ignore[attr-defined]
            bloques.append(nuevo)

    _emparejar(fotos, bloques)
    bloques.sort(key=lambda b: (-round(b.y_superior / 20), b.x))  # lectura: de arriba a abajo, de izquierda a derecha
    return fotos, bloques


def _emparejar(fotos: list[Foto], bloques: list[Bloque]) -> None:
    """
    Asigna a cada bloque la foto que tiene ENCIMA. Se agrupan por filas: en cada fila,
    fotos y bloques ordenados de izquierda a derecha. Si los números no coinciden, se
    usa la cercanía horizontal.
    """
    # Cada bloque → la fila de fotos (mismo borde inferior) más cercana por encima.
    filas: dict[float, list[Foto]] = {}
    for f in fotos:
        clave = next((k for k in filas if abs(k - f.y) <= TOLERANCIA_FILA), f.y)
        filas.setdefault(clave, []).append(f)

    bloques_por_fila: dict[float, list[Bloque]] = {}
    for b in bloques:
        candidatas = [k for k in filas if 0 <= k - b.y_superior <= MAX_DISTANCIA_BAJO_FOTO or 0 <= (k - b.y_superior) + 6 <= MAX_DISTANCIA_BAJO_FOTO]
        if not candidatas:
            continue
        fila = min(candidatas, key=lambda k: abs(k - b.y_superior))
        bloques_por_fila.setdefault(fila, []).append(b)

    for fila, bs in bloques_por_fila.items():
        fs = sorted(filas[fila], key=lambda f: f.x)
        bs = sorted(bs, key=lambda b: b.x)
        if len(fs) == len(bs):
            for f, b in zip(fs, bs):
                b.foto, b.confianza = f, "orden"
        else:
            for b in bs:
                f = min(fs, key=lambda f: abs(f.centro_x - b.centro_x))
                b.foto, b.confianza = f, "cercania"
