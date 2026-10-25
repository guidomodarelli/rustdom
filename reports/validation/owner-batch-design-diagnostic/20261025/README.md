# Diagnóstico de diseño sin nuevas muestras

La lectura autenticada del run 40184510898 conserva su rechazo. dispersion.json
incluye los 2048 procesos, todos los 18432 tiempos medidos y 6144 warmup, los 128
grupos y los contrastes firmados, sin filtros ni remuestreo. Los 63 contrastes
negativos quedan visibles. No son componentes de varianza causales ni no negativas.
El diagnóstico mantiene performanceAccepted=null y gateReevaluated=false.

qa.json conserva ocho comandos reales y sus hashes: nueve contratos Python por
Windows/Linux, dos análisis completos byte-idénticos, verificaciones independientes
de los 2048 procesos en Node 22.12.0 y 24.14.1, y nueve contratos de rechazo por
cada SDK. Los logs íntegros están en qa/. El lector Node comprueba cada duración
y warmup contra el CSV fijado, además de su aritmética y las medias históricas.

planning-qa.json conserva tres contratos y el CLI por Windows/Linux, con resultados
byte-idénticos. planning-observations.json identifica por hash el index original
y calcula los endpoints de cada SDK. Las proyecciones solo escalan tiempos
cronometrados; omiten costos adicionales y no prometen duración ni aceptación.
La primera observación manual de planificación se conserva como .initial.json.

El primer intento local del verificador Node rechazó el header CSV, que viene
entrecomillado. Se corrigió la lectura al formato escalar fijado; las pruebas
finales cubren todos los datos y corrupciones. Ese primer stderr no se capturó
como archivo; no se lo presenta como un log íntegro conservado. Ninguno de esos
intentos ejecutó DOM ni nuevas muestras de rendimiento.

El borrador de lotes fijos y dos jobs por SDK aún no tiene sampler, calificación,
paquete seleccionado ni revisión integral del método. executionReady=false.
La autorización permanente ya está concedida. No repetir el estudio anterior
ni presentar este diagnóstico o sus tests como una aceptación del candidato.
