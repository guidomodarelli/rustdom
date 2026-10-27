# Diagnóstico del sampler, sin aceptación de rendimiento

Estado: preparación de una captura observacional. No ejecutar la captura de diez
procesos hasta publicar y revisar este método y pasar sus contratos en Node 22/24.
No repetir ninguno de los ensayos de aceptación anteriores.

## Evidencia que motiva la captura

El run 39735778846 permanece completo con `verified=true, accepted=false`.
Sus 2.048 series por proceso y carga, incluidas las que calibraron, están en
`../independent-order/39735778846/process-sample-diagnostics.json`.

En jsdom Node 22, `range-control-1000/1000` muestra una mediana de cambio entre
las últimas tres y las primeras tres muestras de −22,64%/−28,33% para A/B
en A/A; 14 de 16 procesos por etiqueta bajan. En A/B, que sí calibra, el mismo
diagnóstico es −31,27%/−33,27%, con 15/16 y 12/16 procesos que bajan. La señal
no discrimina por sí sola entre aceptación y rechazo. Las seis filas sin
calibración tampoco tienen todas la misma dirección de cambio durante el lote.

Las fuentes congeladas muestran tres warmups y nueve muestras, cada una en
un Window nuevo. Construcción, preparación, GC explícito y teardown quedan
fuera del temporizador de las ocho cargas de ownership. El control de rangos
clona, colapsa y compara 1.000 rangos; lifecycle crea Range/StaticRange y consume
sus límites. Delivery mide la espera por callbacks de observadores previamente
preparados. Los valores públicos y el árbol se validan después del timer.

No se conservaron intervalos absolutos ni duraciones de warmup en el ensayo
anterior. Por eso sus duraciones solas no permiten atribuir cambios a GC,
compilación, scheduling o frecuencia de CPU. No inferir una causa de esta tabla.

## Preguntas y método fijados antes de la captura

1. ¿Qué eventos GC observados se solapan con los intervalos de operación y
   cuáles ocurren durante setup/cleanup?
2. ¿Los perfiles CPU muestran funciones de las operaciones durante esos
   intervalos? La resolución de muestreo puede dejar sin ticks operaciones cortas.
3. ¿Cómo evolucionan las doce duraciones, incluidos los tres warmups, para
   cada carga y paquete? Es una descripción de procesos instrumentados.

Derivar una copia de las 387 fuentes autenticadas del arnés `6904db29…`, commit
`f5526bc1`, del archivo ya extraído. `prepare.py` verifica cada archivo y genera
un diff: solamente añade spans escalares después de los tres sitios existentes
que detienen el reloj y los devuelve en el reporte. No cambia operación, fixture,
warmup, número de muestras, timer, aserciones, carga de paquetes o limpieza.
Conservar fuentes derivadas, hashes y patch. La copia congelada no se modifica.

El wrapper observa eventos GC mediante PerformanceObserver y conserva solamente
inicio, duración, kind y flags. Registra anclas de performance.now y hrtime
antes y después para alinear un CPU profile nativo, con incertidumbre de reloj
explícita. Desconecta el observer incluso si falla; conserva el error y lo parcial.
Las anotaciones posteriores al timer y el profiler tienen overhead: estos
tiempos no se comparan con presupuestos ni sustituyen resultados previos.

Preparación oficial 39720077911, artefacto 12400802735, UUID
99fb5dd8-2ee8-402c-97b4-d8174069f933; verificar identidad completa antes y después.
Sin recompilar ni seleccionar builds. Un paquete físico por proceso, CPU2 solo
en el hilo principal y máscaras de fondo conservadas. Mismas ocho cargas,
tres warmups, nueve muestras y tres rondas de cleanup con las dos últimas claras.

Captura única local: Node 22.12.0 y después 24.14.1. En Node 22 ejecutar J0,
A0, J1, A1 y B; en Node 24 invertir esa lista. Diez procesos, 80 lotes y 960
intervalos, de los cuales 240 warmups y 720 muestras. Sin reintentar procesos
fallidos. Flags: `--expose-gc --cpu-prof --cpu-prof-interval=100`, con archivo y
directorio de perfil explícitos por proceso. Conservar stdout, stderr y exit
code. Es diagnóstico, no un diseño balanceado de comparación A/B.

Los contratos previos usan J0 y A0 en ambos Node, sin profiler CPU, y se guardan
separados. Deben ejecutar las ocho cargas reales, verificar las doce spans,
igualdad exacta de las nueve duraciones devueltas con sus spans, outputs iguales
a los del archivo original, eventos GC válidos y liberación final Window/Document
y baselines nativos. No son muestras de la captura ni evidencia de rendimiento.

## Interpretación y salida

Guardar todos los intervalos, eventos, perfiles, versiones, hardware, fuentes y
hashes. Informar todas las cargas y paquetes, incluso fallos, sin selección de
ventanas ni eliminación de muestras. Separar solapamiento temporal de causalidad;
si no se observa GC dentro de una operación, no atribuir ese intervalo a GC.
Un perfil muestreado no prueba ausencia de compilación ni de otras causas.

La captura no calcula `accepted=true`, ni cambia estimador, presupuesto, alcance
o crédito Rust. Los límites de aceptación siguen ±2% jsdom, ±5% Rust A/A y
+5% Rust A/B para todas las filas y ambos Node. Ownership sigue abierto. Una
hipótesis respaldada y un protocolo prospectivo revisado serían necesarios
antes de otro contraste de aceptación; obtener trazas no lo autoriza por sí solo.

El observer conserva números, sin nodos ni callbacks DOM. Se observan Document
y Window por separado y los baselines nativos; los recursos del profiler duran
hasta la salida del proceso. No se mide memoria pico ni se certifica ausencia
universal de fugas. No hay tag de checkpoint ni merge por publicar este método.
