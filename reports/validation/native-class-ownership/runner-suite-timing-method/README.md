# Método de tiempo completo de suites

Calificación funcional del método en
`reports/benchmarks/native-class-ownership/runner-suite-timing/`.
No se ejecutó el ensayo formal ni se cambió la aceptación de ownership.

El ejercicio final ejecutó 18 CLIs reales con los paquetes A0/A1/B, Jest,
Vitest y Vitest VM en Node 22.12.0 y 24.14.1: 558 tests pasaron. También
pasaron 13 tests del método y cinco contratos de replay por versión Linux.
Los verificadores congelados pasaron en ambos Node Linux y Node 24.14.1
nativo Windows sobre la ruta UNC de WSL. Esta lectura no ejecuta suites.

La revisión aceptó y corrigió cuatro P2: campos de reloj omitidos, inventario
de fuentes vacío, recibo formal nulo que elegía calificación y uso de rutas
Windows al reconstruir metadata Linux. Se conservan las fuentes anteriores,
los tres ejercicios y el fallo reproducido de Windows antes del último fix.
Los argv del método final coinciden con el CLI calificado original en Linux;
las rutas históricas usan semántica POSIX y las lecturas usan la del host.

`qualification-and-history.tar.gz` conserva los 3.340 archivos crudos,
snapshots, logs, estados y contratos, con manifest en `raw-files.json` y
checksum en `receipt.json`. Las dependencias y addons oficiales siguen en
el archivo de `runner-suites-qualification/` indicado por ese recibo.
`readback.py` verifica todos los bytes, las 79 fuentes y los reportes finales
sin ejecutar runners. `exercise-index.json` es copia del índice final.

La receta formal fija 342 CLIs: 54 warmups y 288 mediciones, doce tiempos
por celda. Su decisión de doce filas no sustituye los microbenchmarks
rechazados. Publicar y autenticar las fuentes en Git/GitHub antes de la
única invocación formal; conservar también cualquier resultado negativo.
Ver `PROTOCOL.md` para orden, estimador, recursos, presupuestos y límites.
