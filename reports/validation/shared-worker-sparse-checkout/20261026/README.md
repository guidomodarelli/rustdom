# Descarga acotada para la integración archivada

El job Node 24.14.1 `121531149900` del run `40310785437`, intento 1,
SHA `527439d6170dbd736436002b7b7fb5b7a987cef0`, consumió los diez minutos
del job en `git fetch`. No ejecutó setup de SDK, extracción ni tests.
La anotación de GitHub confirma `The job has exceeded the maximum execution
time of 10m0s`. API, anotaciones y log original están en `hosted-before/`.
La API clasifica el job como `cancelled`; el resumen de checks lo muestra rojo.

El workflow ahora hace checkout parcial no-cone y utiliza el hidratador ya
publicado `numeric-composed-packages/checkout.py`. Materializa sus 810 inputs
autenticados y conserva los datos originales del replay. Mantiene el límite
de diez minutos, los dos SDK y todos los tests. Publica también los logs de
hidratación. No altera ninguno de los 786 pins históricos; este workflow no
pertenece a ese grafo congelado.

## Validación ejecutada

`local-fixed-environment/summary.json` registra un clon remoto Git real con
`blob:none`, sparse checkout, HEAD publicado 527439d6 y estado limpio antes y
después. Clon + checkout + hidratación: aproximadamente 31 segundos en esta
máquina; no es una garantía sobre la red de GitHub. La extracción sobre el
filesystem Windows montado desde Linux tardó 119 segundos. Se conservan las
duraciones individuales de todas las órdenes, sin convertirlas en benchmarks
del DOM.

En Node **22.12.0 y 24.14.1**, con hashes de ejecutables comprobados, pasaron
los **15 contratos** y el replay de los **80 procesos históricos** por SDK.
Se verifican 960 Window y 960 Document separados, 720 duraciones medidas y
240 warmup del dataset original; no son procesos ni muestras nuevos.
Actionlint 1.7.12 Linux pasó. La revisión aislada del workflow no encontró
hallazgos accionables; su alcance fue estático. La confirmación hosted de la
modificación requiere el nuevo SHA publicado.

La primera preparación local (`local/`) falló antes del replay porque el
arnés pasaba `core.autocrlf=false` solo a Git, sin heredarlo al hidratador.
Se corrigió el entorno del arnés para usar los mismos `GIT_CONFIG_*` del
workflow, que ya contenía esa configuración. Se conserva el error original.
Los scripts probados se guardan como texto de referencia, no como código
archivado que se deba ejecutar.

El raw extraído se trasladó después de las pruebas a
`.cache/shared-worker-sparse-replayed-raw-20261026/`; las rutas de las órdenes
conservan su ubicación real al ejecutarse. El archivo original completo y
su recibo permanecen versionados en
`reports/validation/native-class-ownership/shared-fixture-worker/`.
No se duplica ese dataset en este informe.

## Límite del cierre

El CI general del SHA 527439d6 terminó **8/8 aprobado**, run 40310785667.
Los dos jobs ownership del run 40310785593 siguen rechazando correctamente
el presupuesto histórico con exit 1: sus tests de integridad pasan y el log
lo distingue de una captura corrupta o desactualizada. Se conservan ambos
logs completos. Esta corrección de descarga no acepta rendimiento:
`performanceAccepted=null`, `gateReevaluated=false`.

No se ejecutó DOM nuevo ni se modificó ownership, memoria o teardown del
runtime. Los recursos del dataset son observaciones finitas ya conservadas;
no prueban memoria pico ni ausencia universal de fugas. Runtime híbrido y
migración general pendientes. Sin tag ni merge mientras falte aceptación.
Las 48 entradas ajenas de `native-collection-queries/rustdom` siguen intactas.
