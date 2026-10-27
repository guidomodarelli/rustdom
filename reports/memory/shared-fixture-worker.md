# Memoria de la integración funcional del worker

Se ejecutó una vez la matriz derivada: Node 22.12.0 y 24.14.1, cinco paquetes
físicos autenticados y ocho cargas originales por paquete. El runtime híbrido
B sigue en source5ef; J0/J1 son jsdom independiente 27.4.0. No se modificó el
runtime ni se repitió un estudio consumido. El nuevo worker sí invocó el sampler
real como calificación funcional, sin aceptación de rendimiento.

80 procesos observaron por WeakRef 960 Window y 960 Document por separado.
Se conservaron las nueve primeras rondas no claras. Los 160 estados finales
requeridos, en dos turnos por proceso, quedaron liberados. Las seis agrupaciones
Rustdom preservan napiClasses.live=22, igual al baseline propio de cada proceso.

| Node / paquete | Window | Document | Primera ronda no clara | Estados finales claros | RSS observado (MiB) |
| --- | ---: | ---: | ---: | ---: | ---: |
| v22.12.0/J0 | 96 | 96 | 2 | 16 | 128.1–156.7 |
| v22.12.0/J1 | 96 | 96 | 1 | 16 | 131.7–158.5 |
| v22.12.0/A0 | 96 | 96 | 2 | 16 | 149.0–189.3 |
| v22.12.0/A1 | 96 | 96 | 2 | 16 | 145.1–189.1 |
| v22.12.0/B | 96 | 96 | 2 | 16 | 146.3–189.6 |
| v24.14.1/J0 | 96 | 96 | 0 | 16 | 146.7–259.1 |
| v24.14.1/J1 | 96 | 96 | 0 | 16 | 148.6–261.8 |
| v24.14.1/A0 | 96 | 96 | 0 | 16 | 154.3–286.5 |
| v24.14.1/A1 | 96 | 96 | 0 | 16 | 156.8–286.1 |
| v24.14.1/B | 96 | 96 | 0 | 16 | 154.9–286.2 |

Los JSON crudos conservan todas las rondas, baselines, contadores nativos y
snapshots RSS/heapTotal/heapUsed/external/arrayBuffers. El endpoint original
compara categorías nativas contra el baseline; no se afirma que todo esté en cero.
Los 960 spans y sus 240 warmup permanecen en el archivo y en spans.csv.

Se mantienen las tres rondas originales de GC y dos estados finales claros;
no se sumaron rondas para conseguir el resultado. La calificación usa un solo
seed/posición y cada proceso carga solo un paquete. No estima ratios ni
presupuestos. Los snapshots no representan memoria pico ni ausencia universal
de fugas, y las diferencias entre paquetes o con otros tests no constituyen
comparaciones A/B de memoria o de rendimiento.

Host: 13th Gen Intel(R) Core(TM) i7-1360P, 16 procesadores lógicos,
8095191040 bytes de RAM, Linux 6.6.87.2-microsoft-standard-WSL2 (WSL2).
Identidad, afinidades, flags, RNG, módulos cargados y salidas públicas originales
están en reports/validation/native-class-ownership/shared-fixture-worker/.
Dos lectores actuales y 15 contratos por Node pasaron sin ejecutar nuevamente DOM.
