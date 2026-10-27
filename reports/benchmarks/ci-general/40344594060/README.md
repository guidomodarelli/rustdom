# Benchmarks ordinarios del CI 40344594060

Se conservan las cuatro particiones completas del intento 1, cada una con
83 comparaciones: **332 filas**, con 221 medianas de rustdom más lentas y
111 más rápidas que jsdom. Las 20 invocaciones adicionales de contratos
permanecen separadas con su estado original y no reemplazan particiones.

Los cuatro ZIP originales se autenticaron por ID, run, SHA, intento, nombre,
tamaño y digest API. Sus inventarios, logs de jobs, muestras, warmup,
metodología y metadatos originales quedan preservados. Los lectores no
ejecutaron código archivado ni repitieron mediciones.

La fuente observada por los cuatro reportes es el merge real
`88b893a888b5cebd37b532b7a0eeb0c142fab1b6`, con padre de PR
`7148577dcf1eeffda2ebf95a3ccd1eb173a6082b`; se conservan sus metadatos Git.
Node observado: **24.21.0**. Los cuatro reportes declaran el binario nativo
`221d5b65d0f361017f4072ea225ef494f5566fc656d7d4f88a769d332ae9c0c8`.
Máquina, identidad de fuente, errores Git y alcance de cada partición se
conservan en `analysis.json`, sin normalización ni pooling entre hosts.

`all-main-comparisons.csv` calcula explícitamente
`rustdomMedianMs / jsdomMedianMs`: un valor mayor que 1 indica una mediana
rustdom más lenta. El JSON original usa además su propia razón recíproca;
los originales se mantienen intactos. Cada fila conserva ambos conteos de
muestras y ambas medianas, incluidos todos los resultados desfavorables.

Estos son datos descriptivos de workloads sintéticos y runtime híbrido.
No certifican regresiones estadísticas, velocidad de suites completas,
compatibilidad total, memoria pico ni ausencia universal de fugas.
El gate histórico de ownership conserva sus presupuestos y rechazos:
`ownershipPerformanceAccepted=null`, `ownershipGateReevaluated=false`.
