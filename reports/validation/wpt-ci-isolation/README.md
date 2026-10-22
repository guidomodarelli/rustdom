# Timeout de la referencia WPT en Windows

El job Windows 119958466022 del run 39817139002, con Node 24.22.1,
falló en `Range-mutations-dataChange.html`: el estado global de jsdom fue
TIMEOUT (2), cuando la comparación exige OK (0). La prueba completa tardó
151168.5817 ms. El mismo fallo aparece en el run 39814770125. Los resultados
crudos de esas comparaciones no se preservaban: los temporales del worker se
eliminaban antes de que fallara la aserción. No se puede inferir de esos logs
que los 2808 casos individuales de Windows hubieran pasado.

`test:compat` limita el lote general a dos procesos y después ejecuta
explícitamente `tests/wpt/fixture-process.spec.cjs`, sin otras suites activas.
El traslado conserva los ocho tests originales, las rutas a recursos y el
addon real. No cambian fixtures upstream, resultados, presupuesto del arnés
(multiplicador 2; 120 segundos para long), deadline del proceso (180 segundos),
aserciones, aislamiento de cada motor ni comprobación de que los hijos terminan.
Esto elimina la competencia del lote general; no demuestra por sí solo una
causa única del fallo histórico ni garantiza tiempos idénticos entre máquinas.

El helper de diagnóstico conserva ambos resultados completos y observaciones
de proceso si falla la comparación, en un directorio exclusivo bajo
`reports/validation/wpt-fixture-process/`. Rethrow conserva la aserción original;
si falla la escritura, AggregateError conserva tanto la aserción como el error
de IO. Las tres pruebas nuevas usan resultados históricos reales y filesystem
real: preservación íntegra, no sobrescritura, éxito sin archivos y fallo de IO.
El workflow existente sube `reports/` incluso cuando falla el job.

`validation.py`, los archivos process.json y stdout/stderr registran comandos,
versiones, PIDs, códigos de salida y resultados locales. Node 22.12.0 usa ambos
motores reales; Node 24.22.1 ejecuta el comando npm completo. El addon proviene
del paquete Windows publicado por CI en 7d5ada1f, con SHA-256 del paquete y
binario comprobados. Los inputs de producción siguen iguales; package.json
solo cambia la ejecución de tests. `environment.json` identifica herramientas,
referencia jsdom 27.4.0, artefacto y procedencia del fallo.

Las pruebas conservan cierre de ventanas y comprobación de procesos reaped.
Los logs incluyen RSS, heap y memoria externa inmediatamente después de close,
sin confundirlos con memoria retenida después de GC o memoria pico. No se
cambia ownership, caches o referencias de producción; los diagnósticos se
serializan al filesystem sin un registro global en memoria. Las mediciones
finitas y el cierre de procesos no prueban ausencia absoluta de fugas.

Validación local terminada: Node22.12.0 pasa3 contratos de diagnósticos y8
tests WPT. Node24.22.1 pasa las3748 pruebas generales y8 WPT (3756 en total),
con cero fallos y cero omitidos. La referencia Range tarda40.00s en Node22 y
28.82s en Node24; ambos motores comparan2808 casos con estado global OK. Los
timeouts reales intencionales y el TIMEOUT histórico siguen siendo errores.
Estos tiempos funcionales no son benchmarks de aceptación. El CI remoto del
SHA nuevo debe verificarse por separado.
