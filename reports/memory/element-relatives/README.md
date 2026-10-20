# Memoria de hijos y hermanos Element

Los 44 escenarios focales aprobaron en Node 22.12.0 y 24.14.1, comparando jsdom 27.4.0 y rustdom en default/VM. Se conserva el historial de 30/40 escenarios.

- Ciclos de creación, mutación, consulta, cierre y liberación; Document y Window se observan por separado.
- Una colección children retenida conserva sus owners; después de soltarla se exige cero supervivientes.
- Un hijo removido se recolecta mientras la colección y su padre/documento siguen retenidos.
- Retener solo IDs/nombres de descendientes, children y form.elements permite recolectar todos los owners DOM. Se conservan los controles con Float64Array.from alterado.
- Los contadores nativos de vida vuelven al baseline; los acumulativos de operaciones son diagnóstico.

El núcleo recorre enlaces y metadatos existentes. No agrega caches, refs persistentes N-API ni owners nativos. Los resultados numéricos no retienen nodos. La lista viva conserva sus referencias visibles a V8; la invalidación existente puede refrescar children durante la mutación. childElementCount continúa observando esa lista.

Estrés general en procesos separados de Node 24, después de warmup y GC:

| Modo | Document supervivientes | Window supervivientes | Δ heap MiB | Δ RSS MiB |
|---|---:|---:|---:|---:|
| jsdom | 0/1762 | 0/882 | 2.83 | 2.45 |
| rustdom | 0/1762 | 0/882 | 1.97 | 15.53 |
| native | 0/0 | 0/0 | 0.02 | 0.13 |
| vitest | 0/1760 | 0/880 | 4.10 | 23.99 |
| vitest-vm | 0/1760 | 0/880 | 3.72 | 30.51 |

Memcheck ejecutó 281 tests Rust en 9 lotes: cero errores y cero bytes perdidos definitiva/indirectamente. Los logs conservan 48–48 bytes posibles y 548–548 bytes alcanzables por proceso; sus stacks siguen visibles.

Los stacks residuales corresponden a std::thread/current, el contexto mpmc del harness y stack_overflow/thread_info. Los mismos 48/548 bytes aparecen en los nueve procesos del control anterior de 275 tests; la comparación de ambos inventarios y duraciones se conserva en native-memory-baseline-comparison.json. Los lotes cambiaron de miembros y sus tiempos son diagnóstico, no un benchmark equivalente.

Memcheck cubre el ejecutable Rust; GC ejerce el addon real dentro de Node. Heap, external y RSS son muestras después de GC, no picos. RSS puede conservar memoria del allocator. Las pruebas finitas no demuestran ausencia absoluta de fugas ni auditan todas las dependencias.

[Inventario y trazas originales](../../validation/element-relatives/evidence.json).
