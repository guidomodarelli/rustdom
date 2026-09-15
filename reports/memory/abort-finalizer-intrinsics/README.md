# GC de Abort con métodos privados reemplazados

En Node 22.12.0 y 24.20.0, procesos independientes de rustdom y jsdom 27.4 ejecutaron cinco ciclos de 200 señales. Mientras el Window permanecía vivo se reemplazó `Map.prototype.delete` por un hook real que arroja al encontrar una entrada numérica con WeakRef. El primer ciclo sirve como warmup observable; cada ciclo incluyó 30 colecciones mayores asíncronas separadas por turnos del event loop. Un FinalizationRegistry independiente confirmó 1000 señales recolectadas por proceso.

En los cuatro procesos: hook 0, excepciones no capturadas 0 y señales sobrevivientes 0. Después de restaurar el descriptor en `finally`, se cerró el Window, se soltó el JSDOM y se observaron Window y Document por separado: ambos fueron recolectados. Rust liberó los 1000 estados creados; live, links y algorithms regresaron a 0.

| Motor / Node | Heap primer ciclo MiB | Heap último ciclo MiB | RSS final MiB | Externa final MiB |
| --- | ---: | ---: | ---: | ---: |
| jsdom / v22.12.0 | 27.156 | 27.165 | 113.461 | 2.733 |
| jsdom / v24.20.0 | 27.944 | 27.970 | 111.844 | 3.156 |
| rustdom / v22.12.0 | 27.455 | 27.463 | 120.117 | 2.754 |
| rustdom / v24.20.0 | 28.241 | 28.274 | 114.281 | 3.168 |

Las muestras crudas guardan heap, memoria externa, ArrayBuffers, RSS, witness y supervivientes por ciclo. No se interpreta RSS del allocator como una fuga ni se afirma ausencia universal de retención a partir de cinco ciclos.

También se conservaron los reportes existentes de ownership ejecutados por `npm test` en cada Node: cinco ciclos de 1000 dependientes descartados con source vivo, listeners/onabort/algoritmos activos, eliminación de observadores, entrega interrumpida, handles nativos independientes y teardown de realms extranjeros. `dependent-retention-v*.json` conserva endpoints con dos muestras claras y baseline nativa; `abort-state-v*.json` cubre razones/callbacks y handles nativos. `runner-fixture-node*.json` conserva la liberación de los cinco Window/Document del fixture real compartido con Jest/Vitest/VM.

Comando focal: `node --expose-gc tests/helpers/abort-intrinsics.cjs <rustdom|jsdom> finalizer-delete`, con `ABORT_INTRINSIC_REPORT` apuntando al JSON de salida. El proceso usa `uncaughtExceptionMonitor` sólo para guardar escalares: las excepciones mantienen su terminación con error y el test padre exige exitCode 0. El rojo original se conserva en `../../validation/abort-finalizer-intrinsics/baseline-rustdom-finalizer.log`.
