# Recursos de collapse nativo: matriz hospedada

Run40128890776, intento1, head da0f4f80. Se conservan seis artifacts originales
con API, ZIP, logs y manifiestos completos en
`reports/validation/native-class-ownership/range-collapse-hosted/40128890776/`.
Cada resultado se leyó offline con Node22.12.0 y24.14.1: los dos replays de cada
perfil son idénticos. Los lectores actuales no ejecutan DOM ni código archivado.

Cada proceso de recursos realizó seis ciclos con32Range y32clones por ciclo,
alternando owners iguales/distintos, collapse, mutación y cierre. Las WeakRef
observan Window, Document, wrappers Range y estado NativeRange por separado.
Un Range retenido intencionalmente mantiene un endpoint negativo antes de
soltarlo y exigir dos observaciones claras consecutivas. Los JSON conservan
cada traza original y el baseline nativo completo de su proceso, incluidos
napiClasses.live=22 y rangeStates.live=0. No se sustituye por un baseline vacío.

| Perfil | Window / Document | Range / NativeRange | Retenidos / finales claros | Primera liberación no clara | RSS observado, bytes |
| --- | --- | --- | --- | ---: | --- |
| linux-node22 | 6 / 6 | 384 / 384 | 12 / 12 | 0 | 123432960..124309504 |
| macos-node24 | 6 / 6 | 384 / 384 | 12 / 12 | 0 | 124026880..125272064 |
| windows-node22 | 6 / 6 | 384 / 384 | 12 / 12 | 0 | 111333376..111800320 |
| macos-node22 | 6 / 6 | 384 / 384 | 12 / 12 | 0 | 125386752..125960192 |
| windows-node24 | 6 / 6 | 384 / 384 | 12 / 12 | 0 | 112713728..114348032 |
| linux-node24 | 6 / 6 | 384 / 384 | 12 / 12 | 0 | 124661760..126103552 |

Los seis perfiles regresan al baseline nativo comprobado; cada uno conserva
12endpoints negativos y12finales claros. Los contadores de creación y liberación
de Range aumentan384 por perfil. Los rangos RSS, heapTotal, heapUsed, external y
arrayBuffers se publican sin seleccionar únicamente valores favorables.
No se suman los doce replays como doce nuevas capturas: son seis procesos reales
leídos dos veces. Las pruebas finitas no demuestran ausencia universal de fugas.
Son snapshots tras GC, no memoria pico; tampoco identifican por sí solos
retención del allocator frente a una fuga ni cubren todos los eventos/timers/caches.

El ELF Linux43410883 es idéntico en los artifacts Node22 y24 y diferente del
addon local26ba8690. macOS produce918667ff en ambos Node. Windows conserva
ambos PE distintos: e29a63db en22 y53ec979d en24. No se presentan binarios
Windows diferentes como si fueran uno solo.

El runtime sigue híbrido. Esta evidencia funcional mantiene
performanceAccepted=null y gateReevaluated=false; no acepta rendimiento,
no reemplaza los rechazos históricos y no habilita tag ni merge de ownership.
