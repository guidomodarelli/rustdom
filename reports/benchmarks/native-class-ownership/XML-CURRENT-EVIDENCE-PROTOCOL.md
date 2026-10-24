# Una ejecución XML con inputs observados completos

El bloqueo XML actual no permite reutilizar los tiempos históricos: sus fuentes
y sus inputs observados no acreditan el runtime actual. Este protocolo soluciona
esa carencia de procedencia. No plantea otra variante de rendimiento ni supone
que el resultado vaya a aprobar. Los dos estudios previos del candidato actual,
incluido el rechazo de calibración, conservan sus decisiones y sus límites.

Se fija Node24.14.1, Ubuntu22.04, Rust1.99.1, glibc2.35, CPU0, referencia
checkpoint066/source993a1e y candidato source0b485. Se reutiliza sin modificar
xml-controller-experiment.cjs, sus trece filas, orden balanceado de dieciséis
procesos, warmup256 para tamaños1/16,32batches medidos y estimador de medianas
agrupadas. El presupuesto A/A sigue en ±2% y el A/B en +5%. Si falla A/A, AB
no se ejecuta y la aceptación sigue null. No se eliminan filas o muestras.

El productor calificado conserva fuentes, inputs de raíz presentes/ausentes,
distribuciones, dependencias, symlinks y logs. El wrapper nuevo compara esos
bytes con los dos árboles realmente usados antes y después, incluyendo todo
dist y node_modules. Registra compilador, ejecutable Node, V8, glibc y máquina.
La preparación y el probe de recursos terminan antes del reloj; no se agrega
instrumentación a los workers medidos. Los crudos y fallos sobreviven en el
artefacto completo, sin aceptar un estudio por su integridad o su exit0.

El wrapper no mata al coordinador con un timeout adicional: espera su salida.
El coordinador conserva el timeout existente de diez minutos por worker y
espera ese proceso antes de continuar. El límite del job remoto sigue en120min;
si GitHub cancela el job, no se declara completada la inspección posterior.

Antes de lanzar: contratos reales de selección/CLI y cambios adversariales en
Node22.12.0 y24.14.1, actionlint y revisión independiente sin hallazgos; publicar
y autenticar los archivos y el recibo. Los contratos no ejecutan benchmarks.

La etiqueta xml-full-inputs-v1 autoriza una sola secuencia. El workflow rechaza
reintentos y exige que no exista otra ejecución no omitida del mismo protocolo.
No relanzar por silencio, calibración rechazada, fallo de setup o pérdida de
observación. Primero inspeccionar la ejecución original y conservar su resultado.
Un fallo no se convierte en aprobación ni cambia el selector histórico.

El resultado exige verificación independiente de inputs antes/después, procesos,
muestras, salidas, todas las filas y decisiones antes de considerar un cambio
del gate. No acredita rendimiento de ownership ni cierre de la migración.
