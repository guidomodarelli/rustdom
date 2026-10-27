# Liberación en la calificación del candidato actual

La preparación oficial usa A/checkpoint067 y B/source5ef668c4, compilados con
Rust1.99.1 para Linux/x64/glibc2.35. La calificación ejecutó las ocho cargas de
ownership sobre cinco copias físicas reales, con Node22.12.0 y24.14.1.
No modifica Rust ni el runtime productivo; vincula el experimento existente a
estos paquetes y sus fuentes completas.

Por Node se ejecutaron40workers y se observaron480Window y480Document,
incluidos120owners de warmup por tipo. Los80endpoints finales —dos por worker—
quedaron claros con ambos tipos de weak reference recolectados por separado.
Los contadores nativos requeridos por el verificador regresaron a su baseline.
`napiClasses.live` conserva22 tanto en baseline como en endpoints: no afirmar
que todas las clases nativas vivas terminaron en cero. Los crudos conservan
también capacidades, reservas y caches, sin confundirlos con nodos vivos.

`current-ownership-qualification.json` registra los rangos de RSS, heapUsed,
external y arrayBuffers por motor y Node en los endpoints después de GC.
Son snapshots de procesos distintos con cargas distintas; no son memoria pico
ni una comparación causal de consumo entre motores. Los rangos no prueban una
fuga, retención creciente o ausencia universal de fugas. Esta calificación
tampoco sustituye los tests específicos de errores de construcción del SDK.

Los505archivos de pruebas, comandos, salidas y estados están en
`reports/validation/native-class-ownership/current-ownership-method/qualification.tar.xz`.
El manifiesto autentica cada miembro por tamaño y SHA256. Las duraciones de
calificación no se usan para aceptar rendimiento. No se ha lanzado la secuencia
prospectiva ni se concede aceptación de ownership desde estos resultados.
