# Validación de deduplicación de nombres

`npm run validate` terminó con todos sus gates aprobados sobre `0e046176b1367fed802b6099bdcbcd2f65896aad` más el fix de enumeración por hash. Se usaron el addon release real, Node 24.14.1, Rust 1.98.1 y jsdom 27.4.0 independiente.

- Rust: formato, Clippy con warnings como errores y 22 tests aprobados.
- Node: 122 tests aprobados, incluidos los tres casos nuevos de enumeración de atributos.
- Jest: 7 tests aprobados. Vitest: 11; VM forks/threads: 4.
- Corpus HTML5: 1.784 casos compatibles y 8 casos script-on excluidos según la metodología existente.
- WPT: paridad en 390 tests; 388 aprobados y 2 fallos de adopción de atributos compartidos con jsdom. La paridad no se presenta como aprobación del estándar.
- `npm run test:memory`: cinco modos aprobados, con reporte separado en `reports/memory/2026-09-12T01-22-06.755Z-linux-x64.json`.
- Los benchmarks baseline y candidato se ejecutaron sin otras cargas de esta tarea; resultados en `reports/benchmarks/2026-09-12-attribute-names.md`.

Se conservan los logs y `latest.json` de esta ejecución dentro de este directorio para evitar sobrescribir evidencia de otras validaciones concurrentes. Solo se normalizaron finales de línea y whitespace de presentación de los `.log`; los JSON y las muestras de benchmark permanecen intactos. Los mensajes `Could not parse CSS stylesheet` forman parte de fixtures inválidos compartidos por ambos motores; los gates verifican sus resultados y finalizaron correctamente.

Después se integró `85611ef0144807bbc17d1b2fca354ff0396199ef`, que refuerza los límites de inicialización nativa. El drift se clasificó como relacionado por el boundary compartido y el fixture Unicode, y se revalidó la unión: 23 tests Rust, nuevo build release, 27 contratos focales en Node 24.14.1 y otros 27 en Node 22.12.0, más los 390 WPT en paridad. [Evidencia de rebase, comandos y alcance reutilizado](rebase.json). Los logs `rebase-*` corresponden a esta segunda validación; no se presenta como una repetición de los runners completos ni de los benchmarks.
