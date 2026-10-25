# Diagnóstico offline de calibración

Este lector usa únicamente los exports autenticados del run 40137458635,
ya completo y rechazado. No ejecuta DOM, samplers ni código archivado; no
modifica datos, método, warmup, presupuestos o aceptación. No es otro estudio.

Antes de calcular, autentica por SHA256 el índice original, spans y análisis
publicados en 5f7765c4. Incluye los 2048 procesos y las 32 comparaciones para
ambos motores: 64 filas diagnósticas y 1024 pares, sin exclusiones.

Por proceso conserva mediana medida y las medianas de los tres primeros y
tres últimos samples medidos. Describe el cambio entre esos segmentos sin
interpretarlos como estimador alternativo de aceptación ni prueba de JIT/GC.
No elimina muestras extremas, warmup, procesos o semillas.

Cada par une A/B del mismo Node/fase/motor/fila/posición. Conserva medianas,
paquetes físicos, orden real del índice, distancia ordinal y fechas del padre.
Los intervalos derivados de ISO son reloj de pared, no un reloj monotónico;
se publican también si fueran negativos. La razón de medianas por par y sus
particiones por cada factor binario son descriptivas; el estimador válido
sigue siendo la mediana combinada original, reproducida por separado.

Las semillas están ligadas a posición y sus bits definen los factores: esas
particiones no identifican causalidad. No inferir que un paquete, un orden,
la temperatura del host o un cambio Rust explique las diferencias. Este
archivo no contiene telemetría de CPU/GC/JIT y no la inventa.

Los resultados deben incluir todas las particiones, filas desfavorables y
dispersión entre pares. No elegir una partición para aceptar ownership ni
ajustar retrospectivamente ±2%/±5%. El diagnóstico orienta qué incógnita
requiere un método nuevo técnicamente justificado. Los rechazos históricos
y la decisión íntegra de esta secuencia permanecen vigentes.
