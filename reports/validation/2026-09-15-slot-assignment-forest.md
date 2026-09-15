# Fix: identidad del bosque del driver de slots

Origen: review `discussion_r4013958154`, aplicado sobre la rama base
`feature/native-slot-assignment-driver` del PR #43 para su propagación por la pila.
Head inicial: `7d4c3acc7f7cfa2059274f9c1434ad974c6288ac`.
Base `main`: `b9bbf64a67a9acb42ce30524d732fd348819daba`.

## Cambio y decisiones

- `TreeStore` posee una identidad estable `Arc<()>`; el driver usa `Option<Weak<()>>`
  para distinguir una operación aún no iniciada de un origen destruido.
- El primer paso vincula la identidad. Los pasos activos posteriores la verifican
  antes de leer handles, capturar candidatos o aplicar el plan pendiente.
- Se reutiliza `TreeError::SlotAssignmentProtocol` y su mapping N-API a `InvalidArg`.
  El error cancela la operación, preserva commits aceptados y limpia el plan pendiente.
- Al completar o cancelar se libera la referencia débil. Un driver completado
  sigue respondiendo `Complete` sin acceder al árbol.
- El fix pertenece al core Rust. La API N-API conserva sus firmas; no se agregan
  referencias JavaScript ni validación duplicada en el bridge.

## Validación ejecutada

Entorno: WSL Ubuntu 22.04, Node v24.14.1, Rust/Cargo 1.98.1.
Dependencias instaladas con `npm ci --ignore-scripts` desde el lockfile, sin cambios
en dependencias. `npm run build` completó el addon release y el runtime JavaScript.

| Comando | Resultado |
| --- | --- |
| Regresión Rust de cruce de bosques, antes del guard | Falló: el receptor aceptaba el plan |
| `cargo test --locked slot_assignment_driver` | 8/8 |
| `node --test tests/slot-assignment-driver.spec.cjs` | 5/5, addon real y proceso GC |
| `cargo fmt --check` | OK |
| `cargo clippy --all-targets -- -D warnings` | OK |
| `cargo test --locked` | 172/172 |
| `npm test`: compatibilidad | 522/522 |
| `npm test`: Jest | 7/7 |
| `npm test`: Vitest | 18/18 |
| `npm test`: Vitest vmForks + vmThreads | 26/26 |

[El gate guardado](2026-09-15T13-16-38Z-slot-forest.json) conserva comandos,
duraciones y logs por etapa, sin fallos ni omisiones en los runners ejecutados.
[El análisis de memoria](../memory/2026-09-15-slot-assignment-forest.md) describe
los escenarios y enlaza las muestras; la suite completa generó otra ejecución
independiente del test GC y los reportes de slots relacionados.

La regresión N-API usa dos bosques con root/slot/candidato numéricamente iguales,
en modo slot y subárbol, pausados después de `Signal` y `Applied`. Comprueba
rechazo, ausencia de cambios en el receptor, preservación de los commits y señales
del origen, cancelación terminal y liberación de los handles. La destrucción del
origen se prueba tanto en Rust como por GC del addon real.

## Benchmark focal

`npm run bench -- slot-reassign-100 slot-dense-reassign-100` terminó con código 0
y equivalencia de resultados. [El informe y las muestras](../benchmarks/2026-09-15T13-34-23.144Z-linux-x64.json)
registran cuatro procesos alternados (jsdom/rustdom/rustdom/jsdom), 3 warmup y
9 muestras por caso y proceso, hardware, versiones y hash del binario.
Se coordinó una ventana sin builds, tests ni benchmarks de los otros fixes.

| Operación | Slots | jsdom/rustdom (medianas) |
| --- | ---: | ---: |
| simple | 25 | 0,87× |
| simple | 100 | 1,32× |
| densa | 25 | 5,50× |
| densa | 100 | 56,47× |

El caso simple pequeño es más lento que jsdom. Los ratios comparan motores en
estas cargas sintéticas; no son una comparación antes/después del fix ni una
mejora atribuible al guard. Se conserva el alcance híbrido del runtime.

## Alcance

No se ejecutaron localmente el corpus HTML5, WPT, empaquetado de distribución,
Valgrind ni la matriz de sistemas de CI para este fix; las firmas públicas,
dependencias y parser permanecen intactos. Los runners de CI conservan esos gates.
Esta validación no es una certificación de compatibilidad DOM completa.
