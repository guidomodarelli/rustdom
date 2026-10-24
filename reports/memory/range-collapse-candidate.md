# Recursos del candidato de collapse

El addon Linux local26ba8690 se observó en seis ciclos por Node22.12.0/24.14.1.
Cada ciclo crea32Range y32clones, alterna owners iguales/distintos, colapsa,
muta y cierra el entorno. Conserva un Range intencionalmente para comprobar
que el endpoint retenido falla; después lo libera y exige dos estados claros.
Los baselines están en validation/memory-node22.json y memory-node24.json.
Window, Document, wrappers y estado nativo tienen WeakRef independientes.

| Node | Window / Document | Range / estado nativo | Retenidos | Finales claros | RSS observado, bytes |
| --- | --- | --- | ---: | ---: | --- |
| v22.12.0 | 6 / 6 | 384 / 384 | 12 | 12 | 127066112..127721472 |
| v24.14.1 | 6 / 6 | 384 / 384 | 12 | 12 | 122478592..123789312 |

Todos los endpoints finales vuelven al baseline nativo observado, incluidos
napiClasses.live y rangeStates.live. El JSON adyacente conserva los rangos de
rss,heapTotal,heapUsed,external yarrayBuffers; el archivo QA contiene todas las
trazas originales y demás reportes de memoria generados por las suites.
Los controles retenidos y las primeras observaciones no se descartan.

Son snapshots finitos tras GC, no memoria pico. No distinguen universalmente
retención del allocator de una fuga ni cubren todos los ciclos de eventos,
timers, observers y caches. La calificación hospedada por plataforma y el
rendimiento siguen pendientes. El candidato conserva el guard, no introduce
referencias persistentes/caches ni cambia las edges V8 en el caso de owner
idéntico. El runtime principal sigue híbrido; no hay aceptación de ownership.
