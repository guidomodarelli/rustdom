# Borrador prospectivo: tareas equivalentes en bloques fijos

Estado: no implementado, no calificado y no ejecutable. Este archivo no activa
workflows ni cambia protocolos consumidos. Revisión prevista:
ownership-owner-batch-serial-draft-v1. La autorización permanente está concedida.

## Hipótesis y alcance

El candidato cb784c2f reduce la identificación de owners a un callback, conservando
las decisiones DOM en Rust. El array temporal tiene costo propio. La variación
intraproceso observada en el estudio anterior motiva medir repeticiones frescas
en un mismo realm con un número fijado de antemano. No demuestra que esa variación
provenga de JIT ni que el lote la eliminará. El estudio anterior no se repite.

El estimando propuesto es la latencia media de las mismas tareas públicas en
bloques de 16 fixtures frescas de un realm, incluida la primera tarea. No es tiempo
de startup, parsing, suite completa ni memoria pico. La integración del futuro
gate debe conservar ese alcance y los resultados históricos; no podrá afirmar
rendimiento universal o arranque sin regresión a partir de esta medida.

## Unidades y límites de cada operación

Conservar exactamente las ocho filas, tamaños, iteraciones y validaciones públicas
de las cuatro familias. Ejecutar 16 tareas secuenciales: preparar la fixture i
fuera del timer, cronometrar una sola operación original, validar y disponer esa
fixture antes de preparar la siguiente. Conservar duración y resultado individuales.
No mantener 16 poblaciones mutables de nodos, rangos u observers simultáneas: eso
cambiaría el contexto de las filas originales. Compartir solo inputs inmutables
que la operación no modifique, manteniendo la población base de cada tarea.
No agregar parsing, setup, validación o teardown al tiempo para diluir una
diferencia. No reutilizar una fixture mutada como si fuera fresca.

En MutationRecord se cronometra produce/takeRecords y se valida cada campo fuera
del timer. En observer-delivery se llama prepare de la fixture i antes de su propio
timer, se espera su entrega dentro del intervalo y se cierra el timer antes de
validar. No encolar las 16 mutaciones de antemano: compartir un único flush de
microtasks cambiaría la operación. Range/control y lifecycle conservan el orden
de sus métodos, la búsqueda pública de constructores y los checksums originales.
Las 16 salidas deben verificarse individualmente, además de coincidir entre labels.

Cada bloque usa un realm nuevo. Mantener tres rondas de warmup interno sobre
estados temporales separados, tres bloques de warmup y nueve medidos por proceso.
No descartar la primera tarea de un bloque ni filtrar muestras, ni calibrar el
número de repeticiones con los resultados de la captura futura.

Hay 2048 procesos en total, 1024 por SDK. Cada proceso produce 9 × 16 duraciones
medidas y 3 × 16 warmup, en 12 realms. Denominadores distintos: 18432 bloques
medidos, 294912 duraciones medidas individuales, 6144 bloques warmup y 98304
warmup individuales. Los 24576 Window y 24576 Document siguen separados. El
warmup interno no cronometrado se registra aparte; no se suma como muestra medida.

## Matriz, estimador y criterios

Mantener AA/AB, jsdom/rustdom, labels A/B, 16 posiciones y semillas 1…16, pares
adyacentes, tres probes RNG y afinidad principal 2. Cada proceso aporta una única
media de sus 144 duraciones medidas. Los 144 intervalos no son 144 procesos
independientes. Conservar todos los intervalos individuales y las medias de bloque.

Usar los 16 pares de procesos y Fieller emparejado, con t15=2.131449545559323 y
cobertura puntual nominal del 95%; no afirmar cobertura simultánea ni independencia
por crear procesos separados. Exigir los 64 criterios, ambas versiones y todas
las filas: intervalo completo jsdom dentro de ±2%, Rust AA dentro de ±5%, y extremo
superior Rust AB ≤ +5%. Un intervalo inválido/no acotado/no estimable rechaza.
No cambiar presupuestos, seleccionar filas ni sustituir el rechazo histórico.

## Paquete y transporte pendientes

Seleccionar prospectivamente el artifact de Ubuntu-22.04/Node 22.12.0 del run
40205226009, fuente db348de1 y job 121204608098, solo si la matriz termina 6/6.
Los IDs, tamaños, digests, ELF, fuentes, dependencias y locks deberán fijarse antes
de toda captura. No usar el ELF local f8c8af92 como sustituto. Ambos SDK deben
consumir ese mismo binario seleccionado. Conservar los controles A0/A1/J0/J1 con
sus identidades originales; nunca reconstruirlos para mejorar la calibración.

Propuesta: dos jobs del mismo run, uno por SDK, cada uno con sus 1024 procesos,
170 minutos de captura, 200 de job y 180 segundos por worker. Los 30 minutos
restantes permiten setup acotado, archivo, upload y margen; deberán distribuirse
y probarse antes de activar. No reiniciar un job ni completar muestras faltantes.
Autenticar ambos artifacts por run, intento, fuente, job, nombre, tamaño y digest.
La aceptación íntegra exige los dos; conservar los parciales ante cualquier fallo.

Cada comparación A/B queda dentro del mismo host y SDK. Guardar hardware, relojes,
comandos, afinidades, V8 y snapshots de cada padre. Los SDK pueden tener hosts
distintos: no mezclar sus muestras ni atribuir diferencias entre SDK a Node sin
controlar esa diferencia. No seleccionar uno de los jobs por ser favorable.

## Justificación operacional y recursos

Los endpoints del archivo anterior observan 5186,423 s en Node 22 y 4803,465 s en
Node 24. La suma de tiempos cronometrados respectivos es 124,788 s y 136,765 s.
Escalar solo esa parte por 16 produce proyecciones parciales de 7058,240 s y
6854,946 s. No incluyen el setup/validación/GC adicionales ni garantizan tiempo:
son planificación descriptiva con reloj del host no certificado. planning.py
reproduce esos números desde inputs autenticados. El margen debe preservarse
para archivar una ejecución parcial; no se extiende una captura ya iniciada.

Disponer cada fixture en su finally antes de preparar la siguiente, incluidos
errores y entregas asíncronas. Soltar referencias no garantiza recolección inmediata;
el método implementado todavía debe fijar y probar GC, teardown y las rutas de
error antes de activar. Conservar baselines y familias nativas, tres rondas de
cleanup, dos estados finales
claros, tres snapshots del padre por job, todas las primeras rondas no claras y
los estados separados de Window y Document. No deducir ausencia universal de
fugas ni memoria pico de esos endpoints. Probar errores, reentrada, referencias
retenidas, identidades y liberación antes de la futura captura única.

Faltan código, contratos reales, calificación, autenticación de paquetes, recibo
de método y revisión aislada integral. No activar este borrador. No hay tag ni
merge de ownership antes de aceptación e integración verificadas. El runtime
sigue híbrido y la migración general permanece activa.
