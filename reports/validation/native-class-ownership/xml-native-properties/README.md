# Lecturas de propiedades XML en Rust: validación del candidato

La fuente canónica `5ef668c47a78bb73ef5b0881fbf20e6d36c4d4cc9686198c26e722d8fc9c6806`
retira tres llamadas al helper JavaScript en la ruta de error XML para
objetos/funciones. Conserva el helper de primitivas, la exportación nativa
anterior y el orden factory → realm → message → argumentos → factory.
La API nueva comparte el control Rust y sus guards con la anterior. No hay
caches ni referencias persistentes nuevas. El sistema completo sigue híbrido.

El addon real de Linux x64/glibc 2.35, Rust 1.99.1, N-API 8 tiene SHA-256
`62e941778ff2974e697087ecbd4c11db5135df9b498ee08522f531442d6d50e2`.
La preparación independiente y el binario de las suites coinciden. El manifest
`tested-source-manifest.json` liga las fuentes y tests ejecutados al árbol actual.
La referencia independiente es jsdom 27.4.0.

Por Node 22.12.0 y 24.14.1 pasaron:

- 753 tests XML, incluidos 26 casos nuevos del contrato nativo y un consumidor
  ESM con DOM real, Unicode y excepción del realm.
- `npm test`: 3774 tests de compatibilidad, 9 contratos WPT de procesos reales,
  22 tests Jest, 33 Vitest y 34 de los modos VM.
- Corpus HTML: 1784 comparaciones compatibles; 8 casos script-on excluidos.
- 21 contratos de preparación, inputs físicos, CLI, cambios rechazados y
  relocalización de las cinco copias con symlinks relativos.
- Probe de preparación: 15 Window y 15 Document liberados por versión de Node.
- Análisis de memoria: 132 estados por Node; ver el informe separado.

Pasaron `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` y
los 311 tests de `cargo test --locked`. Actionlint validó el workflow nuevo.

El WPT completo conserva paridad con la referencia, incluidos fallos comunes.
No acredita conformidad completa de estándares; `complete:false`, las
exclusiones y suites bloqueadas están en cada JSON crudo.

| Node | Archivos WPT | Asserts comparados | Standards pass | Fallos compartidos |
| --- | ---: | ---: | ---: | ---: |
| v22.12.0 | 240 | 83007 | 81804 | 1203 |
| v24.14.1 | 240 | 83007 | 81804 | 1203 |

Los crudos comprimidos conservan también los fallos locales de preparación:
Rustfmt no tenía toolchain por defecto, luego requirió formato; la primera
copia de QA omitió los tres fixtures WPT históricos; el primer arnés de
inputs intentó leer dos reportes funcionales antes de generarlos. Se corrigieron
el formato y las invocaciones, se conservaron los intentos originales y se
ejecutaron las validaciones finales completas. No se modificaron tests para
aprobar ni muestras de rendimiento. Los reportes heredados de timeout siguen
rechazados en sus pruebas de regresión.

La revisión independiente del código y protocolo cerró sin hallazgos; la
evidencia publicada permite auditar los resultados y sus hashes. El alcance
del review es este delta contra `e1e8188d`, no todo el historial del PR 80.
El CI general de esa base pasó sus ocho jobs: run `39902558587`.
No equivale al CI del commit nuevo, que debe verificarse después del push.

No se midió rendimiento de este candidato durante la QA local. La medición
prospectiva usa el método existente y los mismos presupuestos, con otra etiqueta
y guard de ejecución única. Los estudios previos continúan consumidos y sus
rechazos intactos. No hay aceptación, tag ni merge por estos resultados funcionales.
