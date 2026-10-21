# Calibración con warmup revisado

Se declara antes de medir, después de los pilotos de GC/CPU/JIT. Con 256 batches
de warmup los procesos trazados ya no muestran compilación de funciones del
runtime en el intervalo medido de tamaño uno. Node 24 todavía compila el propio
probe y `cpuUsage`, que no pertenecen al producto. El calentamiento reduce esa
fuente observable de variación; no demuestra que elimine toda la variación.

Se conservan las trece filas, CPU 2, Node 22.12.0/24.14.1, entradas, binarios y
presupuestos. Se usan 256 batches de warmup para tamaños 1 y 16 (16.384 y 4.096
llamadas); los tamaños 100/1.000 conservan 16 batches. Los tamaños pequeños se
calientan más para evitar cruzar tiers del JIT durante las muestras. No se
desactiva el JIT ni se cambia su política. No hay observador GC, CPU adicional
ni flags de trazas en la aceptación.

Los diagnósticos todavía muestran variación entre procesos aun con ese warmup.
Para aumentar la precisión entre procesos se fijan **dieciséis procesos por
fila**, ocho por etiqueta, antes de observar la calibración nueva. El orden es
`A B B A B A A B B A A B A B B A`: dos mitades equilibradas y reflejadas. Son
208 procesos A/A, con 256 muestras medidas por etiqueta y fila. Se conservan
32 batches medidos y 64/16/4/1 llamadas por batch, sin eliminar outliers ni GC.
No se prolonga una corrida en función de sus resultados.

A/A exige ±2% en cada fila. Solo si las trece calibran se ejecuta A/B, con igual
orden y presupuesto máximo de +5% por fila, seguido de la referencia descriptiva
jsdom/Rust en orden ABBA. El piloto comienza por Node 22; si falla A/A, se omiten
A/B, referencia adicional y Node 24 con ese protocolo. No se compensa una fila
con otra. Este diagnóstico no cierra el gate pendiente de clonado.

Los archivos se guardarán en `warmup-256/`, con identidad nueva del harness y
fuentes separadas. Los métodos previos y sus resultados permanecen intactos.
