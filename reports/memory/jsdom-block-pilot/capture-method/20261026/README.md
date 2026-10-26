# Recursos del capturador funcional

Se analizan las observaciones originales de los cuatro bloques funcionales del Git Linux
privado `5bd2e200`. El runtime de estos casos es jsdom 27.4.0. No se ejecutó el ELF
Rust ni se midió rendimiento científico. Las épocas anteriores permanecen separadas.

| SDK / fase | RSS antes / medio / después (bytes) | Delta heap usado (bytes) | Primera ronda no clara | Estados finales claros |
|---|---:|---:|---:|---:|
| v22.12.0 / AA | 100032512 / 121245696 / 121384960 | 422064 | 0 | 64 |
| v22.12.0 / AB | 101421056 / 118558720 / 119255040 | 424432 | 0 | 64 |
| v24.14.1 / AA | 125276160 / 175247360 / 175259648 | 1290776 | 5 | 64 |
| v24.14.1 / AB | 136032256 / 192958464 / 198860800 | 1350144 | 10 | 64 |

Los 128 procesos completos observaron 1 536 Window y 1 536 Document por separado.
Hubo **15 primeras rondas no claras**, todas publicadas. Los 256 estados finales
exigidos terminaron claros. Las tres observaciones del padre corresponden a 0,
16 y 32 workers completos. Se conserva el aumento de RSS y heap observado;
estos datos no permiten atribuirlo al allocator, a una fuga ni a una causa concreta.

Los cuatro escenarios de cancelación o muerte forzada terminaron con exit 2,
conservando datos parciales y sin descendientes propios restantes. Son fallos
controlados esperados, no capturas completas. No se rellenan tareas faltantes.

El adaptador de lectura también pasó 64 errores repetidos y comprobaciones reales
de handles con ambos SDK en Windows y Linux; los logs están en la calificación.
Se trata de pruebas finitas. Los snapshots no miden memoria pico, no demuestran
ausencia universal de fugas y no certifican la memoria del runtime Rust.

Fuente y fórmulas verificables en `functional-resource-analysis.json` y `resources.json`.
`performanceAccepted=null`, `gateReevaluated=false`.
