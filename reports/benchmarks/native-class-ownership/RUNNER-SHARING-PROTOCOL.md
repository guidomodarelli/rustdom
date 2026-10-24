# Diagnóstico del módulo de medición compartido

Estado: preparación; no se ejecutó la secuencia diagnóstica. No acepta ningún
presupuesto ni reemplaza los experimentos V1/C, que conservan accepted=false.

## Hipótesis y límite

El runner pareado carga dos paquetes independientes, pero llama a la misma
función measure de benchmarks/worker.cjs desde ambos adaptadores. El diagnóstico
offline de C encontró que el primer lote jsdom Node22 A/A range-control-1000/250
fue más lento en siete de ocho procesos. Eso no identifica una causa.

Se investigará si compartir el módulo de la carga contribuye a cambios observables
en las trazas de optimización/desoptimización de V8 y al patrón de orden de lotes.
Se comparan un único módulo compartido y dos copias de código idéntico e independientes,
con imports normales de CommonJS. No se modifica ni reescribe la carga medida.
La separación abarca 53 archivos: 52 bajo benchmarks y el helper de lectura
de archivos DOM. Las dependencias de plataforma de Node siguen compartidas.

Solo se usa jsdom A/A, nunca el candidato Rust C. Una diferencia entre brazos no
demostraría que ese mecanismo explique los estudios anteriores, ni resolvería por sí
sola el presupuesto Rust. El diagnóstico está instrumentado y sus tiempos no son
evidencia de rendimiento de producción. Un resultado negativo también se conserva.

## Diseño fijado antes de observar resultados

Una secuencia por Node, primero 22.12.0 y después 24.14.1. Cada secuencia ejecuta
16 procesos: posiciones 0..7, con brazos shared/independent. El orden de brazos
se invierte según la paridad de los tres bits de posición: cada brazo lidera dos
veces dentro de cada valor de cada factor. Se conserva el balance original de carga de paquetes,
asignación J0/J1 y orden de lotes. Por proceso: dos lotes completos de la fila señalada,
tres warmups y nueve muestras por lote. En total: 32 procesos y 576 duraciones medidas,
además de los warmups cuyas duraciones descarta el worker original.

La fila mantiene exactamente fixture, 1.000 operaciones públicas, comprobaciones,
serialización/checksum y teardown originales. Se conserva afinidad del hilo principal
a CPU2, hilos auxiliares con máscaras más amplias, tres rondas de limpieza y dos
endpoints finales claros para Window y Document por separado.

Flags idénticos para ambos brazos: --expose-gc --trace-opt --trace-deopt
--trace-file-names. Stdout conserva trazas V8 y marcadores fuera del cronómetro:
inicio de lote, retorno de measureWorkload y fin de limpieza. Esos marcadores
delimitan lotes completos; no ubican eventos dentro de una muestra o del warmup.
No se atribuye causalidad a una coincidencia entre eventos y marcadores.

No hay decisión calibrated/accepted ni nuevo estimador de aceptación. Se publican
las duraciones completas, orden, trazas y diferencias descriptivas por proceso,
incluidos resultados contrarios a la hipótesis. No se omiten posiciones, no se
alteran umbrales de estudios previos y no hay repeticiones adaptativas.
Un error de ejecución o integridad conserva el parcial y detiene la secuencia.

## Integridad y publicación

Los dos jsdom conservan sus pins completos originales de lib/package.json,
versión 27.4.0; sus dependencias transitivas compartidas mantienen el límite del
método anterior. Cada copia del harness tiene SHA256
c3708ad1f9d18e92d9fd384621dbdb0b7dd46eb5ba66d9753e856ca9153c6fec.
Paquetes y copias se verifican antes y después de cada proceso. El driver conserva
snapshot del harness completo, fuentes canónicas, entrada, reporte y stdout/stderr,
estado del proceso y todos los endpoints de limpieza.

Antes de ejecutar la secuencia, publicar el método, terminar sus contratos reales
en ambos Node y obtener revisión local completa del código. Registrar el SHA publicado,
huella del harness y recibo de esa revisión. La falta de cuota de review remota se
declara explícitamente; una revisión local no la sustituye para mergear el PR.

Comando por Node, con paquetes independientes ya preparados:

```sh
node reports/benchmarks/native-class-ownership/runner-sharing-diagnostic.cjs \
  /ruta/manifest.json /ruta/salida-nueva /ruta/provenance.json
```

La secuencia no construye ni modifica paquetes congelados, no migra APIs y no
habilita merge/tag. Sirve para decidir el siguiente cambio comprobable del runner.
