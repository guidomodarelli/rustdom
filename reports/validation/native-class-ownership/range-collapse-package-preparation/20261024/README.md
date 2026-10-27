# Paquetes preparados para el estudio de collapse

Esta fase conserva exactamente el binario calificado en Linux/Node22 y24,
rehidratando los paquetes desde datos autenticados. No reconstruye Rust,
no reinstala dependencias y no ejecuta una secuencia de rendimiento.
El protocolo y los comandos actuales están en
`reports/benchmarks/native-class-ownership/range-collapse-packages/PROTOCOL.md`.

B: ELF43410883; distribución completa569archivos/SHA0d2c0835. A0/A1 conservan
03568ce9, J0/J1 c458b9e9 y dependencias3531archivos/149eb8f5. El package.json
3c1570af y locke154f202 de B son byteidénticos a los de la preparación original.
La procedencia local b63cf834+3src/hash8a y el commit hospedado da0f4f80 del
artifact12574603695 permanecen separados. No normalizar metadata Git.

`artifacts/packages.tar.xz` conserva6981archivos/70441956bytes y seis enlaces
internos en7880316bytes, SHA8c430f0ba568e6b3b48d98f5976cddee875e4d7e70525d3d5b5e8339e0f7b5d3.
`archive-members.json` registra todos los miembros, tipos, tamaños, SHA256,
permisos y metadata de archivo. Se leyó de vuelta íntegro y se extrajo mediante
el extractor actual fijado ae23a0e0, sin ejecutar control archivado. El replay
puro del paquete extraído pasó en ambos Node; receipts/logs en roundtrip*.

`artifacts/raw-qa.tar.xz` conserva41archivos originales de preparación,
contratos, consumidores y recursos, incluyendo rondas initial y fixed. No se
archivan los enlaces externos de las salidas del probe; sus datos originales
se preservan sin pérdida. `raw-qa-members.json` fija cada miembro. La fuente
actual del probe se reutilizó sin mocks ni reescribir imports.

Pasaron14contratos por Node22.12.0 y24.14.1, consumidores CJS/ESM con NativeRange
real y paridad pública contra jsdom independiente, y seis ciclos finitos de
recursos por Node con lectura completa de endpoints/baselines. Se corrigieron
dos P2 de revisión local: resolución de loader mediante symlink y aceptación
de A0 como B en el probe. Sus regresiones están incluidas y la revisión final
cerró0hallazgos. review.json fija el código revisado; summary.json conserva
comandos, hashes y decisiones. La frontera nueva comprende7archivos/766líneas,
con98líneas en el coordinador; antes no existía este feature. No es una
reducción del runtime ni un porcentaje de migración.

Recursos y límites en reports/memory/range-collapse-package-preparation.{md,json}.
Sin memoria pico ni garantía universal de ausencia de fugas. El runtime sigue
híbrido; los fallbacks/exclusiones de compatibilidad previos siguen pendientes.
performanceAccepted=null. Siguiente paso: congelar y revisar el método
prospectivo del candidato y sus checks antes de una captura única, con los
presupuestos originales±2%/±5%. La autorización permanente cubre la continuidad.
No activar estudios históricos ni crear tag/merge de ownership todavía.
