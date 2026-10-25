# Prototipo del controlador secuencial

Estado: propuesta de habilitación con tres flags coherentes. Solo permite una
captura desde un SHA limpio con recibo de revisión integral y los cuatro checks
del mismo SHA aprobados. El CI funcional df5dfff8 aprobó 4/4; la habilitación nueva
requiere su propio CI antes de aplicar la etiqueta. No hubo captura científica
de este método ni aceptación de rendimiento.

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
con stdout/stderr y metadata reales. Detecta y termina residuos de hijos, y espera
observar todos los miembros del grupo ausentes o terminales (Z/X) antes de devolver
éxito. SIGKILL no garantiza terminación síncrona: esta espera tiene límite de cinco
segundos y registra los estados observados; un grupo activo al vencerlo rechaza
el contrato. No reintenta workers. El límite por worker es180s y cada SDK
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
deberá aprobar el SHA nuevo antes de cualquier activación. Los CI e7895fb0 y
df5dfff8 aprobaron 4/4 y sus ZIP/API/tar/logs íntegros están publicados en
reports/validation/owner-batch-integral-ci/. La lectura actual de ambos SDK conserva
la separación entre productor y lector y nunca ejecuta scripts archivados.
Se conservan todos
los rechazos históricos. No tag/merge de ownership sin aceptación e integración.

## Activación única y calificación de fuente

qualification.cjs lee el CI del mismo SHA, intento1, workflow exacto y sus cuatro
jobs sin duplicados. El capturador conserva las respuestas y liga sus hashes al
índice; el replay las valida nuevamente. El CI prueba el acceso real a la API
con un run histórico exitoso fijado, sin otorgarle aceptación científica.

once.cjs pagina el historial de TODO el repositorio desde 2026-10-25T18:00Z
(antes de existir este workflow), entre todas las ramas e IDs de workflow. Exige
cobertura íntegra inferior a1000runs y examina los jobs del intento1 de cualquier
otro run del método. Solo un primer intento concluyentemente omitido no consume
la secuencia. Un retry posterior omitido no oculta una captura original fallida.
La concurrencia global serializa el workflow sin cancelar el run activo. Un run
posterior completamente en cola no bloquea al anterior que mantiene el grupo;
un run anterior consumido o posterior ya terminado sí impide otra captura.

La creación de la única ejecución debe ocurrir antes de2026-10-26T00:00Z; ese
límite no interrumpe una captura ya admitida ni cambia sus170/200min. No extender
esta ventana para repetir una secuencia consumida. La prueba de consumo se copia,
hashea y reproduce offline; la decisión contrasta también runId/runNumber con
metadata API externa. Ninguna autorización operativa adicional es necesaria.
