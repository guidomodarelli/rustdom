# Método prospectivo: una carga pública por proceso

El ensayo seeded completo publicado en bc269e63 conserva accepted=false y sus
cuatro controles jsdom fuera de ±2%. No se repite ni se recalifica ese resultado.
La captura V8 anterior tampoco se repite. Sus invalidaciones no están alineadas
con timers y no establecen causalidad.

Este contraste elimina el historial de otras cargas del mismo isolate. Cada uno
de los 128 procesos originales se expande en ocho procesos consecutivos, uno por
carga. El padre conserva los cuatro factores globales: lead de motores, orden de
etiquetas, asignación de copia física y orden de cargas (bit4). rowIndex siempre
identifica la posición canónica de la carga, incluso cuando su orden se invierte.
No son ocho estudios sucesivos ni se pierde el balance de posiciones 0..15.

Por Node: 1024 procesos, 1024 lotes y 9216 duraciones; ambos Node suman 2048
procesos y 18432 duraciones. Cada proceso carga una sola de las cinco copias
oficiales, termina antes del siguiente y mide una carga con tres warmups
exteriores y nueve muestras. La operación pública, entrada, tres warmups del
realm actual y tres GCs previos al warmup no cambian. El GC inicial del proceso,
la importación y el teardown se repiten por carga: su cantidad global aumenta.
No se afirma equivalencia de arranque, memoria pico ni historia de GC/JIT.

Se conservan semillas 1..16 y tres lecturas RNG iniciales. Cada grupo de fase y
posición tiene 32 procesos (ocho cargas, ambos motores y etiquetas) con el mismo
prefijo RNG. V8 puede conservar un hash seed dentro de snapshots; no se controla
toda su entropía. No se desactivan JIT, GC natural ni compilación concurrente.
El hilo principal mantiene CPU2 y se registran las máscaras de los demás hilos.

Se usa el mismo estimador: 144 muestras por fase/carga/motor/etiqueta, mediana
agrupada y presupuestos jsdom AA/AB ±2%, Rust AA ±5% y Rust AB +5%. Se mantienen
todas las ocho cargas, ambas fases, 16 posiciones y Node22.12.0/24.14.1. Un fallo
no autoriza repetir, extender muestras, escoger filas, semillas o presupuesto.
La integridad y aceptación son decisiones distintas. Los negativos se conservan.

Los workers deben observar Window y Document por separado y liberar sus owners y
baselines nativos antes de salir. La salida del proceso no reemplaza ese control.
Los endpoints requieren los mismos rounds claros y límites acotados que antes.
Las observaciones finitas no certifican ausencia universal de fugas.

Antes de medir se exige calificación real en ambos Node: cinco copias oficiales,
ocho hashes públicos, aislamiento, teardown previo a salida, flags y semillas,
rechazo de filas ausentes/duplicadas, rowIndex alterado y endpoints falsos. Debe
verificarse offline el archivo seeded previo con las factories actualizadas, con
el mismo rechazo, y rechazarse su relabel como archivo row-isolation.

Luego: revisión independiente, commit/push del grafo completo, autenticación de
fuentes y recibo, y una sola secuencia con raíz nueva y marcador exclusivo. No
ejecutar trabajo intensivo ni editar fuentes medidas mientras esté activa. La
calificación no acepta rendimiento. Este cambio del arnés no agrega código Rust
ni concede aceptación de ownership, porcentaje de migración, tag o merge.
