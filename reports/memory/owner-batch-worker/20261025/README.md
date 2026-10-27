# Recursos de 64 workers funcionales

resources.json conserva 192 snapshots de workers completos: tres por worker, baselines nativos completos
y768 Window más768 Document observados por separado. Los últimos dos estados de
cada worker quedaron claros. Dos primeras rondas todavía no lo estaban y no se
ocultaron. Los reportes completos permanecen en reports/validation/owner-batch-worker/.

Se guardan además 18 snapshots de seis procesos que fallan deliberadamente con
undefined/null/Symbol desde progreso: un Window y un Document por proceso, valor
original conservado y dos endpoints finales claros. initial-resources.json conserva
la primera calificación anterior al fix; no se mezcla con los recursos del cierre.

Las pruebas adicionales del sampler remoto preservan además los controles que
retienen deliberadamente una ventana o un documento y luego los liberan, en
reports/validation/owner-batch-selected-runtime/20261025/.

Son endpoints tras GC en escenarios finitos. No miden memoria pico ni prueban
ausencia universal de fugas; RSS puede incluir memoria retenida por el allocator.
No hubo inferencia de rendimiento ni reevaluación del gate por estos resultados.
