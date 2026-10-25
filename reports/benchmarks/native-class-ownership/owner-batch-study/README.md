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
bloqueada por executionReady=false antes de crear un realm. Solo existe todavía
este componente; faltan launcher, transporte/lector integral, calificación completa
y revisión del método para habilitar una nueva secuencia.

Pasaron 22 contratos reales por Node 22.12.0 y 24.14.1. Cada SDK ejecutó 448 tareas
cronometradas para validar el sampler, dieciséis casos de bloque, una fila completa,
errores y controles retenidos de Window/Document por separado. Se guardaron 23
probes de recursos por SDK con tres rondas, incluidos estados retenidos y las dos
rondas finales claras. Esos tiempos tienen purpose funcional y no deciden presupuestos.

Las pruebas usaron el addon local f8c8af92, ya calificado, y un jsdom independiente.
La matriz remota del candidato también aprobó 6/6; su ELF seleccionado es 4b52a84d,
distinto del local. Todavía debe armarse y verificarse su paquete antes de calificar
el método completo. No se afirma reproducibilidad binaria ni que la prueba local
haya ejecutado el ELF remoto. No hubo estudio de rendimiento ni reevaluación del gate.

Evidencia: reports/validation/owner-batch-sampler/20261025/ y
reports/validation/static-range-owner-batch-ci/40205226009/.
La migración sigue activa, el runtime híbrido y el hito sin aceptación de rendimiento.
