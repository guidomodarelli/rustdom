# AbortSignal.any: ownership y recolección

El PR 54 conservaba cada dependiente mediante un `Map` fuerte en su fuente. Con un controlador vivo, tres tandas de 1.000 señales descartadas conservaron 1.001, 2.001 y 3.001 estados Rust y 1.000, 2.000 y 3.000 enlaces después del GC. La reproducción se ejecutó sobre `16ad4ebcc61e8e5e4a93d7cea29520a0c8b20573`; las muestras crudas están en `reports/memory/pr54-abort-retention-baseline.json`.

## Decisiones

- Rust sigue siendo dueño de la composición, las fuentes, el orden, el marcado previo a callbacks y la membresía de algoritmos. `sourceIds()` permite resolver owners; `detachSources()` libera ambos extremos de enlaces terminales sin alterar algoritmos pendientes.
- Un índice V8 `ID → WeakRef` resuelve señales. Su finalizador conserva únicamente el ID numérico y elimina la entrada. No conserva señales, documentos ni ventanas.
- Una fuente mantiene fuerte solamente al dependiente pendiente con listeners de `abort` o algoritmos activos. El contador de listeners se consulta en Rust sin generar snapshots. Se actualiza la retención después de altas, bajas, consumo de `once` y cambios de `onabort`.
- El accesor de jsdom conserva un listener interno después de `onabort = null`. Ese handler inactivo se descuenta únicamente para decidir retención, preservando el orden observable del accesor.
- Antes de ejecutar callbacks, el host fija la lista completa de dependientes vivos y libera las raíces terminales. Si un algoritmo arroja una excepción, se conserva el comportamiento de aborto parcial sin que una fuente retenga esos dependientes indefinidamente. Un owner V8 puede desaparecer antes que su handle N-API; un ID pendiente de finalización no se interpreta como un owner obligatorio.

Estas decisiones aplican las condiciones de recolección de [DOM Standard, §3.2.1](https://dom.spec.whatwg.org/#garbage-collection). La implementación de referencia jsdom 27.4.0 utiliza conjuntos fuertes; esa retención no se adopta como resultado esperado para el nuevo test de memoria.

## Evidencia y reproducción

Entorno: WSL Ubuntu 22.04, Node 24.14.1, Cargo/Rust 1.98.1. `node_modules`, `target` y `dist` pertenecen al clon efímero; se usa el addon compilado real. No se utilizan mocks de plataforma.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
node --expose-gc tests/helpers/abort-retention-baseline.cjs
node --test tests/abort-native.spec.cjs tests/abort-signal.spec.cjs
cargo fmt --check
cargo test --locked
cargo clippy --all-targets -- -D warnings
npm test
```

El helper de baseline registra el HEAD ejecutado y escribe su archivo fijo; para reproducir el resultado anterior hay que ejecutarlo sobre el SHA anterior indicado, preservando las muestras históricas antes de ejecutarlo nuevamente.

El helper `tests/helpers/abort-dependent-memory.cjs` guarda un JSON nuevo por ejecución en `reports/memory/`. Hace cinco tandas de 1.000 señales con una misma fuente viva; observa también realms distintos durante cinco ciclos de creación/cierre. Por separado comprueba listeners, objetos `handleEvent`, `onabort`, `once`, algoritmos, composición anidada, retirada de trabajo, fuentes recolectadas con metadata nativa retenida, aborto interrumpido por excepción y teardown completo. Observa `Document` y el proxy de `Window` por separado.

Cada endpoint exige dos muestras claras consecutivas, cada una después de dos colecciones major asíncronas en distintos turnos. El límite es de 12 rondas o 10 segundos por escenario. Se guardan todas las rondas, memoria heap/external/RSS y contadores nativos; no se mantiene el resultado de `WeakRef.deref()` entre rondas. Las primeras tandas calientan construcción, callbacks y finalizadores; todas las muestras quedan registradas.

Los contratos públicos se comparan con un jsdom 27.4.0 independiente. Los escenarios de integración compartidos ejercen Jest y Vitest reales. Esto es evidencia finita del corpus ejecutado, no una certificación completa de estándares ni una afirmación de ausencia absoluta de fugas. El cambio no convierte las restantes capas JavaScript del proyecto en Rust.

El registro heredado de `EventTarget` conserva su algoritmo de aborto después de retirar manualmente un listener registrado con `{ signal }`. Ese contrato preexistente no se modifica aquí: un algoritmo aún registrado requiere retención; su remoción explícita mediante `_removeAlgorithm` sí libera el dependiente y está probada.

## Resultados de este cambio

- `cargo fmt --check` y `cargo clippy --all-targets -- -D warnings`: aprobados; `cargo test --locked`: 209/209.
- `npm test`: 640/640 contratos, 8/8 Jest, 19/19 Vitest y 26/26 en VM. Logs completos en `reports/validation/abort-retention/javascript-tests.log`.
- Focal final después de agregar warmup y metadata: 20/20; declaraciones públicas con TypeScript `--noEmit --module NodeNext --moduleResolution NodeNext --target ES2022`: aprobadas.
- HTML5: 1.784/1.784 compatibles; 8 casos `script-on` excluidos. Reporte copiado a `reports/validation/abort-retention/html5lib.json`.
- WPT: 70/70 archivos con paridad respecto de jsdom, sin divergencias nuevas; 42.678/43.708 aserciones aprobadas y 1.030 fallos compartidos con la referencia. El reporte conserva `complete: false`: `range-deletion` sigue bloqueada por un fallo preexistente de jsdom 27.4.0 en el bootstrap con CDATA, fuera del alcance de este fix. Muestras en `reports/compatibility/2026-09-15T13-37-05.933Z-linux-wpt.json`.
- Memoria final: los 18 escenarios alcanzaron su endpoint en dos rondas; 5.000 dependientes posteriores al warmup liberados con la fuente viva; cada tanda terminó con 1 estado de aborto y 0 enlaces. El teardown terminó con 0 estados y 0 enlaces, con `Document` y `Window` recolectados por separado. Entre las tandas medidas, `heapUsed` fue de 30.127.728 a 30.528.152 bytes, RSS de 121.516.032 a 122.261.504 bytes y `external` permaneció en 3.020.114 bytes. Estas muestras incluyen bookkeeping del reporte y calentamiento de realms, no una medida de memoria pico. JSON completo: `reports/memory/2026-09-15T13-35-40.625Z-abort-dependent-retention.json`.

## Benchmark y publicación

Se ejecutó `node --expose-gc benchmarks/compare.cjs abort-lifecycle abort-any abort-propagation`, con cuatro procesos alternados (`jsdom`, `rustdom`, `rustdom`, `jsdom`), tres warmups y nueve muestras medidas por proceso y escenario. Se verificaron resultados equivalentes antes de aceptar cada muestra. Otros builds y tests locales se pausaron durante esta ventana.

| Operación | Señales | jsdom, mediana ms | rustdom, mediana ms | jsdom/rustdom |
|---|---:|---:|---:|---:|
| `abort-lifecycle` | 100 | 0,781 | 1,972 | 0,40× |
| `abort-any` | 100 | 0,334 | 0,689 | 0,49× |
| `abort-propagation` | 100 | 0,474 | 1,679 | 0,28× |
| `abort-lifecycle` | 1.000 | 6,001 | 18,235 | 0,33× |
| `abort-any` | 1.000 | 2,186 | 4,957 | 0,44× |
| `abort-propagation` | 1.000 | 3,429 | 15,926 | 0,22× |

El motor actual y sus cruces con V8 son más lentos que jsdom en estos escenarios. Las muestras no aíslan el costo del fix respecto del HEAD anterior; no se afirma una mejora de rendimiento. El tiempo incluye las APIs públicas y su puente nativo, excluye carga inicial de módulos y preparación/cleanup del fixture. Todas las muestras, versiones disponibles, hardware, fuentes medidas, hashes y límites están en `reports/benchmarks/2026-09-15T13-49-47.516Z-linux-x64.json` y su resumen `.md`.

El refresh de publicación detectó que `main` avanzó de `b9bbf64a67a9acb42ce30524d732fd348819daba` a `6a89cdc16e9d7abcb2d462947a53dd50e141cb6c`. El segundo es el merge de PR 44 y tiene exactamente el mismo árbol `0981699a0c8ebb1e2d18e7c0fdd6f7537b46d980` que `6327602a413bb0cfeb90dc6410d914c4cd171563`, ancestro del HEAD introductorio validado. La rama `feature/native-abort-signal` permaneció en `16ad4ebcc61e8e5e4a93d7cea29520a0c8b20573`. El avance de base no incorpora código ausente de la implementación probada: se conservan los gates y se publica sin rebase ni force-push.

Antes de publicar, `main` avanz� otra vez a `13f638bcade01fd80679236ccab4e7f891c78937` mediante un merge externo del PR 64. GitHub marc� el PR 54 como integrado a las 13:50:38 UTC del 15 de septiembre de 2026. La publicaci�n se detuvo: este commit local conserva el fix validado sobre el HEAD introductorio, y el orquestador debe trasladarlo al PR abierto autorizado y validar su integraci�n. No se hizo push sobre la rama cerrada. La comparaci�n fresca est� en `reports/validation/abort-retention/base-refresh.json`.
