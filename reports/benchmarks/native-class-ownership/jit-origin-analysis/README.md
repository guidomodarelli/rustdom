# Origen de los registros de funciones de V8

Análisis offline de la captura autorizada 39959175058. No se ejecutaron
nuevos benchmarks, perfiles, DOM ni ciclos de GC. El CI general del commit
de evidencia `0a9e851a`, run 39962409292, aprobó sus ocho jobs.

Se leyeron los 32 logs JIT completos: 1.107.823 registros `function` y los
384 intervalos originales de esos procesos (96 warmups y 288 medidos).
Los otros 32 procesos de la captura registran CPU y no tienen log JIT;
su ausencia no se convierte en cero. La evidencia original íntegra sigue
en `jsdom-telemetry-results/39959175058/`.

## Vinculación y alcance

El campo `scriptId` de cada registro `function` se vincula con `script-details`
del mismo proceso, independientemente del orden de sus líneas. Se conserva el
origen desconocido cuando no hay detalles. La clasificación usa las rutas
originales autenticadas: paquetes J0/J1 completos para jsdom, node_modules
compartido para dependencias, la copia derivada para el arnés y `node:` para
Node. No se deduce el origen por el nombre de una función.

El formato se comprobó en las fuentes primarias de
[Node 22.12.0](https://github.com/nodejs/node/blob/v22.12.0/deps/v8/src/logging/log.cc#L1610-L1648)
y [Node 24.14.1](https://github.com/nodejs/node/blob/v24.14.1/deps/v8/src/logging/log.cc#L1674-L1713).
`AppendFunctionMessage` publica el ID, posiciones, delta y timestamp;
`ScriptDetails` publica el ID y URL. El delta numérico se conserva como
`loggedTimeDelta`, sin interpretarlo como duración CPU ni pausa.

Se mantienen acciones diferentes como `turbofan`, `maglev`, `baseline` y
`first-execution-*`, sin equiparar sus conteos como compilaciones. No se
suman los registros `code-creation` que pueden describir el mismo código.
Los conteos globales incluyen todas las acciones y fuentes. Los logs íntegros
siguen en el artefacto original, sin quitar registros por tamaño, dirección
temporal o resultado favorable.

## Qué cambia este diagnóstico

Registros que pueden intersectar operaciones **medidas**, sobre 144 intervalos
por Node. «Contenidos» exige pertenencia para todos los offsets del envelope
observado; no garantiza una cota universal de deriva del reloj.

| Node | Fuente | Acción | Posibles | Contenidos |
| --- | --- | --- | ---: | ---: |
| 22.12.0 | jsdom | turbofan | 196 | 171 |
| 22.12.0 | arnés | turbofan | 21 | 18 |
| 24.14.1 | jsdom | turbofan | 74 | 68 |
| 24.14.1 | jsdom | maglev | 88 | 79 |
| 24.14.1 | arnés | turbofan | 21 | 18 |
| 24.14.1 | arnés | maglev | 5 | 5 |

Son registros de emisión, no funciones únicas, llamadas ni tiempo de ejecución.
`summary.json` conserva también Node, dependencias y primeras ejecuciones;
la tabla destaca las acciones de optimización relevantes al calentamiento.

Las funciones del arnés con registros contenidos incluyen `control` y
`lifecycle` en ambos Node; en Node 24 también `produce` y `validate`. El
calentamiento actual ejecuta las operaciones públicas tres veces en el realm
actual. La presencia de registros posteriores demuestra que ese recorrido
no asegura que toda la actividad de tiering ya haya terminado. Tampoco
demuestra que esa actividad haya causado una pausa o los trece rechazos.

La siguiente revisión del calentamiento debe cubrir tanto código de jsdom
como sus consumidores del arnés y conservar las fronteras de creación,
warmup, medición, validación y cleanup. No hay fundamento para elegir un
número fijo de rondas a partir de estos dos extremos de semilla. Una ruta
prospectiva debe validar el trabajo público y el teardown, declarar antes
de medir su secuencia completa y conservar todas las muestras y controles
±2% de jsdom, ±5% Rust AA y +5% Rust AB. Los eventos por sí solos no sirven
como criterio suficiente de estabilidad ni como sustituto del gate.

No se modifica el sampler, el runtime, el estimador ni los presupuestos del
estudio consumido. `accepted:null` y `gateReevaluated:false`; ownership sigue
rechazado. No se lanza otra captura, no hay tag ni merge y la migración
posterior espera el cierre de este hito.

## Comprobación y reproducción

El índice original está fijado por SHA256 en `constants/inputs.json`. Se
autentican logs, reportes y análisis antes de leerlos. Los lectores Node
22.12.0 y 24.14.1 produjeron bytes idénticos. `verification.json` registra sus
hashes y `function-records.json.gz` conserva el resultado completo: conteos
de todos los registros por fuente/acción y cada registro que intersecta una
operación, con su línea original, ID, URL y margen temporal. Los conteos
por etapas vecinas pueden compartir registros posibles; no son disjuntos.

Pasaron seis contratos en cada Node con los 32 logs reales: conservación de
registros e intervalos contra el lector anterior, límites de directorio,
vinculación por ID aunque los detalles vengan después, fuentes desconocidas,
IDs contradictorios, identidad alterada y errores reales de CLI sin sobrescribir.

Desde este checkout, usando la captura original extraída en Linux:

```sh
RUSTDOM_JSDOM_TELEMETRY_ROOT=/ruta/jsdom-telemetry \
node --test reports/benchmarks/native-class-ownership/jit-origin-analysis/contracts.spec.cjs
node reports/benchmarks/native-class-ownership/jit-origin-analysis/function-origins.cjs /ruta/jsdom-telemetry /ruta/origenes-nuevos.json
```

El lector mantiene estructuras escalares por proceso y conserva únicamente
los registros de operaciones en su resultado; el log original completo sigue
archivado. No crea Window, Document, timers, observers ni referencias N-API.
Este análisis no agrega observaciones de memoria ni certifica ausencia de
fugas; las 768 Window/Document y 128 endpoints finales claros siguen siendo
la evidencia finita de la captura anterior.
