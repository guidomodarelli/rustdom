# Corrección de WPT confirmada en el CI de Windows

El job120229286098 del run39896887685 terminó con success sobre
8fc28d6706a30c1e1179b5799b909c99f71a15c1. Pasaron la validación completa,
las pruebas de memoria y las pruebas del paquete instalado en Windows.
El fallo de WPT del run39894045206 permanece conservado como fallo histórico.

El fixture largo volvió a ejecutar ambos motores reales, con2808casos por
motor y multiplicador3. La comparación de vectores completos y estado global
pasó. range-execution.json conserva sus diagnósticos escalares, PIDs, versión,
duraciones y memoria tras close; no contiene los vectores individuales.
El log completo registra la ejecución de las assertions de paridad.

job.json y run.json son respuestas originales de GitHub. job.log.gz conserva
los637209bytes originales del log sin pérdida; receipt.json fija sus hashes.
collect.py conserva el recolector usado, sin volver a ejecutar pruebas.
Al recolectar el job de Windows, el workflow general aún esperaba Linux/Valgrind.
Después terminó con sus ocho jobs aprobados: `completed-run.json` y
`completed-jobs.json` conservan ese estado final. `linux-job.log.gz` y
`general-ci-summary.json` registran también el chequeo de memoria nativa.
Esto no declara verdes los gates de rendimiento ni todo el PR.

Las pruebas de memoria son finitas. Los valores tras close no son memoria
pico ni certifican ausencia universal de fugas. El ajuste solo cambia la
política compartida de timeout del runner upstream, sin cambiar el corpus,
las assertions o los presupuestos de benchmarks.
