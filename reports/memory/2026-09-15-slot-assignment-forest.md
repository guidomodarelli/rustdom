# Identidad débil del bosque del driver de slots

El fix del PR #43 vincula `AssignmentDriver` al primer `TreeStore` mediante
`Weak<()>`. Cada bosque posee su token `Arc<()>`; el token no contiene el árbol
ni referencias JavaScript. La identidad resiste movimientos del store y evita
confundir handles iguales de bosques independientes. Un cambio de bosque o un
origen destruido produce `SlotAssignmentProtocol`/`InvalidArg`, cancela el driver
y libera el plan pendiente antes de acceder a los handles del receptor.
Los pasos completados permanecen inertes.

## Reproducción y validación

La regresión Rust `should_reject_a_different_forest_with_matching_handles_before_committing`
falló antes del guard (el segundo bosque aceptaba el plan) y pasó después.
Los 8 tests Rust del driver verificaron candidatos capturados, prefijos aplicados,
error/cancelación, identidad tras mover el árbol y destrucción del origen.
La prueba N-API cubre slots y subárboles después de `Signal` y `Applied`, con
handles iguales, sin mutar el receptor ni revertir commits aceptados.

Comando de memoria: `node --test tests/slot-assignment-driver.spec.cjs`.
El test lanza el addon release real con `node --expose-gc`
y `tests/helpers/slot-assignment-driver-memory.cjs`.
Entorno: WSL Ubuntu 22.04, Node v24.14.1, Rust 1.98.1, jsdom 27.4.0 fijado en lockfile.

## Método y resultado

[Las muestras crudas](2026-09-15T13-15-35.645Z-slot-assignment-driver.json)
conservan los intentos de GC, survivor counts, contadores nativos y
`process.memoryUsage()` (heap, external, RSS y ArrayBuffers).
Se ejecutaron 5 ciclos con estados `complete`, `pending` y `cancelled`, tanto
para ventanas reales cerradas como para `NativeTree` independientes soltados.
Los 30 drivers se mantuvieron retenidos hasta terminar todas las observaciones.
Cada endpoint exige dos muestras claras en turnos distintos y usa un límite de
12 rondas/10 segundos; cada ronda drena callbacks y hace dos major GC asíncronos.

Los 15 `NativeTree` y los 15 conjuntos de Document, Window y nodos se recolectaron
sin supervivientes; todos los endpoints fueron alcanzados. Tras soltar los
drivers, su contador nativo quedó `live: 0` (`created: 60`, `released: 60`,
incluyendo drivers internos del bridge).

| Endpoint | heapUsed (bytes) | external (bytes) | RSS (bytes) |
| --- | ---: | ---: | ---: |
| Primer bosque independiente recolectado | 29506112 | 3042851 | 120078336 |
| Último bosque independiente recolectado | 31060736 | 3042851 | 122044416 |
| Drivers liberados | 31059032 | 3042851 | 122044416 |

La diferencia de heap/RSS incluye las muestras y reportes retenidos por el propio
proceso de medición; no se interpreta como una fuga ni como memoria pico.
La prueba Rust comprueba además que el token del origen expira cuando se destruye
el store mientras el driver continúa vivo. La prueba GC confirma la finalización
nativa del origen al rechazar su reanudación por origen liberado.
Esto demuestra liberación en los escenarios finitos descritos, no ausencia
absoluta de fugas ni certificación de compatibilidad DOM completa.
