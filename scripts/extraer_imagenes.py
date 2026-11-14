"""
Extrae las fotos del portafolio en PDF y las deja asignadas a cada producto por SKU.

Uso (desde la raíz del proyecto):
    python -X utf8 scripts/extraer_imagenes.py "RUTA/Portafolio.pdf"

Qué hace:
  1. Lee la geometría de cada página (geometria_pdf.py): qué foto va sobre cada bloque de texto.
  2. Empareja cada bloque con su fila de data/catalogo_jd_corregido.csv (por página y texto).
  3. Con las filas de cada producto (preparar_importacion.py) y los SKU ya asignados
     (data/sku_asignados.csv), guarda las fotos como data/imagenes_pdf/EVC-00001.jpg,
     EVC-00001_2.jpg… (la primera es la principal). NO cambia ningún SKU.
  4. Escribe informes en data/revision_imagenes/ y hojas de contactos para revisar a ojo.

No instala nada: usa pypdf y Pillow. Las fotos NO se suben a git (repositorio público).
"""
from __future__ import annotations

import collections
import csv
import hashlib
import io
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))

from geometria_pdf import Bloque, Foto, leer_pagina  # noqa: E402
from preparar_importacion import AsignadorSku, ORIGEN, cargar_decisiones, convertir  # noqa: E402

CARPETA_FOTOS = RAIZ / "data" / "imagenes_pdf"
# Productos cuya foto principal es DUDOSA (emparejada por cercanía o sobrante): se dejan aparte para revisarlas.
CARPETA_REVISAR = RAIZ / "data" / "imagenes_pdf_revisar"
CARPETA_REVISION = RAIZ / "data" / "revision_imagenes"
MAX_FOTOS_POR_PRODUCTO = 6
# Una foto con menos píxeles que esto es un logo o un adorno, no un producto.
MIN_PIXELES_FOTO = 25_000
# Foto "suelta" (sin bloque encima): se le da al bloque más cercano si está a menos de esto (puntos).
MAX_DISTANCIA_SOBRANTE = 260.0


def clave_texto(texto: str) -> str:
    """Compara textos sin espacios (el PDF parte las palabras) ni mayúsculas."""
    return re.sub(r"\s+", "", texto).lower()


def dimensiones(datos: bytes) -> tuple[int, int] | None:
    try:
        with Image.open(io.BytesIO(datos)) as im:
            return im.size
    except Exception:
        return None


def datos_para_navegador(foto: Foto) -> tuple[bytes, str]:
    """Los navegadores no abren JPEG 2000 (.jp2) y otros formatos raros: se pasan a JPEG."""
    if foto.ext in ("jpg", "jpeg", "png", "webp"):
        return foto.datos, "jpg" if foto.ext == "jpeg" else foto.ext
    with Image.open(io.BytesIO(foto.datos)) as im:
        salida = io.BytesIO()
        im.convert("RGB").save(salida, "JPEG", quality=92)
    return salida.getvalue(), "jpg"


def es_foto_de_producto(f: Foto) -> bool:
    d = dimensiones(f.datos) if f.datos else None
    return bool(d and d[0] * d[1] >= MIN_PIXELES_FOTO)


def asignar_sobrantes(fotos: list[Foto], bloques: list[Bloque]) -> list[tuple[Foto, Bloque]]:
    """
    Fotos que no quedaron debajo de ningún bloque (p. ej. un producto con varias fotos de
    colores): se les da el bloque más cercano. Siempre quedan marcadas como dudosas.
    """
    usadas = {id(b.foto) for b in bloques if b.foto}
    resultado = []
    for f in fotos:
        if id(f) in usadas or not bloques:
            continue
        mejor = min(bloques, key=lambda b: (f.centro_x - b.x) ** 2 + (f.arriba - b.y_superior) ** 2)
        distancia = ((f.centro_x - mejor.x) ** 2 + (f.y - mejor.y_superior) ** 2) ** 0.5
        if distancia <= MAX_DISTANCIA_SOBRANTE:
            resultado.append((f, mejor))
    return resultado


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    ruta_pdf = Path(sys.argv[1])
    if not ruta_pdf.exists():
        sys.exit(f"No existe el archivo: {ruta_pdf}")

    # --- 1) Catálogo: filas y productos con su SKU (sin modificar sku_asignados.csv) ---
    with open(ORIGEN, encoding="utf-8-sig", newline="") as f:
        filas = list(csv.DictReader(f))
    asignador = AsignadorSku(cargar=True)
    resultado = convertir(filas, cargar_decisiones(), asignador)
    productos = resultado["productos"]
    producto_de_fila: dict[int, dict] = {}
    for p in productos.values():
        for i in p["filas"]:
            producto_de_fila[i] = p

    # Filas por página y texto, para emparejar cada bloque con su fila.
    pendientes: dict[tuple[int, str], list[int]] = collections.defaultdict(list)
    for i, fila in enumerate(filas):
        pendientes[(int(fila["pagina_pdf"]), clave_texto(fila["texto_original"]))].append(i)

    # --- 2) Recorrer el PDF ---
    lector = PdfReader(str(ruta_pdf))
    fotos_de_fila: dict[int, list[tuple[Foto, str]]] = collections.defaultdict(list)  # fila → [(foto, confianza)]
    bloques_sin_fila: list[tuple[int, str]] = []
    paginas_dudosas: list[tuple[int, str]] = []

    for n in range(1, len(lector.pages) + 1):
        fotos, bloques = leer_pagina(lector, n)
        fotos = [f for f in fotos if es_foto_de_producto(f)]
        # Las fotos que el emparejamiento por geometría dio a un bloque, pero que eran logos, se quitan.
        validas = {id(f) for f in fotos}
        for b in bloques:
            if b.foto and id(b.foto) not in validas:
                b.foto, b.confianza = None, ""
        n_con = sum(1 for b in bloques if b.foto)
        if bloques and (n_con != len(bloques) or len(fotos) != len(bloques)):
            paginas_dudosas.append((n, f"{len(fotos)} fotos y {len(bloques)} bloques de texto"))

        asignaciones: list[tuple[Bloque, Foto, str]] = [(b, b.foto, b.confianza) for b in bloques if b.foto]
        for foto, bloque in asignar_sobrantes(fotos, bloques):
            asignaciones.append((bloque, foto, "sobrante"))

        # Bloques con fila del catálogo
        fila_de_bloque: dict[int, int] = {}
        for b in bloques:
            clave = (n, clave_texto(b.texto))
            if pendientes.get(clave):
                fila_de_bloque[id(b)] = pendientes[clave].pop(0)
            else:
                bloques_sin_fila.append((n, b.texto))
        for bloque, foto, confianza in asignaciones:
            fila = fila_de_bloque.get(id(bloque))
            if fila is not None:
                fotos_de_fila[fila].append((foto, confianza))

    # --- 3) Guardar las fotos por producto ---
    for carpeta in (CARPETA_FOTOS, CARPETA_REVISAR):
        carpeta.mkdir(parents=True, exist_ok=True)
        for viejo in carpeta.glob("*"):
            viejo.unlink()  # solo archivos generados por este mismo script
    guardadas: dict[str, list[dict]] = {}
    for p in productos.values():
        vistos: set[str] = set()
        lista = []
        for i in p["filas"]:
            for foto, confianza in fotos_de_fila.get(i, []):
                huella = hashlib.sha1(foto.datos).hexdigest()
                if huella in vistos or len(lista) >= MAX_FOTOS_POR_PRODUCTO:
                    continue
                vistos.add(huella)
                lista.append({"foto": foto, "confianza": confianza, "huella": huella, "fila": i})
        # Primero las seguras (orden/cercanía) y al final las dudosas (sobrantes).
        lista.sort(key=lambda e: e["confianza"] == "sobrante")
        # Si la foto principal es dudosa, TODAS las fotos del producto van a la carpeta de revisión.
        destino = CARPETA_FOTOS if (lista and lista[0]["confianza"] == "orden") else CARPETA_REVISAR
        for k, e in enumerate(lista):
            sufijo = "" if k == 0 else f"_{k + 1}"
            datos, ext = datos_para_navegador(e["foto"])
            archivo = destino / f"{p['sku_producto']}{sufijo}.{ext}"
            archivo.write_bytes(datos)
            e["archivo"] = archivo.name
        guardadas[p["sku_producto"]] = lista

    # --- 4) Informes ---
    CARPETA_REVISION.mkdir(parents=True, exist_ok=True)
    por_huella: dict[str, list[str]] = collections.defaultdict(list)
    for sku, lista in guardadas.items():
        for e in lista:
            por_huella[e["huella"]].append(sku)

    sin_foto, dudosos, baja_res = [], [], []
    for p in productos.values():
        sku = p["sku_producto"]
        lista = guardadas[sku]
        if not lista:
            sin_foto.append({"sku": sku, "producto": p["nombre_final"], "pagina_pdf": p["pagina"]})
            continue
        principal = lista[0]
        if principal["confianza"] != "orden":
            dudosos.append({"sku": sku, "producto": p["nombre_final"], "pagina_pdf": p["pagina"],
                            "confianza_principal": principal["confianza"], "fotos": len(lista)})
        d = dimensiones(principal["foto"].datos)
        if d and max(d) < 400:
            baja_res.append({"sku": sku, "producto": p["nombre_final"], "ancho": d[0], "alto": d[1]})
    compartidas = [{"sku": ", ".join(skus), "archivo": h[:8]} for h, skus in por_huella.items() if len(set(skus)) > 1]

    def escribir(nombre: str, columnas: list[str], filas_: list[dict]) -> None:
        with open(CARPETA_REVISION / nombre, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=columnas)
            w.writeheader()
            w.writerows(filas_)

    escribir("productos_sin_foto.csv", ["sku", "producto", "pagina_pdf"], sin_foto)
    escribir("fotos_dudosas.csv", ["sku", "producto", "pagina_pdf", "confianza_principal", "fotos"], dudosos)
    escribir("fotos_baja_resolucion.csv", ["sku", "producto", "ancho", "alto"], baja_res)
    escribir("fotos_compartidas.csv", ["sku", "archivo"], compartidas)
    escribir("bloques_sin_fila.csv", ["pagina_pdf", "texto"], [{"pagina_pdf": a, "texto": b} for a, b in bloques_sin_fila])
    escribir("paginas_a_revisar.csv", ["pagina_pdf", "motivo"], [{"pagina_pdf": a, "motivo": b} for a, b in paginas_dudosas])

    con_foto = len(productos) - len(sin_foto)
    total_fotos = sum(len(v) for v in guardadas.values())
    fotos_a_revisar = sum(len(v) for v in guardadas.values() if v and v[0]["confianza"] != "orden")
    seguras = sum(1 for p in productos.values() if guardadas[p["sku_producto"]] and guardadas[p["sku_producto"]][0]["confianza"] == "orden")
    resumen = f"""# Resumen de la extracción de fotos

- Productos del catálogo: **{len(productos)}**
- Con al menos una foto: **{con_foto}** ({con_foto * 100 // max(1, len(productos))} %)
- Con foto principal SEGURA (orden dentro de su fila): **{seguras}**
- Con foto principal por cercanía o sobrante (revisar): **{len(dudosos)}**
- Sin ninguna foto: **{len(sin_foto)}**
- Fotos guardadas en total: **{total_fotos}**
  - `data/imagenes_pdf/`: {total_fotos - fotos_a_revisar} fotos SEGURAS, listas para subir
  - `data/imagenes_pdf_revisar/`: {fotos_a_revisar} fotos de productos con foto principal dudosa (míralas antes; las buenas se pasan a la carpeta anterior)
- Fotos principales con el lado mayor menor a 400 px: **{len(baja_res)}**
- Fotos repetidas en varios productos: **{len(compartidas)}**
- Bloques de texto del PDF sin fila en el catálogo: **{len(bloques_sin_fila)}**
- Páginas donde el número de fotos no coincide con el de bloques: **{len(paginas_dudosas)}**

Archivos de esta carpeta: `productos_sin_foto.csv`, `fotos_dudosas.csv`, `fotos_baja_resolucion.csv`,
`fotos_compartidas.csv`, `bloques_sin_fila.csv`, `paginas_a_revisar.csv` y `hojas/` (hojas de contactos
para revisar a ojo: borde verde = segura, naranja = dudosa).
"""
    (CARPETA_REVISION / "resumen.md").write_text(resumen, encoding="utf-8")

    # --- 5) Hojas de contactos ---
    hojas = CARPETA_REVISION / "hojas"
    hojas.mkdir(exist_ok=True)
    for viejo in hojas.glob("*.jpg"):
        viejo.unlink()
    try:
        fuente = ImageFont.truetype("arial.ttf", 13)
    except OSError:
        fuente = ImageFont.load_default()
    COLUMNAS, FILAS, CELDA_W, CELDA_H, FOTO = 6, 4, 230, 260, 200
    por_hoja = COLUMNAS * FILAS
    # Primero las seguras y después las dudosas: así las hojas con borde naranja quedan juntas al final.
    lista_productos = sorted(
        (p for p in productos.values() if guardadas[p["sku_producto"]]),
        key=lambda p: guardadas[p["sku_producto"]][0]["confianza"] != "orden",
    )
    for h in range(0, len(lista_productos), por_hoja):
        lienzo = Image.new("RGB", (COLUMNAS * CELDA_W, FILAS * CELDA_H), "white")
        dib = ImageDraw.Draw(lienzo)
        for k, p in enumerate(lista_productos[h:h + por_hoja]):
            e = guardadas[p["sku_producto"]][0]
            x0, y0 = (k % COLUMNAS) * CELDA_W, (k // COLUMNAS) * CELDA_H
            try:
                with Image.open(io.BytesIO(e["foto"].datos)) as im:
                    im = im.convert("RGB")
                    im.thumbnail((FOTO, FOTO))
                    lienzo.paste(im, (x0 + (CELDA_W - im.width) // 2, y0 + 6 + (FOTO - im.height) // 2))
            except Exception:
                dib.text((x0 + 10, y0 + 90), "sin vista", fill="red", font=fuente)
            color = "#2e9e4f" if e["confianza"] == "orden" else "#e8891a"
            dib.rectangle([x0 + 2, y0 + 2, x0 + CELDA_W - 3, y0 + CELDA_H - 3], outline=color, width=3)
            nombre = p["nombre_final"]
            nombre = nombre if len(nombre) <= 30 else nombre[:29] + "…"
            dib.text((x0 + 8, y0 + FOTO + 12), p["sku_producto"], fill="black", font=fuente)
            dib.text((x0 + 8, y0 + FOTO + 30), nombre, fill="black", font=fuente)
            dib.text((x0 + 8, y0 + FOTO + 48), f"pág. {p['pagina']} · {len(guardadas[p['sku_producto']])} foto(s)", fill="#555", font=fuente)
        lienzo.save(hojas / f"hoja_{h // por_hoja + 1:03d}.jpg", quality=82)

    print(resumen)


if __name__ == "__main__":
    main()
