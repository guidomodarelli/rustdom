# Diagnóstico de GC, JIT y CPU

Declarado antes de ejecutar. Se conserva el binario inmutable anterior, CPU 2,
Node 22.12.0/24.14.1 y las entradas públicas de tamaño uno. Se observan la tarea
inestable `xml-serializer-getter-error/1` y el control `xml-serialize/1`.

Por Node y tarea se ejecutan cuatro procesos con observación GC/CPU y un quinto
con trazas V8 de GC, optimización y deopt, sin cambiar la política de optimización
del JIT. Se mantienen 16 batches de warmup, 32 medidos y 64 llamadas por batch; no se
agregan yields ni GC explícito entre llamadas. El observador recoge los eventos
al terminar el trabajo sincrónico. Se guardan intervalos de tiempo, CPU del
proceso, eventos GC, sus solapamientos y trazas sin filtrar.

Son veinte procesos diagnósticos, sin A/B ni aceptación. La instrumentación y
las trazas pueden perturbar los tiempos; no reemplazan una calibración. CPU
incluye threads auxiliares y tiene un intervalo ligeramente mayor que el reloj
del batch. Los eventos GC no representan todo el trabajo concurrente del GC.
No se deduce ausencia de fugas ni se excluyen muestras por contener GC.

La salida completa, contador de operaciones, raíces y referencias temporales se
verifican con el fixture real compartido. Se conserva el hash de resultado,
binario y probe. El resultado elegirá el siguiente experimento; no habilitará
por sí solo el gate de +5% ni cambiará los umbrales existentes.

El observador y su sobrecosto se documentan en las
[APIs de performance de Node 22](https://nodejs.org/download/release/v22.12.0/docs/api/perf_hooks.html#class-performanceobserver).
Para interpretar los marcadores se verificó la inicialización POSIX de
[Node 22.12.0](https://github.com/nodejs/node/blob/v22.12.0/src/node.cc#L542)
y [Node 24.14.1](https://github.com/nodejs/node/blob/v24.14.1/src/node.cc#L502):
desactiva el buffering de stdio nativo para evitar interferencias con logs V8.

## Resultado y siguiente diagnóstico predeclarado

Los veinte procesos completaron el comportamiento esperado y 3.072 operaciones
nativas por proceso; referencias temporales y scopes XML terminaron en cero.
Los procesos trazados muestran 34/48 líneas de compilación/deopt en el intervalo
medido de Node 22 y 18/14 en Node 24 (control/error). Los valores son eventos de
traza, no una cantidad de funciones únicas. La observación puede alterar tiempos.

En los procesos sin trazas se solapan uno o dos batches medidos con GC. Su
duración acumulada es aproximadamente 3,3–7,3 ms sobre 196–257 ms medidos por
proceso. La mediana CPU/wall ronda 1; hay algunos batches con descheduling
observable. Estos datos no identifican una causa única de toda la variación.

Siguiente experimento: repetir los mismos veinte diagnósticos con **256 batches
de warmup (16.384 llamadas)**, conservando 32 medidos de 64 llamadas. La hipótesis
es que las transiciones del JIT observadas después de 1.024 llamadas terminarán
antes de medir. No se cambian el motor, flags de optimización, casos ni budgets.
Este piloto también es diagnóstico: primero debe comprobar las trazas y no
habilita A/B. Una futura calibración completa conservará las trece filas y los
gates originales, con metodología y fuentes separadas de los pilotos anteriores.

El segundo diagnóstico completó otros veinte procesos, con 18.432 llamadas
nativas cada uno. En los cuatro procesos trazados no aparecen eventos de
compilación del runtime en el intervalo de medición. Node 22 registra cero;
Node 24 registra cuatro líneas por tarea, correspondientes al propio probe y
`cpuUsage`. Los eventos GC siguen incluidos. La variación residual entre
procesos y mitades impide tratar este dato como una calibración aprobada.
El siguiente protocolo está declarado en [warmup-protocol.md](warmup-protocol.md).
