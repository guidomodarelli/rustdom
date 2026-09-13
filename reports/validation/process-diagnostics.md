# Diagnósticos de terminación del runner

El incidente macOS documentado en `slotable-state-ci/` terminó con un código
nulo y sin conservar la señal. El runner ahora guarda `exitCode`, `signal` y
`spawnError` por gate, además de los logs existentes. Un error de arranque,
incluido uno síncrono, produce un resultado que puede persistirse; no interrumpe
la escritura del resumen por rechazar prematuramente la promesa.

El ejecutor usa `spawn` sin interpolación de shell y decodifica UTF-8 por stream,
para conservar caracteres divididos entre chunks. El orden observado entre
stdout y stderr sigue siendo el de llegada. Los fallos y señales no se convierten
en éxito ni se reintentan automáticamente. Los límites y assertions del DOM,
WPT y memoria permanecen iguales.

## Contratos ejecutados

- Node24.14.1/Linux:6/6PASS mediante `npm run test:validation`.
- Node22.12.0/Linux:6/6PASS con el PATH explícito del toolchain local.
- Node24.14.1/Windows:5/5 contratos de procesos PASS. El test del CLI con Cargo
  no se ejecutó localmente porque Cargo no está instalado en Windows; el job CI
  lo ejecuta después de instalar rustfmt/clippy y las dependencias.

Los casos ejercen procesos reales: salida UTF-8 dividida, código7, SIGTERM,
ejecutable inexistente, argumentos inválidos y el CLI de validación en un
workspace temporal con un manifiesto Cargo inválido. Este último verifica que
se detiene en el primer gate fallido y conserva JSON y log. No hay mocks de
plataforma ni assertions sobre el texto de archivos fuente.

Un primer comando Node22 no conservó Cargo en PATH; el resultado ENOENT fue
capturado correctamente y se corrigió el entorno de ejecución, manteniendo
la expectativa de usar Cargo real. Windows requirió ejecución fuera del
sandbox para crear procesos hijos; las pruebas focales pasaron después.

El cambio no modifica el motor DOM ni las operaciones de benchmarks. No se
atribuye una mejora de rendimiento ni ausencia absoluta de fugas a este ajuste.
El ejecutor mantiene salida solo durante cada gate y no registra listeners
globales ni reintentos persistentes.

El `npm run validate` real pasó con los siete gates:152 tests Rust,500 contratos
Node,7 Jest,18 Vitest,26 VM y1.784 casos HTML5 comparables. El informe WPT es
`../compatibility/2026-09-13T05-10-11.676Z-linux-wpt.json`, con sus exclusiones
declaradas. El resumen `latest.json` conserva `signal:null` y `spawnError:null`
en cada gate exitoso. No se volvieron a ejecutar benchmarks ni paquetes locales:
el motor, sus operaciones y sus dependencias no cambiaron; CI ejecuta esos gates
sobre el SHA publicado antes del merge.
