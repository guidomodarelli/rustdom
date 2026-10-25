# Sampler de tareas secuenciales: componente funcional

batches.cjs implementa un bloque de 16 tareas públicas y una fila de doce bloques:
tres warmup y nueve medidos, con tres rondas internas de warmup por realm. Reutiliza
las fixtures compartidas, el HTML, los algoritmos públicos Range y el colector de
memoria existentes. No introduce algoritmos DOM nuevos en JavaScript.

Cada fixture mutable se prepara fuera del timer, ejecuta su operación una vez,
se valida y se dispone antes de crear la siguiente. Observer delivery conserva
prepare fuera de su intervalo y await dentro, sin un flush conjunto de 16 tareas.
Range comparte únicamente inputs que sus operaciones no mutan, sin multiplicar
la población base de rangos. Parser, setup, validaciones y teardown no se agregan
a las duraciones. Las salidas de todas las tareas se contrastaron contra los ocho
hashes del estudio original, para ambos engines y SDKs.

El bloque conserva tiempos individuales y progreso escalar, nunca nodos fuertes
ni MutationRecord en el reporte. Los errores de progreso mantienen el valor
original, incluso Symbol y undefined, y el realm se cierra en finally. Los fallos
de cleanup se registran sin reemplazar el error previo. La captura formal está
bloqueada por executionReady=false antes de crear un realm. worker.cjs ya integra
procesos nuevos y compare.cjs reduce las 144 tareas medidas a una media por proceso.
Faltan capturador, replay integral, calificación completa y revisión del método para
habilitar una nueva secuencia.

Pasaron 22 contratos reales por Node 22.12.0 y 24.14.1. Cada SDK ejecutó 448 tareas
cronometradas para validar el sampler, dieciséis casos de bloque, una fila completa,
errores y controles retenidos de Window/Document por separado. Se guardaron 23
probes de recursos por SDK con tres rondas, incluidos estados retenidos y las dos
rondas finales claras. Esos tiempos tienen purpose funcional y no deciden presupuestos.

La primera calificación usó f8c8af92 y un jsdom independiente. Se conserva intacta.
La prueba adicional con ELF4b52a84d también pasó 22/22 por SDK; sus datos están en
owner-batch-selected-runtime. El worker pasó 39/39 por SDK, incluidos 64 procesos
funcionales completos, ocho rechazos de startup y seis errores primitivos de progreso.
La revisión detectó que el serializador reemplazaba ciertos errores originales;
la vista escalar y las regresiones reales de undefined/null/Symbol cierran ese caso.
Su calificación usó roots
temporales autenticados; la integración hospedada con el tar sellado sigue pendiente.
El comparador pasó ocho contratos numéricos por SDK, sin otorgar aceptación.

El paquete remoto 6/6 ya fue ensamblado, archivado y reconstruido con verificación
en ambos Node. Se distinguen ELF local/hospedado y fuente canónica/compilador real.
No se afirma reproducibilidad binaria. No hubo captura científica ni reevaluación del gate.

Evidencia: reports/validation/owner-batch-sampler/20261025/ y
reports/validation/static-range-owner-batch-ci/40205226009/.
La migración sigue activa, el runtime híbrido y el hito sin aceptación de rendimiento.
