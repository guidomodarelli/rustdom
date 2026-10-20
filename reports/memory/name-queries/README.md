# Memoria de Document.getElementsByName

Los 52 escenarios focales aprobaron por separado en Node 22.12.0 y 24.14.1, comparando jsdom 27.4.0 y rustdom default/VM. Se conservan los 44 escenarios previos y se agregan ocho para NodeList por nombre.

- Ciclos de creación, mutación, consulta, cierre y liberación; Document y Window se observan por separado.
- Una NodeList por nombre retenida conserva sus owners; al soltarla se exige cero supervivientes y contadores de vida nativos de vuelta al baseline.
- Un miembro removido se recolecta mientras la lista, su documento y su padre siguen retenidos. Se lee la lista para refrescar su invalidación perezosa antes de observar GC.
- El fixture de retención vive en head: Window.close limpia body en HTML/quirks. Seis contratos públicos independientes comparan ese cierre con jsdom; XML conserva el contenido observado por su lista.
- Los controles anteriores de children, form.elements, resultados numéricos y factories alterados siguen activos.

Rust devuelve identificadores numéricos y presta los valores de atributos canónicos durante el filtro. No agrega caches, referencias persistentes N-API ni owners nativos. El puente proyecta los IDs sobre las implementaciones originales y la NodeList conserva sus referencias visibles a V8. A diferencia de HTMLCollection, esta ruta no retiene un transporte numérico auxiliar.

Estrés general en procesos separados de Node 24, después de warmup y GC:

| Modo | Document supervivientes | Window supervivientes | Δ heap MiB | Δ RSS MiB |
|---|---:|---:|---:|---:|
| jsdom | 0/1762 | 0/882 | 2.82 | 0.13 |
| rustdom | 0/1762 | 0/882 | 1.97 | 17.51 |
| native | 0/0 | 0/0 | 0.02 | 0.13 |
| vitest | 0/1760 | 0/880 | 4.09 | 25.16 |
| vitest-vm | 0/1760 | 0/880 | 3.72 | 30.35 |

Memcheck ejecutó 285 tests Rust en 9 lotes: cero errores y cero bytes perdidos definitiva/indirectamente. Se conservan 48–48 bytes posibles y 548–548 bytes alcanzables por proceso.

Los stacks residuales corresponden a std::thread/current, el contexto mpmc del harness y stack_overflow/thread_info. Los mismos 48/548 bytes aparecen en los nueve procesos del control anterior de 281 tests. La comparación de inventarios, hashes y duraciones está en ../../validation/name-queries/native-memory-baseline-comparison.json. Cambia la composición de los lotes: sus tiempos son diagnóstico, no muestras equivalentes de rendimiento.

Memcheck cubre el ejecutable Rust; GC ejerce el addon real dentro de Node. Heap, external y RSS son muestras después de GC, no memoria pico. El allocator puede conservar RSS. Las pruebas finitas no demuestran ausencia absoluta de fugas ni auditan todas las dependencias.

[Inventario y trazas originales](../../validation/name-queries/evidence.json).
