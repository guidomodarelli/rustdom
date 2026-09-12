# Validación de compactación de atributos

La validación completa de la implementación sobre `0f40cc06e7f25cac80d3b656e48528f1eaa43fba` pasó con `npm run validate`: formato, Clippy, 29 tests Rust, build, 134 tests Node, 7 Jest, 11 Vitest, 4 VM, 1784 casos HTML5 diferenciales y 390 WPT en paridad con jsdom 27.4.0. De los WPT, 388 pasan el estándar y dos fallan igual que la referencia; no se cuentan esos dos como aprobados de estándar.

Después se agregó una prueba Rust adicional para el orden de finalización Attr antes de Element, sin modificar producción. `cargo fmt`, Clippy y los 30 tests Rust finales pasaron; la salida está en `reports/memory/2026-09-12-attribute-capacity-final-rust.log`. Esa prueba observó seis reducciones de buffer durante 4088 bajas y preservó los ocho atributos restantes.

El addon de esta primera implementación aislada tiene SHA-256 `0d7c1bc4f7b3b518a000378dea11817cccd13c93275c6cc875eae35862f9d541`. Una revisión posterior detectó que los tombstones pueden ocultar capacidad física; esta ejecución conserva evidencia de los escenarios ordinarios, pero no valida ese caso adicional. La versión reforzada conserva por separado sus tests y reportes. No se exponen capacidades internas como nuevas APIs públicas para facilitar los tests.

La capacidad se valida mediante Rust sobre los contenedores reales; las pruebas DOM comprueban orden, nombres, identidades, propietarios y alias después de ráfagas de atributos. El análisis de memoria distingue liberación de objetos, capacidades nativas y RSS del allocator.
