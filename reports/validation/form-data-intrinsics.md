# FormData: clave de iteración intrínseca

PR67, comentario `4013611040`, sobre la base `f49ecf8b05ec7b9a45ffa97d6477b474f448153e`.

Reasignar `globalThis.Symbol` después de inicializar el runtime hacía fallar `new FormData(form)` en Rustdom para un formulario de inputs que jsdom 27.4.0 sí construye. `Host.each` consultaba el global por cada iteración; ahora obtiene la clave `Symbol.iterator` capturada por el adaptador durante la inicialización. La búsqueda del método del iterable y su ejecución siguen ocurriendo en cada operación.

El cambio conserva el símbolo en el objeto privado de helpers existente. Rust usa handles locales durante la llamada; no agrega referencias N-API persistentes, propietarios de ventanas ni caches de documentos.

La regresión corre en procesos hijos aislados, en modos normal y VM. Cubre `Symbol = null`, un reemplazo con otra clave de iteración y un getter que lanza. Verifica duplicados, `getAll`, orden de iteración, identidad y metadatos de File, y la identidad de una excepción primitiva durante construcción.

El primer fixture reveló un fallo compartido adicional: el iterador de `HTMLCollection` usado por `select` consulta el global mutable en jsdom. Se conserva esa evidencia en `form-data-intrinsics/initial-reference-failure.log`; el test final verifica ese fallo compartido por separado. `form-data-intrinsics/regression-before.log` reproduce específicamente el fallo de Rustdom con inputs y File, después de que la referencia completó su escenario.

Entorno: Ubuntu 22.04 mediante WSL, Node 24.14.1, Rust 1.98.1 y dependencias de los lockfiles sin cambios. SHA-256 del addon validado: `452e609198336589594f95e262d9346fee5630c6bec138809836bd413e320687`.

Resultados verificados:

- `cargo fmt --check` y `cargo clippy --all-targets -- -D warnings`: PASS.
- `cargo test --locked`: 244 PASS.
- `npm run build`: PASS.
- `node --test tests/form-data-intrinsics.spec.cjs tests/form-data.spec.cjs tests/formdata-realm.spec.cjs`: 50 PASS, incluidas las seis regresiones nuevas.
- `npm run test:jest`: 16 PASS.
- `npm run test:vitest`: 27 PASS; `npm run test:vm`: 26 PASS.
- `node tests/wpt/run.cjs form-data`: paridad en todos los fixtures seleccionados; reporte `../compatibility/2026-09-15T09-01-26.081Z-linux-wpt.json`. El corpus continúa limitado a Window y conserva la exclusión que requiere clicks y layout reales.
- `node --expose-gc tests/helpers/form-data-memory.cjs`: 28 escenarios PASS; reporte `../memory/2026-09-15T09-01-56.262Z-form-data.json`.
- `node --expose-gc tests/helpers/form-data-native-memory.cjs native 1000`: PASS. Las 1.100 listas creadas (incluidas 100 construcciones fallidas) se liberaron; quedaron cero formularios, documentos y ventanas observados, cero operaciones activas y los contadores de memoria nativa retornaron a su baseline.

Los logs completos se guardan en `form-data-intrinsics/`. No se repitió Memcheck ni toda la suite Node para este cambio acotado; los controles anteriores ejercitan el addon real, los contratos afectados y la integración con los runners.

Benchmark `form-data-construct` pendiente de la siguiente ventana sin carga concurrente, coordinado con el hito de Selection. Este fix no publica un tag de checkpoint ni afirma una mejora de rendimiento. Tampoco se infiere compatibilidad completa o ausencia absoluta de fugas a partir de las pruebas finitas.

## Recuperación del proceso de validación

Después del reinicio de WSL se recuperó el mismo clon, con marker `pr67-formdata-symbol-4013611040`, sin editar nuevamente el código ni las pruebas. Se verificaron los logs completos, las fechas de los archivos y la huella del addon; los gates anteriores se reutilizan, no se presentan como una segunda ejecución.

La auditoría estructurada confirmó 40 casos diferenciales sin diferencias, 17 fixtures WPT sin divergencias y 28 escenarios de memoria con liberación alcanzada y cero referencias sobrevivientes. El corpus WPT registró 77 aserciones aprobadas y conserva sus límites y fallos compartidos.

Se volvió a ejecutar `node --test tests/form-data-intrinsics.spec.cjs` después de recuperar el entorno: 6 PASS, 0 FAIL, exit code 0. El log adicional es `form-data-intrinsics/recovery-regression.log`; incluye una advertencia de inicio de la sesión systemd de WSL que no impidió ejecutar ni completar las pruebas. Las huellas y los controles auditados quedan en `form-data-intrinsics/recovery-provenance.json`.

Para que el diff pase los controles de whitespace, los logs versionados normalizan finales de línea, espacios finales y líneas vacías al final; se conservan completos sus diagnósticos y resultados. Las copias originales permanecen en la caché privada del clon recuperado. Los JSON de resultados no se modificaron.
