# Fixture Abort en el paquete instalado y Vitest VM con Node 22

El fallo pertenece al cargador del fixture incorporado en `074fcef4c1177e675d22cc5eae1a4b8bb1165254`. Los contratos de Abort no llegaron a ejecutarse: ambos pools rechazaban una dependencia ESM de jsdom al cargar `realm.vm.mjs`. El cambio usa el `createRequire` del módulo real de Node para obtener `JSDOM` mediante la entrada pública del paquete. No modifica el runtime, las expectativas, las dependencias ni la configuración del runner.

## Alcance y artefacto

- Handoff: `pr67-abort-installed-vm-node22`.
- Fixtures sobre `e717ba14b7bd6683eebe3380c729ca8f2f1b2134`, rama `feature/native-form-data`.
- Base informada y verificada al iniciar: `main` en `ece7d46c9cdb94eea3c23e517b341771ee9719d4`. No se incorporó `main` al clon.
- Paquete real de la unión preparada por la tarea principal, sin recompilar ni modificar: SHA-256 `a8ac710e142c4c478eec29838aa791db15d4c2c96f4f0ce8d36e39a32bafd9b2`.
- Addon: SHA-256 `611662173a9d013e616465562bbfded264f58a0950af059499e5528f54751838`, Linux x64 glibc 2.35, N-API 8. El binario fue construido con Node 24.20.0.
- La reproducción usa las dependencias y el npm lock guardados por el chequeo fallido original `2026-09-15T17-46-26.382Z-linux-x64`. `consumer.json` conserva la ruta del artefacto, sus hashes y versiones.
- Esta evidencia corresponde a ese artefacto. No certifica las correcciones posteriores de FormData/XML que la tarea principal integra por separado.

## Diagnóstico y decisión

Vitest 5.0.0 reemplaza `createRequire` dentro del VM con su `CommonjsExecutor`. Su soporte para cargar ESM de manera síncrona depende de `SourceTextModule.prototype.hasAsyncGraph`. La observación real con `--experimental-vm-modules`, conservada en `vm-loader-capabilities.jsonl`, devuelve `undefined` en Node 22.12.0 y `function` en Node 24.20.0. El cargador propio de Node 22.12 sí puede cargar el paquete fuera de ese ejecutor VM, como también hace el environment real antes de entrar al VM.

La entrada ESM pública se probó primero y también falló: `dist/index.mjs` importa el runtime CommonJS, que vuelve a entrar en el mismo cargador VM. Se conserva ese intento completo. No se aplicó la sugerencia automática de Vitest de modificar la configuración de dependencias.

El fixture ahora obtiene `createRequire` desde `process.getBuiltinModule('node:module')` y conserva el specifier público `@rustdom/rustdom`. El helper compartido sigue cargándose normalmente dentro del VM. Se crea y cierra un `JSDOM` real por ejecución; no se incorpora ninguna API de producción para pruebas.

| Variante sobre el mismo paquete | Node | Resultado |
| --- | --- | --- |
| `createRequire` importado dentro del VM | 22.12.0 | Rojo: 2 suites realm sin tests; 22 tests de plataforma pasan |
| Entrada ESM pública | 22.12.0 | Mismo rojo de carga ESM |
| Cargador real de Node, entrada pública | 22.12.0 | 4 archivos y 30 tests pasan; ambos pools reales |

Se conservan sin cambios el delta exacto de tres `NativeAbortState`, la traza nativa `source, signal, nested`, los estados y razones propagados, la idempotencia y la prueba independiente de señal host hacia DOM. El fallo no se corrigió modificando órdenes esperados ni evitando los pools VM.

## Memoria

El helper real `tests/helpers/abort-runner-memory.cjs` se ejecutó sobre el paquete instalado en Node 22.12.0 y 24.20.0. En el consumidor sólo se adaptó su import relativo del environment a la entrada pública `@rustdom/rustdom/vitest`; se copiaron sin cambios el helper compartido y el observador de memoria. Se mantuvieron vivas las callbacks registradas y el environment padre durante cinco ciclos de creación/abort/cierre.

Ambas versiones pasaron 11/11 tests. Se observaron por separado cinco `Window` y cinco `Document`: todos se recolectaron en dos muestras claras separadas por turnos del event loop, y los estados Abort nativos vivos regresaron al valor inicial. `fixture-gc-node*.log` y `fixture-memory-node*.json` guardan los TAP y las muestras crudas de heap, memoria externa, RSS y referencias débiles. Es una comprobación finita del ownership de este fixture; no una afirmación de ausencia universal de fugas.

## Comandos reproducibles

La reproducción en un consumidor instalado, con el lock original, ejecutó:

```sh
npm ci --ignore-scripts --no-audit --no-fund --cache "$consumer/.npm-cache"
node node_modules/vitest/vitest.mjs run --config vitest.vm.config.mjs
```

La memoria se comprobó con:

```sh
env -u NODE_TEST_CONTEXT node --expose-gc --test --test-reporter=tap tests/helpers/abort-runner-memory.cjs
```

El chequeo completo de cada versión usa el comando existente y el manifiesto del mismo artefacto:

```sh
npm run test:package -- "$artifact_manifest"
```

Los consumidores del chequeo completo se crean fuera del checkout. El script original instala npm y pnpm con `node-linker=isolated` y `hoist=false`, ejecuta consumidores públicos y runners reales, guarda reportes y lockfiles y elimina sólo sus consumidores propios exitosos. Se conserva el consumidor de reproducción con su instalación congelada; `realm-before.vm.mjs.txt` permite restaurar el fixture original y los logs retienen ambos fallos de carga. No se midió rendimiento porque el runtime no cambió.

## Herramienta npm del chequeo completo

El primer `test:package` utilizó accidentalmente npm 10.9.0, incluido en Node 22.12.0. Se detuvo en `npm-install` con `Cannot read properties of null (reading 'edgesOut')`, el fallo previo ya documentado en `../ci-npm.md`. No llegó a ejecutar consumidores. Su reporte es `../../distribution/2026-09-15T18-14-17.042Z-linux-x64.json`; el log y stack se conservan como `package-node22-npm10-failed.log` y `npm10-arborist.log`.

Para el chequeo definitivo se instaló npm 11.19.0 únicamente en `.tools` del clon y se ejecutó su CLI bajo cada runtime exacto. Es la versión fijada en el workflow; no se cambió el lockfile ni las dependencias del proyecto y no se usó `--force` ni `--legacy-peer-deps`. Este fallo de herramienta se mantiene separado del error ESM de Vitest reproducido con una instalación congelada correcta.

## Resultado final del paquete

| Runtime | npm | pnpm aislado | Jest por instalador | Vitest por instalador | VM por instalador |
| --- | --- | --- | --- | --- | --- |
| Node 22.12.0 | 10/10 gates | 10/10 gates | 18/18 | 29/29 | 30/30 |
| Node 24.20.0 | 10/10 gates | 10/10 gates | 18/18 | 29/29 | 30/30 |

Se verificaron `pass=true`, 20 subprocesses con `exitCode=0`, sin señales ni errores de spawn en cada reporte:

- `../../distribution/2026-09-15T18-20-18.439Z-linux-x64.json`: Node 22.12.0.
- `../../distribution/2026-09-15T18-23-30.562Z-linux-x64.json`: Node 24.20.0.

Ambos conservan los lockfiles npm/pnpm correspondientes y el hash del mismo artefacto. `package-matrix.json` resume las comprobaciones de integridad y los conteos extraídos de la salida de los runners. Los VM ejecutaron realmente `vmForks` y `vmThreads`; cada uno incluyó los dos contratos compartidos de Abort y los tests React/plataforma.

No se repitió el build Rust ni se reutilizó otro binario como si fuera nuevo: el cambio es exclusivo del fixture y los gates ejecutaron el artefacto identificado arriba. La tarea principal debe construir y validar nuevamente la unión que incluya sus otras correcciones de runtime antes de publicarla.
