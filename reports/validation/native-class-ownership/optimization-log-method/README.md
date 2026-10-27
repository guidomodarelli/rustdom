# Calificación del launcher de optimización

Ocho contratos por configuración pasaron: Python Linux con Node22.12.0,
Linux con Node24.14.1 y Python Windows con Node24.14.1. Usan los cuatro
reportes jsdom reales archivados, procesos Node reales y marker exclusivo.
Rechazan filas omitidas, duraciones inválidas, owners retenidos, inventario
de paquetes vacío y publicación inválida antes de crear outputs. Verifican
logs/exit7 y conservación de stdout en disco sin devolverlo al caller.

El preflight auténtico de ambos Node terminó sin workers de tracing. Comprobó
las 387 fuentes congeladas, referencia pública, manifest local, ejecutables,
flags y preparación completa antes/después. Se conservan seis fuentes del
método, snapshot completo del arnés, logs y hashes. No se ejecutó el sampler,
no hay nuevas duraciones DOM y no se consumió el marker de captura.

`qualification-and-history.tar.gz` conserva la tanda final y las dos tandas
previas a los ajustes del transporte de logs e inventario. `raw-files.json`
autentica todos sus archivos; el readback comprobó sus bytes. `summary.json`
y `preflight-index.json` son copias de los resultados finales.

Antes de capturar, autenticar el SHA publicado y las seis fuentes de
`run.py --sources` contra Git/GitHub. Después ejecutar una sola vez la receta
publicada, sin otras suites/builds/reviews/compresión locales. No relanzar
capturas anteriores ni cambiar sus presupuestos. La nueva captura tampoco
aceptará rendimiento. Ownership sigue abierto, sin merge/tag.

Raíz local final `/tmp/rustdom-optimization-method-67qtetar`, terminal.
El input JSON usado está en el tar y en esa raíz. La receta y CLI están en
`reports/benchmarks/native-class-ownership/optimization-log/`.

La revisión encontró que el hash final todavía leía logs completos. Se corrigió
a lectura por bloques de 1 MiB. Una prueba real con archivo de 16 MiB verifica
el hash y exige menos de 3 MiB de heap trazado; pasa en las tres configuraciones.
El control conservado compara la implementación anterior y la nueva: hashes
iguales, picos de 16.782.237 y 2.102.646 bytes en Linux. El pico corresponde al
helper después de importar el módulo y preparar el fixture, no al proceso
completo, RSS, DOM o librerías nativas. Se conservan los crudos y fuentes
anteriores a la corrección dentro de history, sin repetir capturas.
