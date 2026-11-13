"""
Genera data/catalogo_jd_corregido.csv a partir de data/catalogo_jd_borrador.csv.
NO modifica el borrador original.

Qué corrige (hallazgos de la auditoría del PDF, nov-2026):
  1. Páginas 20, 200, 201, 202 y 203: el extractor fusionó productos o convirtió
     palabras sueltas ("Blancas", "10 unidades") en filas. Se reconstruyen a mano
     a partir de las coordenadas del texto del PDF.
  2. Filas con categoría REVISAR (págs. 276-291): se les asigna categoría y
     subcategoría. Queda anotado en la columna nueva `nota_revision`.

Uso (desde la raíz del proyecto, en Git Bash):
    python scripts/corregir_catalogo.py
"""
import csv
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "data" / "catalogo_jd_borrador.csv"
DESTINO = RAIZ / "data" / "catalogo_jd_corregido.csv"

# Mismos criterios que scripts/extraer.py para separar presentación y empaque
SIZE = re.compile(r"\d.*\b(gramos?|gr|g|kg|kilos?|libras?|ml|mililitros|miligramos|litros?|lt|cm|mts?|metros|onzas|oz|cc)\b", re.I)
PACK = re.compile(r"^(individual|pague|lleve|display|paquete|caja|bolsa|x ?\d|\d+ ?(unidades|und|uds|piezas|pares|rollos|sobres|tiras))", re.I)

# Productos reales de las páginas dañadas: cada producto es la lista de líneas
# con viñeta (❖) tal como aparecen en el PDF. La primera línea es el nombre.
CORRECCIONES = {
    20: ("Víveres y despensa", "Adicionales", [
        ["Café tostado y molido tradicional", "Doña Lupe", "125 gramos", "400 gramos", "Individual"],
        ["Café águila roja", "50 gramos", "10 unidades"],
        ["Café águila roja", "125 gramos", "Individual"],
        ["Café águila roja", "250 gramos", "Individual"],
        ["Aceite maxirico", "110 mililitros", "200 mililitros", "400 mililitros", "800 mililitros",
         "1800 mililitros", "2600 mililitros", "4000 mililitros", "Individual"],
    ]),
    200: ("Fiesta y velas", "Velas", [
        ["Velas alumbrado", "Blancas", "Colores", "20 unidades"],
        ["Velas 60*10", "Blancas", "Colores", "10 unidades"],
        ["Velas 30*10 L-2", "Blancas", "Colores", "10 unidades"],
        ["Velas 25*10 M", "Blancas", "10 unidades"],
        ["Velas 30*8", "Rojas", "8 unidades"],
        ["Velas 30*10 G", "Blancas", "10 unidades"],
    ]),
    201: ("Fiesta y velas", "Velones", [
        ["Velón #00", "Blanco", "Colores", "12 unidades"],
        ["Velón #0", "Blanco", "12 unidades"],
        ["Velón #001", "Blanco", "Colores", "12 unidades"],
        ["Velón #002", "Blanco", "Colores", "12 unidades"],
        ["Velón #004", "Blanco", "Colores", "12 unidades"],
        ["Velón #2", "Blanco", "Colores", "Individual"],
    ]),
    202: ("Fiesta y velas", "Velones", [
        ["Velón #4", "Blanco", "Individual"],
        ["Velón #6", "Blanco", "Colores", "Individual"],
        ["Velón #7", "Blanco", "Individual"],
        ["Velón #8", "Blanco", "Individual"],
        ["Velón #10", "Blanco", "Individual"],
        ["Velón #12", "Blanco", "Colores", "Imágenes", "Individual"],
    ]),
    203: ("Fiesta y velas", "Velones", [
        ["Velón #16", "Blanco", "Individual"],
        ["Velón #18", "Blanco", "Individual"],
        ["Velón #22", "Blanco", "Individual"],
        ["Velón 7 potencias", "Individual"],
        ["Velón envase de vidrio", "Motivos", "Individual"],
    ]),
}

# Categoría para las filas que venían como REVISAR (por rango de páginas del PDF)
REVISAR_A = [
    (276, 276, "Aseo del hogar", "Cepillos"),
    (277, 285, "Aseo del hogar", "Limpieza y lavandería"),
    (286, 291, "Aseo del hogar", "Jabones"),
]

NOTA_PAG = "corregido: reconstruido desde el PDF (pág. {p})"
NOTA_CAT = "categoría asignada (antes REVISAR): validar con el cliente"


def fila_desde_items(pagina, cat, sub, items):
    """Arma una fila con las mismas columnas que el borrador."""
    nombre, resto = items[0], items[1:]
    pres = [x for x in resto if SIZE.search(x) and not PACK.match(x)]
    emp = [x for x in resto if PACK.match(x)]
    otros = [x for x in resto if x not in pres and x not in emp]
    return {
        "pagina_pdf": str(pagina),
        "categoria_propuesta": cat,
        "subcategoria_propuesta": sub,
        "nombre": nombre,
        "marca_o_detalle": " | ".join(otros),
        "presentacion": " | ".join(pres),
        "unidad_venta": " | ".join(emp),
        "texto_original": " / ".join(items),
        "nota_revision": NOTA_PAG.format(p=pagina),
    }


def main():
    with open(ORIGEN, encoding="utf-8-sig", newline="") as f:
        lector = csv.DictReader(f)
        columnas = lector.fieldnames + ["nota_revision"]
        filas = list(lector)

    salida, ya_puestas = [], set()
    for r in filas:
        pag = int(r["pagina_pdf"])
        if pag in CORRECCIONES:
            if pag not in ya_puestas:  # se inserta el bloque corregido una sola vez
                cat, sub, productos = CORRECCIONES[pag]
                salida += [fila_desde_items(pag, cat, sub, it) for it in productos]
                ya_puestas.add(pag)
            continue  # las filas dañadas originales se descartan
        r["nota_revision"] = ""
        if r["categoria_propuesta"] == "REVISAR":
            for desde, hasta, cat, sub in REVISAR_A:
                if desde <= pag <= hasta:
                    r["categoria_propuesta"], r["subcategoria_propuesta"] = cat, sub
                    r["nota_revision"] = NOTA_CAT
                    break
        salida.append(r)

    with open(DESTINO, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=columnas)
        w.writeheader()
        w.writerows(salida)
    print(f"Borrador: {len(filas)} filas -> Corregido: {len(salida)} filas")


if __name__ == "__main__":
    main()
