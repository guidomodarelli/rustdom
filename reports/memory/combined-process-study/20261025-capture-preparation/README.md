# Recursos de preparación y lectores

Esta fase no crea Window/Document ni nuevos estados N-API. Relee los64 procesos
funcionales preservados y prepara snapshots con IO finito. Los estimadores
retienen únicamente tuples y vistas compactas, no todos los reportes completos.
El binario SDK se hashea con un buffer reutilizable de1MiB; los JSON se acotan
a16MiB. Los descriptores del hash se cierran también ante error:32 rechazos
por SDK conservaron la cantidad observable de /proc/self/fd en sus contratos.

La preparación dedicada Node22 observó23 descriptores antes y23 después.
Sus snapshots de heap/RSS/external están íntegros en preparation-snapshots.json;
no miden memoria pico ni el uso de los subprocesses. Son observaciones finitas
y no prueban ausencia universal de fugas ni distinguen retención del allocator.
Los ciclos DOM reales previos y baselines siguen en los reportes de calificación.
