# Prototipo del controlador secuencial

Estado: captura científica deshabilitada. Capturador, binding de procesos y replay
están implementados y calificados localmente como flujo funcional. Falta terminar
y probar la autenticación externa de los dos artifacts científicos, la decisión
íntegra y el recibo/revisión del método antes de habilitarlo. No aplicar la etiqueta.

## Operación y unidades

Se mantienen las ocho filas, los tamaños, las llamadas públicas y sus validaciones.
Cada realm ejecuta 16 tareas secuenciales con fixtures mutables frescas. Cada tarea
tiene timer propio; setup, validación, serialización y teardown quedan fuera.
Range comparte únicamente inputs inmutables. Hay tres warmups internos, tres
bloques warmup y nueve medidos por proceso. No se descarta la primera tarea.

La captura completa tiene 1024 workers Node por SDK, 2048 en total. Mantiene
AA/AB, jsdom/rustdom, etiquetas A/B, 16 posiciones, semillas1…16, tres probes RNG
y pares adyacentes. El hilo principal queda en CPU2 y se conservan las máscaras de
background. Git/taskset son helpers de setup; no son unidades estadísticas.
Los realms, owners y tiempos individuales siempre se cuentan separadamente.

Una media aritmética de las144 duraciones medidas representa un proceso; no hay
144 réplicas independientes. Se conservan además las12 medias de bloque. Las
64 comparaciones usan los16 pares y Fieller con t15=2.131449545559323, cobertura
puntual95%, límites jsdom±2%, RustAA±5% y extremo superior RustAB≤+5%. Se conservan
intervalos inválidos/no acotados y todas las regresiones; nunca conceden aceptación.

Totales completos:18432bloques medidos,294912duraciones medidas,6144bloques warmup,
98304duraciones warmup y24576Window más24576Document. Son dos jobs con hosts que
pueden diferir: no mezclar muestras entre SDK ni atribuir diferencias a Node sin
controlar hardware. El controlador funcional usa solamente AB/posición0:32workers
por SDK, sin inferencia ni aceptación; no es una opción para reducir la captura.

## Procesos, tiempo y recursos

Cada worker carga una sola distribución física verificada. Antes de los timers
valida el binding del padre, SDK y HEAD Git real; el padre comprueba el catálogo,
el paquete y la identidad Git antes/después. La captura científica exige checkout
Git nativo limpio y recibo revisado. La calificación funcional puede conservar WIP
real, sin normalizar sourceCommit/sourceChangesRaw/sourceGitErrors ni presentarlo
como un checkout publicado limpio.

El ejecutor usa un grupo de procesos propio, deadline y cancelación acotados,
con stdout/stderr y metadata reales. Termina residuos de hijos y los reporta como
fallo del contrato. No reintenta workers. El límite por worker es180s y cada SDK
tiene170min de colección dentro de un job200min. Setup10min, archivo10min,
upload5min y margen5min mantienen el presupuesto; el uptime real del job se exige
antes del primer worker. El archivo completo o parcial siempre se conserva.

Cada worker registra tres rondas de recursos y exige las dos últimas claras,
incluyendo Window/Document separados y baseline nativo completo. El replay exige
los167 campos nativos para no confundir familias ausentes con valores liberados.
Se preservan primeras rondas no claras, errores y warmup. Cada padre registra
tres snapshots tras GC, antes, a mitad en un límite de pares y al final. Son seis
snapshots parentales entre ambos jobs; no prueban memoria pico ni ausencia universal
de fugas. Los relojes son observaciones del host, no certificaciones temporales.

## Evidencia y lectura

El paquete completo es el ELF4b52a84d del artifact12604810857, CI6/6, con controles
originales y dependencias fijadas. El tar1e431338… contiene todos sus bytes. Las
fuentes y configuración ejecutables del método se copian como datos; no se importan
desde la captura. Archivos comprimidos históricos ya publicados se referencian por
path relativo, tamaño y SHA y se vuelven a comprobar, evitando duplicar142MB por
job. El paquete actual sí se conserva íntegro dentro de cada parte. La integridad
del archivo nuevo no se reemplaza por estas referencias históricas.

El replay separa identidad y hashes del lector actual de los bytes del productor.
Los perfiles funcionales originales quedan fijados por SHA del índice y digest del
grafo; reparar un lector no obliga a repetir DOM ni a alterar metadatos capturados.
La lectura científica debe usar el recibo independiente y ambos artifacts del
mismo run/intento/fuente. verifyPart y combine mantienen captureAuthenticated=false
y performanceAccepted=null: todavía no son la autenticación externa ni el gate.

La evidencia local está en reports/validation/owner-batch-integral/20261025/.
Sus dos partes completas se produjeron desde Git f781c3b7 con WIP real de método;
no son un estudio científico ni QA del futuro SHA limpio hospedado. El CI4/4 del
componente anterior corresponde exclusivamente a564f0f55. El workflow ampliado
deberá aprobar el SHA nuevo antes de cualquier habilitación. Se conservan todos
los rechazos históricos. No tag/merge de ownership sin aceptación e integración.
