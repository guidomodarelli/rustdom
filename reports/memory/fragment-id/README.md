# Memoria de búsquedas por ID en fragmentos

Los 78 escenarios focales aprobaron por separado en Node 22.12.0 y 24.14.1, con jsdom 27.4.0 y rustdom default/VM. Los 52 escenarios previos de colecciones también siguen pasando.

- DocumentFragment separado, template.content y ShadowRoot separado; una vuelta de warmup y tres lotes medidos por combinación, con doce Windows, veinticuatro Element y cuarenta ciclos de mutación/movimiento/consulta por Window.
- Retener el Element encontrado conserva su scope y owner Document. Se observa el Document original y el owner de template.content por separado, junto con Window, host y todos los Element.
- Un miembro removido debe recolectarse mientras su scope sigue retenido; las consultas posteriores no conservan una entrada obsoleta.
- Los casos exclusivos de rustdom retienen solo un ID numérico de la arena real y exigen liberar todos los owners DOM.
- Después de soltar el owner, cada grupo débil y todos los contadores nativos de vida vuelven al baseline en dos muestras claras de GC.

La búsqueda lee enlaces y atributos canónicos prestados. No crea un índice, cache, lista de resultados ni referencias persistentes N-API. Solo devuelve un número; el puente resuelve la implementación original. Los scopes del test están separados de body, cuya limpieza durante Window.close no altera el escenario de retención. La supervivencia de Window se registra separadamente y no se deduce de la de Document.

Estrés general en procesos separados de Node 24, después de warmup y GC:

| Modo | Document supervivientes | Window supervivientes | Δ heap MiB | Δ RSS MiB |
|---|---:|---:|---:|---:|
| jsdom | 0/1762 | 0/882 | 2.76 | 2.34 |
| rustdom | 0/1762 | 0/882 | 1.97 | 29.83 |
| native | 0/0 | 0/0 | 0.02 | 0.25 |
| vitest | 0/1760 | 0/880 | 4.10 | 25.80 |
| vitest-vm | 0/1760 | 0/880 | 3.73 | 42.95 |

Memcheck ejecutó 291 tests Rust en 10 lotes: cero errores y cero bytes perdidos definitiva/indirectamente. Conserva 48–48 bytes posibles y 548–548 bytes alcanzables por proceso.

Los stacks residuales de std::thread/current, el contexto mpmc del harness y stack_overflow/thread_info permanecen visibles. El control anterior de 285 tests en nueve procesos conserva los mismos 48/548 bytes. La comparación de hashes, inventarios y duraciones está en ../../validation/fragment-id/native-memory-baseline-comparison.json. Los seis tests nuevos cambian la composición y añaden un lote: sus tiempos son diagnóstico, no muestras equivalentes de rendimiento.

Memcheck cubre el ejecutable Rust; GC usa el addon real en Node. Heap, external y RSS se miden después de GC y no representan picos. El allocator puede conservar RSS. Las pruebas finitas no demuestran ausencia absoluta de fugas ni auditan todas las dependencias.

[Inventario y trazas originales](../../validation/fragment-id/evidence.json).
