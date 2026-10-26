# Recursos del candidato numérico en seis jobs hosted

Run40263224006, intento1, fuente de CI e6c4e6a9: Node22.12.0/24.14.1 en
Linux, Windows y macOS. Cada job ejecutó seis ciclos del probe range-state y
seis del probe collapse, 72 endpoints finales en total. `endpoints.json`
conserva por plataforma/SDK los contadores, supervivientes y snapshots finales.

En todos los endpoints se observaron Document y Window separados sin
supervivientes, liveNodes=0 y rangeStates.live=0. El probe range-state informó
4814 NativeRange creados y 4814 liberados en cada job. Las clases nativas
globales conservaron su baseline intencional de 22; no se confunde ese baseline
con una exigencia de cero para todo el proceso. Los controles retenidos y las
rondas anteriores a la liberación están en las salidas crudas.

La evidencia íntegra está en los ZIP de
`reports/validation/range-numeric-composed-candidate/hosted/40263224006/`.
Dentro de cada ZIP, las salidas son:

- `_temp/range-initialization-proof/logs/memory.stdout.log`
- `_temp/range-initialization-proof/collapse-memory/collapse-memory.stdout.log`

Son escenarios finitos de ownership y teardown. Los valores de RSS, heap,
external y arrayBuffers son snapshots; no miden pico ni permiten garantizar
ausencia universal de fugas. No son una aceptación de rendimiento. El runtime
de producción continúa híbrido y el candidato aún no se integró.
