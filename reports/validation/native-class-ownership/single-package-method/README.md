# Validación del método de una copia por proceso

Se verificó el método antes de publicar o activar su secuencia completa.
El arnés final contiene 380 archivos, SHA-256
`fc25f0b60292e1a394ab792acb21a21bfdb6b6e63a6923106367439fc1febbbe`.
`review.json` conserva la revisión estática final de siete archivos y sus
dependencias, sin hallazgos accionables. No es aceptación de rendimiento.

Las once pruebas iniciales pasaron en Node 22.12.0 y 24.14.1, sin skips,
en el snapshot de 379 archivos `36ac3eb5…`. Incluyen cuatro workers reales
por Node con A0, A1, C y J1: cada uno ejecutó las ocho cargas completas.
El sampler y sus settings permanecen idénticos en bytes en el arnés final.

Después se agregó el workflow, su entrada en el inventario del arnés, el export
de verificación de preparación y el caso negativo de paquete alterado.
En el snapshot final se ejecutaron las seis pruebas afectadas por esos cambios
en ambos Node: seis pasan y seis pruebas sin cambios quedan fuera del filtro.
No se presentan esos resultados como doce pruebas ejecutadas de nuevo.
Los logs y las dos instantáneas completas están en el archivo de evidencia.

El contrato negativo real altera `dist/index.cjs` de una copia C y verifica
que el worker falle antes de cargar un runtime o medir. También se prueban
tratamientos inválidos, archivo previo incompatible, conservación de evidencia,
alias hacia la preparación, fuente sin revisión y endpoints falsamente claros.
El CLI completo exitoso y la decisión global solo podrán verificarse con la
secuencia completa futura; no se fabricó un estudio combinando estos fixtures.

`actionlint` pasó. El paso de preflight del YAML real también pasó sobre una
copia local: autenticó ZIP, tar, preparación y arnés. Ese fixture usa el SHA
anterior `1024f769` como metadata explícitamente local; ese commit todavía no
contiene el nuevo método y no se considera aprobación publicada. No ejecutó
la etapa de benchmarks. La concordancia del commit publicado se comprobará
antes de aplicar la etiqueta una sola vez.

Evidencia cruda y hashes: [contratos y fuentes](../../../benchmarks/native-class-ownership/single-package-method/README.md).
`verify-validation.py` recalcula los contadores desde el tar, sin DOM ni GC:

```text
python3 verify-validation.py ../../../benchmarks/native-class-ownership/single-package-method
```

La validación del producto Rust/Jest/Vitest no cambió en este incremento: no se
editaron sus implementaciones. El CI general de `1024f769` estaba ejecutándose
al preparar este reporte; el último conjunto completo confirmado es `429b9240`.
