# Integración de Range en producción

Se integraron exactamente los cuatro archivos del candidato compuesto:
`src/dom/native-tree.cjs`, `src/dom/range_state.rs`,
`src/dom/range_state_binding.rs` y `types/native.d.cts`. Los 344 inputs de
compilación coinciden con la declaración publicada del candidato a277;
`compiler-input-equivalence.json` conserva cada hash y cero diferencias.
Eso no autentica configuración global, entorno completo ni equivalencia de
binarios. El binario local probado es
`a6a21c3c97f6972eb871be739fd4e4f9d7d4030156ab8062c69bab5a6d80c3b0`,
distinto del a277 sellado. No se reconstruyó ni reemplazó un paquete consumido.

Rust valida y construye ambos endpoints antes de exponer el estado y ejecuta
el colapso numérico. El binding conserva las referencias V8 y evita repetir
sus registros cuando ambos endpoints ya tienen el mismo propietario.
La validación y otros algoritmos que siguen en JavaScript permanecen pendientes:
el runtime continúa híbrido; este cambio no completa la migración.

Validación ejecutada:

- Rust 1.99.1: formato, 313 tests, build y Clippy con advertencias como errores.
- Node 22.12.0 y 24.14.1: `npm test` completo, 3.784 tests Node, nueve del
  proceso WPT, 22 de Jest, 33 de Vitest y 34 de sus pools VM por SDK.
- Nueve regresiones nuevas de Range ejercen el addon real, realm, mutación,
  snapshots, error atómico y ciclos de retención/liberación.
- Corpus: 1.784 casos comparados, ocho `script-on` excluidos, sin diferencias.
- WPT: 240 fixtures, 83.007 aserciones; 81.804 aprobadas y 1.203 adversas
  compartidas con jsdom por SDK. `complete=false`: se conservan el bloqueo
  conocido de `range-deletion` y la exclusión que necesita click/layout real.
- TypeScript estricto y consumidor CommonJS real, también después de colocar
  la prueba de la API nueva al final para preservar los contadores previos.
- 16 workflows validados con actionlint 1.7.7, sin shellcheck/pyflakes externos.

El job nuevo `Range integrado del PR` construye HEAD y prueba ambos SDK.
CI general e inventario también conservan el checkout actual. Quince workflows
de métodos/candidatos históricos se rotulan `Histórico` y usan el Git original
4196c496: sus graphs congelados incluían el runtime anterior. Conservan todos
sus tests; no acreditan la implementación actual. Los rechazos originales y
los pins publicados no se modificaron.

`evidence.tar.gz`: 12.370.352 bytes, 574 miembros, SHA-256
`55ff6a89b6bc362e85c43780a821a01829cca32f10b4d0fc376a90bce4b15153`.
Se releyeron todos los miembros; `manifest.json` conserva tamaños y hashes.
Revisión local aislada sin hallazgos materiales. No ejecutar fuentes archivadas.
Las muestras de benchmarks están además en
`reports/benchmarks/range-native-production/20261027/`; los endpoints de
recursos en `reports/memory/range-native-production/20261027/`.

Se preservan los intentos negativos de infraestructura: E/S NTFS/WSL, fixtures
omitidos en el staging, permisos y resolver de dependencias Windows, y disco
sin espacio. Se instaló el árbol Linux real desde el lockfile sin modificarlo.
Se recuperaron 169 archivos/54.332.958 bytes antes de reiniciar solamente el
entorno temporal propio; siete archivos del rescate no pudieron leerse, con
errores registrados y tres respaldos originales adicionales. No se afirma que
ese rescate parcial sea íntegro. La calificación final nueva sí quedó completa.
El primer exportador corrigió una lectura de schema antes de generar el tar.

El rebuild JS desde la instalación Linux reprodujo los 568 archivos de runtime.
La distribución anterior tiene 153 archivos adicionales de licencias nativas,
producidos por packaging: no se afirma igualdad del paquete completo. Se
conservan el intento inicial sin una licencia de entrada y la comparación.

El gate de ownership todavía no está resuelto. Los benchmarks ordinarios
resultaron más lentos que jsdom en las ocho filas y no aceptan presupuestos.
Faltan productor/lector científico integral, revisión/publicación y una única
confirmación del candidato antes de integrar una nueva decisión al gate.
`performanceAccepted=null`, `gateReevaluated=false`; sin tag ni merge.
