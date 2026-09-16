# AbortSignal en runners: diagnóstico de Node 24.20

El HEAD `755fc7175c35c857b08b520dc2e66d20e7526a1b` fallaba en el contrato compartido de orden de aborto de Vitest. Se reprodujo localmente con **Node 24.20.0**, la versión usada por CI. Linux y macOS reportaban `source → nested → signal`, mientras el test esperaba `source → signal → nested`.

Evidencia de CI: [Linux](https://github.com/guidomodarelli/rustdom/actions/runs/34987853384/job/104444484799) y [macOS](https://github.com/guidomodarelli/rustdom/actions/runs/34987853384/job/104444484926). La reproducción local roja está en `abort-runner-node24/ci-reproduction.log`.

## Causa

El problema estaba en el fixture del test. `window.AbortController` no identifica necesariamente la implementación Rust: el bridge de Vitest expone deliberadamente los constructores de Node y los asigna también a `jsdom.window`. `populateGlobal` hace además que `window` sea un alias del global del runner. Por eso cambiar a `jsdom.window` tampoco resolvería esta confusión.

Se ejecutó el mismo escenario contra cuatro superficies reales, con constructores host capturados antes de instalar el entorno y el contador público `abortStates.created`:

| Superficie | Node 24.14.1 | Node 24.20.0 | Estados Rust creados |
|---|---|---|---:|
| Host Node | source, signal, nested | source, nested, signal | 0 |
| jsdom 27.4.0 puro | source, signal, nested | source, signal, nested | 0 |
| rustdom puro | source, signal, nested | source, signal, nested | 3 |
| Entorno Vitest puenteado | source, signal, nested | source, nested, signal | 1 |

El único estado Rust del entorno puenteado corresponde a traducir la señal host al listener DOM. El test anterior no ejercía la composición nativa que decía verificar; en Node 24.14 el orden coincidía de forma accidental.

La inspección del `internal/abort_controller` real de ambos ejecutables mostró un cambio de Node: 24.20 usa `followCompositeSignal` desde `kNewListener` y registra dependientes al observarlos. El listener DOM de `nested` se registra antes del `onabort` de `signal`, por lo que el `SafeSet` host contiene ese orden. No es una iteración aleatoria de HashMap de Rust: rustdom conserva sus enlaces ordenados mediante `BTreeMap` y mantiene el orden de jsdom en ambas versiones.

La matriz reproducible está en `abort-runner-node24/probe-v24.14.1.json` y `probe-v24.20.0.json`. El helper `tests/helpers/abort-runner-probe.cjs` vuelve a producirla con la versión de Node que lo ejecuta.

## Corrección final y alcance

- La prueba nativa mantiene la expectativa exacta `source → signal → nested` y exige exactamente tres estados Rust: señal del controller y dos composiciones. Verifica razones y marcado previo al callback de la fuente.
- Jest reutiliza su Window DOM nativo ya instalado. Las entradas ESM de Vitest y VM proporcionan una factory real de `JSDOM` independiente, cargada por Node antes de registrar el helper. El helper cierra en `finally` únicamente las instancias que crea. El contador nativo impide que una selección accidental del constructor host vuelva a pasar por coincidencia de orden.
- Una prueba distinta usa los globals reales del runner y comprueba que una señal compuesta cancela el listener DOM antes de su observador de aborto, con traza exacta `work → source → abort`, razón preservada e idempotencia. Limpia `onabort` y sus listeners en `finally`, después de las assertions.
- Ambas pruebas se comparten entre Jest, Vitest, vmForks y vmThreads mediante `tests/integration/abort-suite.cjs`. El fixture recibe explícitamente el global de cada VM y, cuando corresponde, la factory del DOM propio.
- `tests/helpers/abort-runner-memory.cjs` ejecuta cinco ciclos del helper real con Node Test y assertions estrictas de Node, dentro del entorno real. Observa cada Document y Window con WeakRef mientras el padre y los callbacks de test siguen vivos, y comprueba la vuelta del contador de señales nativas a su baseline.

El runtime y la expectativa nativa se mantienen. Solo se corrige la selección del fixture y se agrega cobertura explícita por modo. No hay cambios en `src/`, Cargo ni dependencias. No se generaron benchmarks nuevos: los anteriores corresponden a Node 24.14.1 y no se presentan como mediciones de Node 24.20.

## Evidencia que definió el fixture final

Jest redirige tanto `require` como `createRequire` y `process.getBuiltinModule` a su registro aislado. Intentar importar el paquete completo desde ese contexto falló al cargar la dependencia ESM `@exodus/bytes`; los dos errores están preservados en `fixture-loader-before.log` y `fixture-loader-create-require-before.log`. El fixture final solo importa el subpath público `/native` para leer contadores. La factory que necesita JSDOM se suministra desde las entradas ESM de Vitest/VM, donde se usa el cargador normal de Node; Jest no necesita volver a importar JSDOM.

También se evaluó un iframe real: seleccionaba correctamente el motor nativo y daba delta 3, pero cinco ciclos conservaron los cinco iframe/Document/Window mientras vivía su padre. La ruta de frames conserva ventanas en `windowsInSameOrigin`. La evidencia está en `iframe-probe.log`, `frame-memory-node24.20.log` y `frame-memory-v24.20.0.json`. Esa variante se descartó y no se publicó como checkpoint; sus resultados de runners se archivaron bajo `iframe-runners/`.

Con instancias independientes se liberaron los cinco Window/Document. La prueba adicional mostró que los listeners propios de la prueba host debían limpiarse explícitamente en Node 24.14; la evidencia previa está en `host-listener-cleanup-before.log`. Después de limpiar esos callbacks sin cambiar ninguna assertion de comportamiento, ambos Node terminaron con los objetos recolectados y el contador nativo en baseline. Los reportes finales son `fixture-memory-v24.14.1.json` y `fixture-memory-v24.20.0.json`.

## Entorno reproducido

WSL Ubuntu 22.04 x64. Node 24.20.0 se instaló dentro del clon desde `https://nodejs.org/dist/v24.20.0/node-v24.20.0-linux-x64.tar.xz`; su SHA-256 `2f2c0da162318f0de47665410c7c8c2ed3d36c8f3105de4bbc61176c70a7cbf2` se comprobó contra `SHASUMS256.txt` oficial. La versión comparada anterior fue Node 24.14.1. El addon real conserva su hash `fb12b3d1fa14ec020cf520734b30b927176bff4dc3632e3b9fe8072f882b89cd`.

El cambio se aplica sobre PR 67, sin incorporar todavía el nuevo `main` `068f3bc3e65fe1c07a0dc6855bfc3f830f10a5d7`; esa integración está a cargo del orquestador.

## Validación final

| Node | Jest real | Vitest real | vmForks + vmThreads |
|---|---:|---:|---:|
| 24.20.0, versión de CI | 18/18 | 29/29 | 30/30 |
| 24.14.1, versión local anterior | 18/18 | 29/29 | 30/30 |

Además, en Node 24.20 pasaron 54 contratos de AbortSignal, listeners y entorno, incluyendo los procesos reales de GC. El helper de memoria pasó 11/11 tests en cada versión: cinco ciclos de las dos pruebas compartidas más la comprobación agregada de recolección y contador nativo. Los logs finales de runners están en la raíz de `abort-runner-node24/`; `iframe-runners/` conserva solo la variante descartada.

Se conectó el helper a `tests/abort-native.spec.cjs` para que forme parte del gate normal. El runner hijo se inicia sin `NODE_TEST_CONTEXT`, porque heredar `child-v8` hace que Node interprete `--test` como ejecución recursiva y omita los archivos. Se registró ese caso en `ci-wiring-context-before.log`, se corrigió el aislamiento del proceso y la prueba exige código 0 junto a los resúmenes TAP de **11 tests ejecutados y 11 aprobados**. La conexión final pasó en `fixture-memory-ci-wiring.log`; no se acepta una ejecución vacía como éxito.

`git diff --check` pasó. La validación de runtime/Rust previa se conserva porque esta corrección no modifica código de producto. Durante la tarea, el orquestador integró PR 65 y `main` avanzó a `b40532e1e25adc08cceb192b31d191837ead2b2d`; siguiendo el handoff no se incorporó ese main a la rama 67. Se refresca únicamente su HEAD antes de publicar.
