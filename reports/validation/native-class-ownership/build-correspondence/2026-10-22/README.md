# Correspondencia entre código compilado, arnés medido e índices de builds

Esta comparación usa datos ya conservados. No carga runtimes, construye paquetes
ni ejecuta tests o mediciones. Los dos alcances canónicos se recalcularon desde
sus bytes reales y coincidieron con las identidades registradas:

- Preparación antigua:333archivos, fuente0d67e1d821c70371ca1b82817870b7ad6a053f534161ae9096591d7199d0b947.
- Arnés medido actual:336archivos, fuente0b4855490382ab18b7e96851dbdef95e7596268690ae169850daf097498687e9.

Las cuatro diferencias canónicas pertenecen a benchmarks: se agregaron
constants/ownership-warmup.cjs, ownership-operations.cjs y ownership-warmup.cjs,
y cambió worker.cjs. Dentro del alcance canónico capturado, src, scripts,
third-party/napi, locks y manifiesto Cargo conservan los mismos bytes.
Los hashes canónicos distintos no describen por sí solos una modificación de Rust.

Los índices oficiales antiguo39720077911 y fresco39872143199 registran:

| Copia | Entradas de archivo por índice | Diferencias de metadata |
| --- | ---: | --- |
| A0/A1 | 569 cada una | Ninguna |
| B | 569 | Solo package.json |
| J0/J1 | 531 cada una | Ninguna |

Las listas y hashes de dependencias también coinciden. Los manifiestos reales
antiguo y actual coinciden con sus entradas respectivas; después de ajustar
exclusivamente scripts.test:compat, todos sus demás valores son iguales. Ese
cambio de manifiesto es independiente de las cuatro diferencias del arnés.

La comparación de distribuciones frescas sigue siendo de metadata autenticada:
no se releyó aquí su árbol físico completo. No se deduce aceptación de rendimiento,
igualdad de ejecuciones, contexto ausente de estudios XML ni elegibilidad nueva.
El estudio original de afinidad sigue su única secuencia sobre el build antiguo.
Una verificación física adicional se realizará después, sin repetir ese estudio.

## Archivos y reproducción

comparison.json conserva todos los resultados y límites; canonical-files.json,
los hashes de cada archivo de ambos alcances. Los inputs originales, manifiestos,
publicación del arnés y productor se copian sin transformar, con hashes en inputs.json.
old-index.json procede de la restauración autenticada del artefacto12400802735;
fresh-index.json es la copia ya publicada en hosted-build-ci/39872143199/.
El ZIP antiguo y los snapshots del arnés permiten reconstruir los inputs sin
recompilar ni ejecutar el producto. producer.py acepta rutas explícitas; el
directorio de salida debe ser nuevo. No usar este reporte para sustituir SUTs o
elegir un estudio favorable. Los negativos anteriores mantienen su decisión.
