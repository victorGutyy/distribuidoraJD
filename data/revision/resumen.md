# Resumen de la preparación de la importación

- Filas en el CSV de origen: **1679**
- Productos resultantes: **1597**
- Presentaciones (filas de `importacion_ev.csv`): **1776**
- Marcas distintas asignadas: **27** (102 productos con marca)
- Categorías corregidas automáticamente (atún/conservas → Enlatados): **13** filas
- Presentaciones sin texto de presentación: **551**
- Avisos para revisar a mano: **88** (ver `filas_a_revisar.csv`)

## Cómo revisar las marcas
1. Abre `data/revision/marcas_candidatas.csv` en Excel.
2. En `es_marca (si/no)` escribe **si** o **no** para los valores que quieras corregir
   (y en `marca_normalizada` el nombre correcto si hace falta).
3. Guarda el archivo como `data/marcas_decisiones.csv` (columnas: valor, es_marca, marca_normalizada).
4. Vuelve a ejecutar `python scripts/preparar_importacion.py`.

Los SKU ya asignados (`data/sku_asignados.csv`) **no cambian** al volver a ejecutar.
