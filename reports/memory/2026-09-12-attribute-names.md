# Memoria al deduplicar nombres de atributos

La corrección agrega un `HashSet` temporal que toma prestados slices UTF-16 del vector de nombres. El conjunto se destruye antes de filtrar el vector; las decisiones booleanas se destruyen al retornar. No se agregan campos al árbol, caches persistentes, referencias JavaScript, callbacks ni enlaces de ownership. La memoria auxiliar es proporcional a la colección de una llamada y no se conserva entre llamadas. No se usa `unsafe`.

Las pruebas Rust enumeran repetidamente 1.024 atributos con nombres compartidos entre namespaces y verifican que no cambien los contadores de nodos, actualizaciones ni referencias. Las pruebas del addon comparan el orden completo de 2.050 atributos contra jsdom y comprueban que la enumeración repetida no agregue nodos o relaciones de ownership. El benchmark ejerce ambas rutas de enumeración con hasta 4.096 atributos; cada fixture nativo libera todos sus handles y termina con cero nodos, colecciones y referencias de atributos.

Además se ejecutó `npm run test:memory` sobre el addon candidato. El estrés general de construcción, parsing, mutación, cierre y teardown pasó en sus cinco procesos aislados. Se recolectaron los 2.320 atributos observados tanto en jsdom como en rustdom. [Resultados crudos y metodología](2026-09-12T01-22-06.755Z-linux-x64.json).

| Modo | Documentos sobrevivientes | Ventanas sobrevivientes | Delta heap tras warmup | Delta RSS |
|---|---:|---:|---:|---:|
| jsdom | 0/880 | 0/880 | 0,74 MiB | 1,53 MiB |
| rustdom | 0/880 | 0/880 | 0,72 MiB | 7,51 MiB |
| native | No aplica | No aplica | 0,00 MiB | 1,00 MiB |
| vitest | 0/440 | 0/440 | 0,74 MiB | 1,05 MiB |
| vitest-vm | 0/440 | 0/440 | 0,37 MiB | 0,72 MiB |

Son observaciones finitas tras GC mayor asíncrono y drenaje del event loop. No demuestran ausencia absoluta de fugas, no miden memoria pico y no sustituyen ASan/LSan ni una auditoría exhaustiva de dependencias. El RSS incluye memoria retenida por allocators. Los contadores de nodos observan ownership del DOM, no cada asignación temporal del allocator.
