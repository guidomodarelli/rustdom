# Ensayo seeded completo: verificado y rechazado

La secuencia original terminó en ambos Node y no se repitió. La verificación
original y la de una copia en otro directorio producen exactamente el mismo
resultado: `verified=true`, `accepted=false`. Los 256 workers terminaron con
exit0; ambos padres terminaron con exit1 por presupuesto y el driver de
verificación con exit0 por integridad. No se acepta ownership ni se concede tag/merge.

| Node | Workers completos | Tiempos medidos | Controles jsdom fuera de ±2% |
| --- | ---: | ---: | ---: |
| 22.12.0 | 128 | 9216 | 2 |
| 24.14.1 | 128 | 9216 | 2 |

| Node | Fase | Carga | Cambio del control jsdom (%) | Cambio Rust (%) |
| --- | --- | --- | ---: | ---: |
| 22 | AB | mutation-records-collect/1000 | +2.9466 | -0.3336 |
| 22 | AB | range-control-1000/250 | +2.4158 | -2.0242 |
| 24 | AA | observer-delivery-records/100 | -3.1520 | +0.3586 |
| 24 | AB | observer-delivery-records/1000 | +2.7298 | +0.5823 |

Son los cuatro controles rechazados. Las 32 filas resumen completas están en
summary.json y receipt.json; todas las muestras originales permanecen en el tar.
Ninguna cifra Rust excede su presupuesto numérico, pero los controles fallidos
impiden utilizar el conjunto como aceptación de rendimiento. No se comparan
estudios diferentes para afirmar una mejora ni se seleccionan filas favorables.

## Método y alcance

Se ejecutaron las ocho cargas públicas, 16 posiciones, cuatro factores, fases
AA/AB, una copia física por proceso, tres warmups y nueve muestras por lote.
El calentamiento del realm actual conserva tres rondas después de los mismos
GCs previos. Las semillas 1..16 se fijaron antes del estudio para ambos motores
y etiquetas; sus prefijos RNG reales coinciden en cada grupo. No se desactivó
el JIT, la compilación concurrente ni el GC natural. hash-seed puede estar
limitado por snapshots de V8; no se presupone control de toda su entropía.

Las fuentes medidas son las 409 publicadas en
[737a2ba1](https://github.com/guidomodarelli/rustdom/commit/737a2ba1c2cf5994561c3b739232f5e3cb6fb257),
SHA del arnés 7ab4948d4f717b0cc7eaeb7c5e127f28e8417c63f667ed955a341c1fbb071981.
Los índices conservan hardware WSL2, CPU, memoria, versiones y fechas; cada
worker registra afinidades antes/después, heap limit y flags efectivos. El método
configura CPU2 en el hilo principal y registra las máscaras de los demás hilos.
Este arnés mide el DOM híbrido existente y no
implementa algoritmos nuevos en Rust ni certifica compatibilidad completa.

## Evidencia y reproducción

study.tar.gz conserva 2033 archivos originales y auxiliares, con readback de
cada miembro: 38684023 bytes, SHA-256
39299c4ae809e5a4386a9963f2c35dde657e188404012ed46c8824c26be5a10f.
raw-files.json identifica sus miembros; receipt.json conserva el resultado
original completo y los datos del archivado. No se modifica el tar para añadir
reportes derivados. Se mantienen los estudios anteriores y sus rechazos.

El bundle incluye fuentes, manifests, stdout/stderr, PIDs, códigos de salida,
verificación offline, lecturas diagnósticas de las 16 filas Node22 y ambos ZIP
XML del CI: el aprobado dd75 y el posterior rechazado a099. Esos datos CI no
aprueban ownership. Los agrupamientos diagnósticos por factores/copia física
no cambian el estimador original ni prueban causalidad.

Para reproducir solo la verificación, extraer el tar en un directorio nuevo y
ejecutar Node24 sobre
seeded-pre-gc/study/harness/reports/benchmarks/native-class-ownership/seeded-pre-gc-experiment.cjs
con --verify-set y las carpetas seeded-pre-gc/study/node-22 y node-24. No se
necesita ejecutar DOM ni recolectar tiempos. El proceso original y el relocado
están guardados en el bundle. analyze.py deriva summary.json y el JSON de memoria
con --study (esa raíz study), --output (este directorio con receipt.json) y
--memory (archivo JSON de destino); no sobrescribe resultados distintos.

Las observaciones finitas de memoria y sus límites están en
reports/memory/native-class-ownership-seeded-pre-gc-2026-10-22.md y su JSON.
Antes de cualquier contraste distinto deben revisarse estos resultados.
