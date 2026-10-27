# Confirmación de ownership por bloques completos

Este incremento implementa el calendario y el comparador que necesita la
próxima comparación Rust/jsdom. **No corrige todavía el gate rechazado ni
habilita una captura.** `executionReady=false`. No contiene un productor
científico ni un lector integral de paquetes, procesos y recursos. Los ocho
contratos numéricos y el lector de planificación no sustituyen esas piezas.

El CI de la fuente `4196c496` tiene dos fallos: `Native class ownership Node
22` y `Node 24`, en el último paso de replay de `39921160254`. Esa captura se
verifica pero conserva `accepted=false`: 13/32 controles jsdom no calibraron
dentro de ±2%. El CI general pasa. Publicar un piloto nuevo no cambia ese
rechazo y volver a ejecutar ese check no lo resolvería.

## Método propuesto

Se compararán los 64 criterios originales: dos SDK, AA/AB, jsdom/Rust y ocho
cargas. Cada criterio conserva los 16 factores originales, sus semillas,
asignación física de paquetes y orden A/B. La posición temporal rota mediante
un cuadrado cíclico completo; se repite dos veces para jsdom y una para Rust.
Los 32 procesos de cada bloque se ejecutarán de forma secuencial en un mismo
host. Cada proceso conserva las 144 duraciones medidas, 48 de warmup y los
12 pares Window/Document del sampler vigente.

Una observación para el intervalo es el **par de medias aritméticas de un
bloque completo de factores**: 32 pares para jsdom y 16 para Rust, con 31 y
15 grados de libertad. No se consideran independientes las 144 tareas de
un proceso, ni los 16 factores deterministas de un bloque. Se reutiliza el
kernel Fieller existente y los presupuestos originales sin ampliarlos:
jsdom AA/AB ±2%, Rust AA ±5%, Rust AB límite superior +5%.

Los valores críticos bilaterales 95% son 2,040 para 31 grados de libertad
y 2,132 para 15, redondeados hacia arriba respecto del cuantil exacto. Los
intervalos son puntuales bajo el modelo de bloques iid-normal. No se ha
demostrado independencia, cobertura simultánea, potencia ni transferencia
de varianza entre máquinas. El comparador numérico siempre deja
`captureAuthenticated=false`, `performanceAccepted=null` y
`gateReevaluated=false`. Solo un futuro replay integral podrá decidir sobre
una secuencia auténtica, completa y previamente publicada.

La próxima secuencia usaría exclusivamente muestras nuevas del candidato
sellado `a2777cbf`, artifact `12628261403`, archivo `fb06276a`. No incorpora
muestras del piloto, no completa parciales ni permite reintentos, parada
opcional o cambios posteriores de filas, semillas, warmup y presupuestos.
Los estudios históricos y sus rechazos permanecen intactos.

## Elección de tamaño y límites de tiempo

El piloto completo `40426500725` tiene 32 criterios jsdom y 16 bloques por
criterio. Sus dos archivos de análisis/recursos se conservan aquí **sin
modificaciones**, con sus SHA publicados fijados en `constants/design.json`.
El peor tiempo observado del supervisor es 109,4793 minutos. La proyección
lineal para 32 bloques, tomando el máximo entre ese dato y la estimación
histórica, más un margen de 25%, es 273,6983 minutos.

Rust no se midió en ese piloto. Sus 16 bloques se eligen por capacidad de
ejecución y equilibrio de factores, **no por una varianza estimada a partir
de jsdom ni por una promesa de potencia**. La estimación histórica de 251,2
minutos para 16 bloques, con el mismo margen, da 314 minutos. No garantiza
el tiempo del candidato nuevo. La alternativa de 32 bloques Rust daría
628 minutos y se rechaza por exceder este límite.

La propuesta fija 320 minutos de captura y 350 de job: reserva otros 30
para setup, archivo, subida y margen. Está por debajo del límite de seis
horas de un job hosted. Estas estimaciones son planificación, no una fecha
de finalización del PR ni mediciones del próximo run.

También se conservan los 64 escenarios de incertidumbre de los 32 controles:
se mantiene hipotéticamente cada media observada y el límite superior de SD
del piloto, usando el futuro tamaño fijo de 32 bloques. **Un escenario sigue
con margen negativo**: Node 22 AA `observer-delivery-records/1000`, límite
inferior. No se oculta ni se cambia el presupuesto para que pase. No es una
predicción de fallo o éxito: el escenario mantiene valores que pueden cambiar
en una muestra nueva y no estima potencia.

Denominadores de la propuesta: 49.152 procesos, 7.077.888 medidas, 2.359.296
warmup, 589.824 Window y 589.824 Document por separado, 147.456 estados de
cleanup, 98.304 finales claros requeridos y 192 snapshots parentales. El
productor pendiente deberá preservar también primeras rondas no claras,
baselines nativos, parciales y todos los resultados desfavorables. Los
snapshots no permiten afirmar memoria pico ni ausencia universal de fugas.

## Uso y alcance probado

```sh
METHOD=reports/benchmarks/native-class-ownership/block-confirmation
node --test "$METHOD/compare.spec.cjs" "$METHOD/plan.spec.cjs"
node "$METHOD/plan.cjs" "$METHOD/planning-inputs" > plan.json
python -B "$METHOD/audit.py" plan.json
```

Las fixtures de comparación son sintéticas e identificadas como tales.
Validan comportamientos: reducción por bloques, calendario completo,
presupuestos, rechazo de parciales/duplicados/otros métodos/otros hosts,
cronología, salidas públicas distintas y imposibilidad de aceptar rendimiento
desde este módulo. El CLI y la auditoría usan los archivos publicados reales;
un cambio de bytes se rechaza antes de producir un informe. No ejecutan DOM.

El productor funcional y su lector ya ejercen Rust y jsdom en ambos SDK.
La matriz final tiene 64 workers por SDK: AA/AB, ocho cargas, ambos motores
y labels A/B, con el factor 0. Verifica las cinco copias físicas, todos los
outputs públicos, 144 tareas medidas y 48 warmup por proceso, baselines
nativos y tres rondas de cleanup con Window/Document separados. La variación
de factores y rotación del calendario se prueba aparte; esta matriz funcional
no ejecuta todos los bloques de la futura secuencia científica.

El nuevo `raw-reader.cjs` adapta el contrato de tareas/recursos anterior a los
hashes del paquete sellado actual, sin reescribir los reportes ni modificar
los lectores históricos congelados. `envelope.cjs` contrasta el contexto
contra la invocación y fuentes observadas por el padre. Los datos funcionales
nunca producen una observación estadística ni aceptación. El cierre del
controlador comprueba cancelación y plazo después del GC y del postflight;
cinco regresiones usan GC, SIGTERM y esperas reales, sin mocks de plataforma.

Pasaron 17 tests Node y tres Python por SDK, más las matrices reales y seis
casos adversos por SDK. Los resultados completos están en
`../block-confirmation-functional/20261027/`; los endpoints en
`reports/memory/block-confirmation-functional/20261027/` desde la raíz del repo.
Se conservan dos preflight locales fallidos antes de DOM por un staging
incompleto y una matriz Node22 anterior al arreglo de cancelación; esta última
no se suma a los 128 procesos finales. No se repitió una secuencia científica.

La fuente de producción todavía difiere del candidato en cuatro archivos:
`src/dom/native-tree.cjs`, `src/dom/range_state.rs`,
`src/dom/range_state_binding.rs` y `types/native.d.cts`. La integración y su
equivalencia con los 344 inputs compilados deben verificarse antes de atribuir
al PR la aceptación del candidato. No reconstruir ni sustituir paquetes
consumidos. Los verificadores históricos deben conservar sus fuentes/pins;
no adaptar esas pruebas para ocultar la diferencia de producción.

Faltan el productor científico, autenticación integral, integración del
candidato y su revisión, publicación del método completo y una captura única.
Después habrá que integrar su decisión íntegra al gate.
No hay tag ni merge de ownership antes de aceptación. La autorización
permanente cubre el trabajo restante sin nuevas preguntas.

Referencias: [límites oficiales de Actions](https://docs.github.com/en/actions/reference/limits),
[distribución t de NIST](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3672.htm),
`../control-precision/VARIANCE-PILOT-DRAFT.md` y
`../control-precision/pilot-v2/capture/PROTOCOL.md`.
