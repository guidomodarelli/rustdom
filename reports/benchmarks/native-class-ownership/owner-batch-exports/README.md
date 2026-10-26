# Exportación autenticada de tareas y recursos

Este lector procesa los archivos íntegros ya conservados. No ejecuta
DOM, no captura muestras nuevas y no modifica el estimador, los presupuestos ni el
método `ownership-owner-batch-serial-v1`. El run40234774968 permanece congelado en
504ebc36. Este lector se publica fuera del grafo del productor. El resultado
científico completo ya se reprodujo con ambos SDK: captura autenticada y rechazo
numérico, con 42/64 criterios cumplidos. Los dos comandos devolvieron 1 por ese
rechazo, conservando la decisión completa y tablas idénticas.

`export.py` exige un SDK Linux fijado por SHA antes de ejecutarlo. `invoke.cjs`
reutiliza el controlador existente de grupos de procesos, timeout y teardown para
ejecutar el lector actual `decision.cjs`. Este valida la colección contra el binding
externo, API conservada, ZIP, tar, catálogo, recibo y datos. El binding debe proceder
de una colección independiente autenticada: el exportador no atribuye procedencia
de GitHub a un binding arbitrario escrito por el caller. No importa scripts del tar.

Las tablas se leen directamente de los tar autenticados, con hashes antes/después
y correspondencia con los resultados verificados. Los módulos Python del formateador
se ejecutan desde bytes actuales mediante `runpy`, ignorando bytecode obsoleto. Se
rechaza Python optimizado antes de cualquier acceso a archivos o comandos.

## Unidades y tablas

Cada archivo CSV se conserva completo en gzip, sin timestamp ni nombre variable
en la cabecera. Se usan tablas distintas para tareas, bloques, procesos, cleanup,
contadores nativos y snapshots parentales. Las claves incluyen SDK productor,
fase, engine, etiqueta, distribución física, posición y fila. PID y secuencia se
conservan; la secuencia sale del índice original, no del orden de miembros del tar.

Las144 duraciones medidas pertenecen a UNA media de proceso; no son144 réplicas
independientes. Se mantienen las48 duraciones externas de warmup y los12 bloques,
con las tres rondas internas declaradas. Esas rondas internas no tienen duración
registrada: no se inventan tiempos. Las medias por bloque/proceso se copian del
lector validado, sin recalcular el estimador. Los timestamps de `performance.now()`
son locales a cada proceso; no se unen cronologías entre PIDs o hosts.

Los datos funcionales contienen solo los32 workers del controlador por SDK, AB y
posición0. Los otros reports de calificación del worker siguen íntegros en el ZIP
original y no se suman a ese denominador. El modo funcional mantiene aceptación
nula y no produce comparaciones científicas. No puede promoverse con `--verify`.

Cuando existe una decisión científica completa, se conserva también el objeto
íntegro de las64 comparaciones, incluidos controles rechazados, intervalos inválidos
y regresiones. El caso completo se probó con el resultado genuino del run
40234774968. Un resultado incompleto conserva la decisión, logs, tar y datos
materializados, pero no publica tablas como si estuvieran completamente verificadas.

## Memoria y límites

Window y Document se presentan por separado en las tres rondas. No se filtran
primeras rondas no claras. jsdom no tiene estadísticas Rust: no se fabrican filas
nativas ni ceros. Los contadores booleanos conservan `true`/`false`; su delta es
no aplicable y queda vacío. Los deltas numéricos usan el baseline nativo del mismo
proceso. Capacidades retenidas y contadores acumulados no implican una fuga por
tener delta no nulo. Los snapshots tras GC no miden memoria pico ni demuestran
ausencia universal de fugas. El runtime del proyecto sigue híbrido.

## Evidencia y publicación

La salida conserva la decisión original sin modificaciones, las tablas, hashes,
identidades reales del productor y lector, versiones de Python/zlib y límites.
El manifiesto se escribe antes de publicar atómicamente el resumen definitivo;
un fallo tardío no deja un resumen completo sin su manifiesto. La identidad local
del lector es Git f781 con WIP real, distinta del productor e789/504 de GitHub;
no se normaliza ni se presenta como checkout publicado limpio.

La QA usa los ZIP/API/tar reales de40224283558 y40232234553. Los valores se
contrastan con salidas de un lector independiente ya publicadas y con reportes
originales. La prueba de bytecode crea una copia propia del formateador y un
marcador inocuo como control adversarial; no sustituye bibliotecas de plataforma
ni el SDK. Los dos Node reales y los lectores auténticos se ejecutan en todos los
casos de integración. Se conserva el código exacto de cada etapa de QA como datos
de auditoría; esos archivos de código no se usan para ejecutar el análisis.

La publicación de este tooling no representa avance de implementación DOM en
Rust. No se crea tag ni se mergea ownership sin aceptación e integración probadas.

## Reproducir la lectura completa

Usar un checkout Git Linux real con este código actual, Python sin `-O` y los
binarios oficiales de Node 22.12.0 / 24.14.1. Sus hashes se validan antes de
ejecutarlos. Poner también el Python elegido en `PATH`: el lector invoca
`python3`. No ejecutar scripts contenidos en los archivos descargados.

Desde la raíz del checkout, con `NODE` apuntando al SDK elegido:

```sh
RESULTS=reports/benchmarks/native-class-ownership/owner-batch-study-results/40234774968
COLLECTION="$RESULTS/transport"
python3 -B reports/benchmarks/native-class-ownership/owner-batch-exports/export.py \
  "$NODE" --verify "$COLLECTION/authenticated-binding.json" "$COLLECTION" \
  /tmp/rustdom-owner-batch-reader-new
```

El directorio de salida debe ser nuevo y estar fuera del checkout y de la
colección; reservar al menos 1.8 GB por lector para la materialización. Usar otra
ruta nueva para el segundo SDK. La salida esperada es `complete=true`,
`performanceAccepted=false`, `gateReevaluated=true` y exit code 1. Un exit code
aislado no distingue rechazo de integridad o rendimiento: revisar siempre la
decisión y el resumen. Los logs reales, decisiones, tablas y preservación de ambos
lectores están en `reports/validation/owner-batch-complete-replay/40234774968/`.
