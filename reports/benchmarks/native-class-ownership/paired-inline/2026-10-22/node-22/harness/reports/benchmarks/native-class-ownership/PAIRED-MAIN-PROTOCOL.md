# Comparación pública pareada con afinidad del principal

Estado: sampler validado; driver y verificador en validación. No hay un estudio ejecutado con este método ni
aceptación de presupuesto. Las ejecuciones de tests no forman parte del estudio.
No modificar los protocolos, pins o resultados históricos para adoptar este método.

## Pregunta y decisión

El estudio main-affinity v2 completo no calibró todas las filas. La hipótesis
operativa es que compartir isolate y contexto temporal entre A y B puede reducir
la variación entre procesos, manteniendo afinidad solo del hilo principal. Esto
no prueba que esa variación sea la causa de las diferencias anteriores.

La nueva comparación debe conservar las ocho filas, Node 22.12.0 y 24.14.1,
A/A y A/B, jsdom 27.4.0 independiente y los presupuestos originales. Si A/A o el
control jsdom no calibran, el resultado es inconcluso y no acepta el cambio.
Si una fila A/B calibrada excede el presupuesto, requiere investigar/corregir el
runtime. No repetir el mismo estudio para seleccionar una corrida favorable.

## Unidades y secuencia

Cada worker carga dos paquetes físicamente independientes en un mismo proceso.
Cada etiqueta ejecuta una vez cada fila mediante createBenchmarkRunner y
measureWorkload: tres warmups y nueve muestras por lote, con fixtures, operaciones,
timers, assertions y cleanup originales. Se alternan lotes completos, no muestras
individuales. Compartir el harness y añadir observadores puede afectar V8; los
tiempos históricos no son mediciones de este harness.

Ocho posiciones combinan independientemente orden de carga, asignación física y
orden de lotes. Para cada fila hay cuatro posiciones A-primero y cuatro B-primero;
las filas conservan el orden declarado en constants/paired-main.cjs. En A/A se
intercambian A0/A1 y J0/J1. En Rust A/B se alterna la copia de referencia A0/A1;
B siempre es el candidato y nunca cambia su significado. Ese tercer factor no
es simétrico entre fases y debe figurar como límite del diseño.

El estudio completo previsto contiene 64 procesos: dos Nodes × dos fases × dos
motores × ocho posiciones; 9.216 duraciones medidas, 72 por etiqueta/fila/motor/fase/Node.
La unidad independiente es el proceso; nueve duraciones del mismo lote no son
nueve réplicas independientes. El estimador primario conserva la razón entre
medianas agrupadas de B y A por fila; no se selecciona posteriormente otro
estimador para aprobar. Los umbrales permanecen ±2% jsdom, ±5% Rust A/A y +5%
Rust A/B; requieren todas las filas y ambas versiones.

## Identidad, aislamiento y recursos

El sampler verifica dist y package.json completos contra las huellas A/B fijadas
independientemente en el estudio paired original. Verifica lib y package.json de
las dos copias jsdom contra su huella histórica. Conserva manifests antes/después,
prueba clases independientes y asignación nativa propia en ambas direcciones.
La distribución ejecutada es distinta de las fuentes nuevas del harness; no
atribuir su hash al código del runtime congelado.

Se inicializa libuv antes de fijar únicamente el hilo principal a CPU 2. Se
conservan máscaras de todos los hilos antes/después; debe existir un hilo de fondo
con máscara más amplia. No se usa el addon diagnóstico de reloj ni se sustituyen
tiempos públicos por CPU.

Después de cada lote, fuera del cronómetro, se realizan exactamente tres rondas
de GC. En las últimas dos deben desaparecer todos los Window y Document
observados hasta ese punto y ambos runtimes deben volver a sus contadores nativos
iniciales, usando el mismo predicado de recursos de memory-endpoint.cjs. Las
referencias observadoras son débiles; los reportes serializan solo datos escalares.
La memoria observada es posterior a limpieza, no pico ni prueba de ausencia
absoluta de fugas. Un fallo conserva evidencia parcial y no acepta presupuesto.

## Driver, archivo y política de parada

paired-main-experiment.cjs ejecuta primero A/A y luego A/B. Dentro de cada fase,
las posiciones van de 0 a 7; posiciones pares ejecutan jsdom/Rust, impares
Rust/jsdom. Ningún worker se ejecuta en paralelo. El launcher completa Node 22
y después Node 24, con los mismos paquetes, harness y recibo de review.

El driver requiere manifest de copias, directorio nuevo y un JSON de procedencia
con harnessSha256, reviewedCommit y receiptUrl. El launcher debe verificar en
GitHub que el recibo corresponde al SHA publicado y que ese SHA reproduce la
huella del harness. El driver comprueba esa huella antes de cargar paquetes o
ejecutar workers, y conserva la procedencia. No verifica una review por red ni
considera que un campo declarado sea por sí solo prueba de aprobación remota.

Se congelan los bytes completos del alcance canónico de benchmarks/sources.cjs
y de todos los módulos transitivos del método en reports/, incluyendo este
protocolo y tests. Se guardan manifests antes/después y snapshots bajo harness/.
Los paquetes físicos y fuentes originales A/B deben corresponder a sus pins
históricos; se comprueban antes y después. No se reconstruyen para reutilizar
una identidad anterior. stdout, stderr y reporte de cada worker se guardan con
hashes y resultados de proceso, incluso si falla.

Los comandos --verify y --verify-set recalculan datos sin ejecutar cargas. El
verificador comprueba schedule, principal y background, aislamiento real,
identidad de paquetes y snapshots, rounds de GC y recursos nativos mediante el
predicado real, resultados públicos, duraciones, conteos y agregados. verify-set
requiere ambas versiones en orden, con mismo harness, paquetes y procedencia.
Su exit 0 significa integridad verificada: hay que leer accepted para aceptación.

La ejecución normal termina con código 0 si acepta, 1 si completó el Node sin
aceptar, y 2 si falla ejecución, preflight o verificación. Un resultado 1 de Node
22 conserva los datos y permite completar Node 24. Un resultado 2 detiene la
secuencia para corregir la causa; no habilita una repetición para elegir tiempos.
Cada worker tiene deadline de diez minutos y no hay reintentos automáticos.

Se ejecutará una única secuencia completa de este método después de tests y
review. Si no calibra, se conserva como inconclusa y no se lanza otra corrida
idéntica. Antes de otra intervención debe identificarse un problema concreto del
método o runtime y una decisión que la nueva evidencia pueda resolver. No se
cambian estimador, presupuestos, filas o posiciones después de mirar resultados.
Un A/B calibrado fuera del presupuesto requiere corregir la implementación.

Pendiente antes de medir: terminar tests y reviews del driver/verificador,
publicar el SHA, comprobar el recibo remoto y fijar procedencia. El método no
reemplaza por sí solo el gate de CI ni autoriza merge del PR 80.
