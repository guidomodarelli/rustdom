# Preflight de extremos de Range

Fix del hallazgo `3995826856` del PR 16 sobre
`110661b6efba789054b071f10bceec13919465ed`, rama `feature/native-range-boundaries`.
Entorno: Ubuntu 22.04 bajo WSL2, checkout aislado en `/mnt/c`, Node 24.14.1,
control adicional en Node 22.12.0, Rust/Cargo 1.98.1 y jsdom 27.4.0 independiente.
El addon se compiló con Cargo release y thin LTO dentro del clon; los lockfiles
y herramientas coinciden con el checkout original. No se reutilizó su `dist` ni `target`.

## Comportamiento y decisiones

`rangeBoundaryPlan` podía devolver un plan sin consultar ambos extremos. La
[regresión previa](baseline-rust.log) muestra `Start` sobre un nodo separado,
con `start` asignado y `end` reservado, devolviendo `Both` en lugar de rechazar.
Esa ejecución falla intencionalmente antes del fix; los gates finales pasan.

El método ahora comprueba los enlaces asignados de `start` y `end` antes de
cualquier decisión por modo. Se reutilizan `node_id` y `links`: no se activan
reservas ni se agregan reglas de metadata para extremos usados como topología.
La validación de tipos y offsets del nodo solicitado y la traducción a errores
DOM conservan el orden previo para handles válidos. No cambian los wrappers,
los realms ni el orden de actualización de las referencias del Range.

Los nuevos tests ejercitan ocho modos, dos extremos, nueve handles inválidos
—reservado, liberado, desconocido, cero, negativo, fraccionario, NaN, infinito y
entero no seguro— y cuatro escenarios: plan normal, nodo sin padre,
DocumentType y offset fuera de límites. Son **576 rechazos en Rust y 576 en
Node** por ejecución de la matriz. Se comprueban contadores, topología, datos y
liberación de nodos/reservas. También se aceptan ambos extremos asignados sin
metadata en todos los modos, con planes exactos comprobados por Node.

## Validación final

Comandos ejecutados mediante `bash scripts/run-linux.sh` en el clon:

| Gate | Resultado | Evidencia |
|---|---|---|
| `cargo fmt --check` | PASS | [log](rust-format.log) |
| `cargo clippy --all-targets -- -D warnings` | PASS | [log](rust-lint.log) |
| `cargo test --locked` | 80 tests PASS | [log](rust-tests.log) |
| `npm run build` | Addon y distribución JS PASS | [log](build.log) |
| Contratos Range boundaries/queries/text y boundary points | 25 tests PASS | [log](range-contracts.log) |
| `npm test` | 270 Node, 7 Jest, 11 Vitest y 4 VM PASS | [log](javascript-tests.log) |
| Node 22.12.0: `node --test tests/range-boundaries.spec.cjs` | 13 tests PASS | [log](range-node22.log) |
| `node tests/wpt/run.cjs range-boundaries` | 5 archivos en paridad exacta | [log](range-wpt.log) |
| `node scripts/memory-check.cjs rustdom` | PASS | [log](memory.log) |
| `git diff --check -- . ':!tests/fixtures' ':!reports'` | PASS | Revisión final del diff |

La [salida WPT completa](../../compatibility/2026-09-12T10-06-55.346Z-linux-wpt.json)
preserva 11.471 casos por motor: 11.373 pasan estándares y 98 fallan de la misma
forma en ambos. No hay divergencias nuevas. Las fixtures upstream conservan
sus bytes y hashes; esta paridad no certifica compatibilidad completa con WPT.

## Memoria y ownership

El preflight solo consulta IDs y enlaces existentes. No agrega almacenamiento
persistente, referencias V8, caches, callbacks ni ownership; el error nativo
se convierte mediante el mapping N-API existente. Los planes continúan siendo
valores primitivos sin retención de nodos.

El [estrés con GC](../../memory/2026-09-12T10-07-30.915Z-linux-x64.json) conserva
todas las muestras y trazas: se recolectaron 882 Document, 882 Window y 1.000
Range observados. `liveNodes`, `dataNodes`, `indexedNodes`, colecciones, owners
y holders terminan en cero. Se conservan 76 reservas numéricas sin registros,
dentro del lote de 128. Crecimiento final: heap 2.05 MiB, memoria externa 40
bytes, ArrayBuffers 0 y RSS 14.95 MiB; pasan los presupuestos existentes.

Memcheck ejecutó los seis tests Rust de `dom::range_boundaries::tests`, con
`--leak-check=full --show-leak-kinds=all --errors-for-leak-kinds=definite,indirect
--track-origins=yes --error-exitcode=99 --test-threads=1`, sin supresiones.
[Tests](../../memory/2026-09-12-range-endpoint-handles-valgrind-tests.log) y
[diagnóstico completo](../../memory/2026-09-12-range-endpoint-handles-valgrind.log):
cero errores de acceso y cero bytes `definitely lost` o `indirectly lost`.
Persisten 48 bytes `possibly lost` de `std`/`libtest` y 544 bytes `still reachable`
del runtime, visibles en el log.

Estas pruebas son finitas; RSS incluye retención del allocator. Memcheck cubre
el ejecutable de tests Rust, no V8 ni el addon cargado. Windows y macOS quedan
a cargo de CI; no se afirma ausencia absoluta de fugas ni migración completa
del DOM a Rust.

## Rendimiento medido después del fix

Se ejecutó `npm run bench -- range-boundaries-100` sin otros tests, builds ni
mediciones de memoria de los agentes en paralelo. Se conservaron los timeouts
y la metodología: 18 muestras por motor y tamaño, repartidas en dos procesos,
con tres warmups por proceso y orden alternado. Se miden 100 conjuntos de los
ocho setters/selecciones públicos y `commonAncestorContainer`; la preparación,
validación, cierre y GC quedan fuera del tiempo. Los hashes de resultados
coinciden entre motores.

| Filas | jsdom mediana (ms) | rustdom mediana (ms) | jsdom / rustdom |
|---:|---:|---:|---:|
| 250 | 11.154 | 1.817 | 6.14× |
| 1.000 | 69.763 | 1.862 | 37.46× |

[Muestras y metadata completas](../../benchmarks/2026-09-12T10-14-31.797Z-linux-x64.json),
[tabla](../../benchmarks/2026-09-12T10-14-31.797Z-linux-x64.md) y [log](benchmark.log).
La [medición histórica](../../benchmarks/2026-09-12T09-29-06.336Z-linux-x64.json)
se conserva: registraba ratios de 6.17× y 37.54× en estas filas, pero incluía
otros workloads en sus procesos y se ejecutó en otro checkout. No se usa como
un A/B para atribuir costo incremental o mejoras al preflight. El resultado
final mide la operación pública híbrida, con decisiones Rust y wrappers y
referencias vivas JavaScript; no representa la duración de suites completas.
