# Memoria de los fixtures candidatos con métodos compartidos

Calificación funcional final en Node 22.12.0 y 24.14.1, con jsdom J0 27.4.0
y rustdom híbrido B/source5ef de la preparación oficial autenticada.
Se ejecutaron las ocho cargas/tamaños originales, dos ciclos por carga,
más error de validación, carga inválida y cancelación de entrega encolada.

Los tests mantienen deliberadamente referencias a fixtures descartados y
a promesas de entregas canceladas. Se observaron 76 Window y 76 Document
por separado, antes de salir de los procesos. Se conservaron 58 primeras
rondas no claras y 152 estados finales requeridos claros en turnos distintos.

| Node / runtime | Window | Document | Primera ronda no clara | Estados finales claros | RSS observado (MiB) |
| --- | ---: | ---: | ---: | ---: | ---: |
| v22.12.0/jsdom | 19 | 19 | 13 | 38 | 166.5–201.6 |
| v22.12.0/rustdom | 19 | 19 | 15 | 38 | 186.7–201.6 |
| v24.14.1/jsdom | 19 | 19 | 15 | 38 | 182.4–294.7 |
| v24.14.1/rustdom | 19 | 19 | 15 | 38 | 281.3–294.7 |

Los baselines nativos originales y cada ronda están en los JSON finales
`reports/validation/native-class-ownership/shared-fixture-candidate/node*-attempt5.json`.
El helper existente comprueba liveness de nodos, observers, records,
notificaciones, Range, referencias y demás categorías nativas contra esos
baselines. `napiClasses.live=22` al finalizar coincide con el baseline;
no se afirma que todos los recursos nativos estén en cero.

El JSON de este informe conserva todos los rangos RSS, heapTotal, heapUsed,
external y arrayBuffers. Son snapshots tras GC, no memoria pico. El orden
de tests y la retención del allocator impiden interpretarlos como A/B
de consumo. Estas observaciones finitas no prueban ausencia universal de
fugas ni sustituyen el análisis del resto de rustdom.

Las versiones anteriores de la calificación y sus fallos se conservan
por separado. No se suman al total final ni se reutilizan como evidencia
de rendimiento. El host fue WSL2 x64, Intel i7-1360P, 16 procesadores
lógicos y 8095203328 bytes de RAM; host.json registra la metadata recogida
después de los tests en la misma máquina. La variante no está integrada
al sampler congelado; performanceAccepted=null y ownership sigue rechazado.
