# Memoria de las lecturas de atributos

Los 32 escenarios por Node 22.12.0/24.14.1 aprobaron. Se observan Document, Window, Element y Attr por separado: los endpoints de liberación quedaron sin supervivientes y los contadores nativos regresaron al baseline. Los casos con Attr retenido conservan deliberadamente sus owners mientras siguen accesibles; después de soltarlo se exige la liberación. Un string devuelto, incluido el UTF-16 largo, puede permanecer vivo sin retener el DOM original.

Por engine/realm se ejecuta un warmup y tres lotes medidos de doce ventanas, 32 Attrs por owner y 64 ciclos de modificación/lectura/ausencia. Se prueban jsdom y rustdom, con realms default y VM, además de strings y Attr retenidos. Cada endpoint exige dos muestras claras en turnos separados tras GC mayor; los intentos completos se guardan. Los tests raw también conservan strings después de liberar sus nodos y verifican ownership tras errores.

Las nuevas operaciones solo toman prestado el valor canónico durante la llamada y lo copian a V8 mediante el conversor compartido. No agregan caches, referencias persistentes ni owners en Rust. La ruta UTF-16 preserva NUL y surrogates aislados; el índice de aliases existente mantiene su liberación.

Los cinco modos generales de memoria pasaron en v24.14.1. Document y Window son observaciones independientes; close() por sí solo no demuestra su recolección.

| Modo | Document supervivientes/observados | Window supervivientes/observadas | Delta heap MiB | Delta RSS MiB |
|---|---:|---:|---:|---:|
| jsdom | 0/1762 | 0/882 | 2.75 | 2.11 |
| rustdom | 0/1762 | 0/882 | 1.98 | 14.30 |
| native | 0/0 | 0/0 | 0.02 | 0.13 |
| vitest | 0/1760 | 0/880 | 4.10 | 25.62 |
| vitest-vm | 0/1760 | 0/880 | 3.73 | 30.73 |

Memcheck aprobó los 305 tests Rust en 10 lotes exactos y acotados, con cero errores y cero pérdidas definitivas/indirectas. Registra 48 bytes posibles y 548 alcanzables por proceso al salir. Se guardan todos los logs y stacks, sin ocultar esos residuos. Su scope es el ejecutable de tests Rust; no analiza V8 ni el addon cargado por Node. El addon real queda ejercitado por los contratos, runners, estrés y escenarios GC.

La evidencia finita no prueba ausencia absoluta de fugas. RSS puede conservar memoria del allocator; se registran heap, memoria externa, ArrayBuffers y RSS por muestra, sin confundir memoria retenida con pico. Ver [validación e identidades](../../validation/attribute-reads.md), [evidencia](../../validation/attribute-reads/evidence.json) e históricos completos en history/.
