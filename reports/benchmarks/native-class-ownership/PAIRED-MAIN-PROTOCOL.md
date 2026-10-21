# Comparación pública pareada con afinidad del principal

Estado: sampler en validación. No hay un estudio ejecutado con este método ni
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

## Condiciones pendientes antes de medir

Completar el driver y verificador del estudio, congelar todas las fuentes del
harness y sus dependencias transitivas, declarar el orden entre workers y motores,
validar contratos, liberación y rechazo de paquetes modificados en ambos Nodes,
y terminar review del método. Registrar límites y política de parada antes de
iniciar una única secuencia. El sampler aislado no reemplaza el gate de CI.
