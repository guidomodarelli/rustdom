# Resultado del diagnóstico AA de Range

La única captura `range-control-aa-telemetry-v1` terminó correctamente. El replay
estricto está completo y es byteidéntico en Node 22.12.0 y 24.14.1.
Es un diagnóstico instrumentado: `performanceAccepted=null`,
`gateReevaluated=false`. Los rechazos históricos de ownership permanecen vigentes.
El runtime sigue híbrido; este paquete no añade implementación Rust ni califica
el candidato B o el prototipo de StaticRange.

## Procedencia y preservación

- Repositorio `guidomodarelli/rustdom`, PR #80.
- [Run 40154725015](https://github.com/guidomodarelli/rustdom/actions/runs/40154725015), job `121053535757`, intento 1.
- Fuente de captura `d5ec4186d2033709e532bc93d6f47d930afe525f`; un único evento de etiqueta `34161128543`.
- Artifact `12585116890`: `range-control-aa-telemetry-d5ec4186d2033709e532bc93d6f47d930afe525f-attempt1`.
- ZIP original: 334895287 bytes, SHA256 `a55d06f0d237b8066536a3ae66c6ab663435dc70c151894c23cb1e6736b61cac`.
- Tar XZ original: 334797896 bytes, SHA256 `c523e4a26f9f22ca89eec82cc86b15a03f6a1ae40e1e84f134eeb636b5722928`.

Ambos originales están íntegros en 26 fragmentos de hasta 25 MiB; `parts.json`
registra tamaño y hash de cada parte y de cada archivo completo. No se cambió
ningún byte del ZIP/tar. `metadata/` conserva respuestas API, logs, observaciones
anteriores y finales, manifiesto completo de extracción e índice original.
La autenticación vincula ID, run, commit, intento, nombre, tamaño y digest API;
el lector comprueba además CRC ZIP y contenido tar. La extracción contiene
12517 miembros: 11178 archivos regulares (3610294760 bytes) y 6 enlaces.
Los scripts dentro del archivo son solo evidencia y no deben ejecutarse.

Se preservan los 599 pins del método y su recibo canónico
`reports/validation/native-class-ownership/range-control-telemetry-method/review.json`
(SHA256 `bdab7f4639f99054c93b1f4f962f233a9e5feb98db6ea6c708de4da87e5be9fb`).
Los paquetes preparados no se reconstruyeron ni sustituyeron; solo A0/A1 y
J0/J1 participaron. B fue autenticado durante la preparación y quedó sin usar.

## Alcance ejecutado

Se verificaron 256 procesos independientes, 2304 duraciones medidas, 768 warmup,
3072 Window y 3072 Document por separado, 128 perfiles CPU y 128 logs JIT.
Cada proceso conserva tres rondas de limpieza y dos estados finales claros:
512 estados finales claros, cero primeras rondas no claras. Hay tres snapshots
del proceso padre y baselines nativos originales. Se conservaron 273 deltas CPU
negativos; no se corrigieron, descartaron ni completaron muestras.

Captura: `2026-10-25T02:32:14.838Z` a `02:59:22.836Z` (unos 27 min 8 s).
Presupuestos originales: captura 55 min, step 65, job 90, archivo 15, upload 10.
Máquina Linux `6.8.0-1064-azure`, 4 CPU visibles AMD EPYC 7763 y
16765407232 bytes de memoria total. Versiones, hashes de ejecutables,
semillas, filas, warmup e instrumentación permanecen en el índice/archivo.
No repetir esta secuencia ni agregar muestras.

## Comparación descriptiva de las copias AA

Medianas de las 144 duraciones medidas por etiqueta de cada fila, en ms;
diferencia `100 * (medianaB / medianaA - 1)`. Son muestras instrumentadas,
sin bootstrap, decisión de equivalencia ni comparación contra presupuestos.
Las etiquetas A/B distinguen las dos copias AA: A0/A1 para rustdom y J0/J1 para jsdom, en ambos modos.
La asignación física de etiquetas se invierte según `reverseAssignment`;
`processes.csv` conserva el vínculo original por proceso.
La etiqueta B de esta tabla **no es el candidato B**.

| Node | Modo | Motor | Mediana A (ms) | Mediana B (ms) | Diferencia |
| --- | --- | --- | ---: | ---: | ---: |
| v22.12.0 | cpu | jsdom | 3.323343 | 3.961305 | +19.1964% |
| v22.12.0 | cpu | rustdom | 5.743011 | 5.715231 | -0.4837% |
| v22.12.0 | jit | jsdom | 3.299320 | 3.487260 | +5.6963% |
| v22.12.0 | jit | rustdom | 5.406389 | 5.476306 | +1.2932% |
| v24.14.1 | cpu | jsdom | 2.679267 | 2.660912 | -0.6851% |
| v24.14.1 | cpu | rustdom | 8.894948 | 8.848488 | -0.5223% |
| v24.14.1 | jit | jsdom | 2.765940 | 2.702364 | -2.2985% |
| v24.14.1 | jit | rustdom | 6.600167 | 6.692846 | +1.4042% |

Las dos copias de jsdom en CPU/Node22 difieren +19.1964% en esta descripción;
la diferencia de las copias híbridas en ese mismo modo es −0.4837%.
Se publican todas las filas, también las desfavorables. Estos datos indican
una diferencia que investigar, pero no identifican su causa ni sustituyen
el estimador o el rechazo de los estudios históricos sin instrumentación.

## CPU, GC y JIT

`cpu-frames.csv` conserva 15216 filas con URLs originales, script IDs y conteos
posibles/garantizados separados. Los ticks garantizados del motor híbrido
incluyen `cloneRangeData`, `collapseRange` y `compareRanges`; en Node24 también
aparece la ruta de compatibilidad `RangeImpl.collapse`. `cpu-top-frames.csv`
expone el ranking agregado por Node y motor sin perder las filas completas
de `cpu-frames.csv`, que conservan proceso y etapa.
V8 no garantiza stacks internos Rust; un wrapper puede abarcar trabajo nativo.
Los ticks no son una partición exacta de tiempo ni demuestran causalidad.

Se retienen 4348018 registros JIT `function`; 6184 quedan atribuidos a spans
según las reglas temporales del método: 3963 en medición y 2221 en warmup.
No representan costo JIT ni
prueban una explicación de las regresiones. No hubo intersecciones GC en los
spans medidos bajo este criterio; eso no equivale a ausencia de GC en el run.

`metadata/clock-observations.jsonl` conserva las observaciones originales por
proceso. `clock-intervals.csv` publica offsets y límites sin sustituir ausencias:
anchos CPU de 20.785 a 95.895 µs y JIT de 335.814 a 443.776 µs.
Los límites posibles y garantizados siguen separados; los 273 deltas negativos
están en `cpu-clock-anomalies.csv` y en los datos originales.

## Recursos y límites de memoria

`resources-native.jsonl` conserva baselines, owners, nueve endpoints y todas las
rondas/nativeTree. `native-counters.csv` exporta todas las familias y hojas
mediante JSON Pointer reversible y tipo de valor. No se limita a los cinco
resúmenes; el contrato invierte el CSV y comprueba igualdad con los datos crudos.
`resources.csv` y `memory-description.json` mantienen endpoints y tres snapshots
del padre. Los procesos de referencia conservan la ausencia de baseline nativo.

En los 128 procesos híbridos: 22 referencias de constructores antes y al final,
sin altas/bajas desde el baseline. RangeStates: 7680000 creaciones y liberaciones,
live inicial/final cero. Son contadores del proceso completo, incluidos fixtures,
warmup, validación y teardown; no atribuirlos solo al cuerpo medido. Otras familias
sin altas en este escenario no demuestran cobertura de sus algoritmos.
Ver el [informe de memoria](../../../../memory/native-class-ownership-range-aa-40154725015.md).
Los endpoints no miden memoria pico ni garantizan ausencia universal de fugas.

## Reproducción offline y validación

Usar Python sin `-O`, lectores actuales de `tools/`, un checkout Git Linux real,
limpio, de la fuente capturada y los dos ejecutables Node originales autenticados.
No usar un gitfile Windows desde Git WSL ni normalizar `sourceCommit`,
`sourceChanges` o `sourceGitErrors`. La reconstrucción y replay no ejecutan DOM,
no construyen paquetes, no invocan el sampler ni usan scripts archivados.

Desde la raíz del repositorio, con rutas absolutas a source y Node:

```sh
python3 -B reports/benchmarks/native-class-ownership/range-control-telemetry-results/40154725015/tools/qualify.py \
  "$PWD" "$SOURCE_D5_CLEAN" "$FRESH_OUTPUT" "$NODE22" "$NODE24"
```

El comando autentica recibo/grafo/SDKs, reconstruye los dos originales, extrae
seguro, ejecuta `run.cjs --verify` del source limpio y compara ocho exports.
Hay una ejecución completa registrada en `validation/evidence.zip`.
La API de materialización separada está en `tools/materialize.py`.
Los seis derivados descriptivos también fueron byteidénticos entre Windows y Linux.

Validaciones ejecutadas sobre datos reales:

- Replay estricto y ocho exports: idénticos en ambos Node fijados.
- Contratos Node del analizador: 5/5 por versión.
- Transporte: Linux 8/8; Windows 7 aprobados y un skip de symlink por WinError1314.
- Reconstrucción: 7/7 tanto Linux como Windows; se reconstruyen los dos archivos originales.
- Contratos íntegros del artifact: 9/9; derivados descriptivos: 5/5 en Linux y Windows.
- Calificación completa con extracción fresca, ambos SDKs y salida nueva: exit 0.
- Actionlint: exit 0. El CI del commit de resultados se verificará después del push.
- CI previo del exportador be675a21: run40156502665 aprobado; se conservan ambos artifacts y logs.

Se preservan fallos iniciales: expectativas heredadas del test de 512 procesos
se corrigieron a los 256 reales sin tocar las mediciones. La corrección de
narrativa del inventario se probó con siete contratos reales por Node: el primer
intento en volumen Windows alcanzó el timeout de 30s en Node22; un checkout Linux
inicial carecía de un helper y falló. Tras incluir el helper real sin modificarlo,
7/7 por Node pasan en otro checkout Linux limpio. Los intentos/fallos siguen en QA.
Estos tests de inventario ejecutan jsdom de referencia; son ajenos al sampler y
no se suman a los 256 procesos del diagnóstico. No se repitió ninguna captura.

`validation/evidence.json` autentica el ZIP de QA y sus miembros; los drivers
archivados son solo inspección. Usar las herramientas versionadas actuales.
El workflow `range-aa-result-readers.yml` verifica los datos sin iniciar otro estudio.
El CI histórico de ownership sigue rechazando rendimiento; no se elude ese gate.

## Continuidad

Publicar este resultado mantiene el objetivo general activo e incompleto.
Investigar las fronteras Range a partir de los datos completos y preparar el
siguiente candidato con método prospectivo cuando corresponda. La autorización
permanente cubre ese trabajo; no repetir la captura consumida ni alterar sus pins.
No crear tag ni mergear ownership sin aceptación íntegra y revisión del SHA final.
