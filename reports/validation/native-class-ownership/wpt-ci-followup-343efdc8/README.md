# CI del fix WPT confirmado en el SHA publicado

El run39828339458 terminó success sobre343efdc876638aa312018e048420183bade83c25:
ocho jobs aprobados, con validate/memoria/paquete en Linux, Windows y macOS,
Valgrind en Linux y cuatro shards más el agregador de benchmarks generales.
XMLSerializer39828339502 y preparación39828339498 también aprobaron.

El log completo Windows conserva3748 tests generales y8 WPT aprobados, además
de Jest, Vitest normal/VM y los corpus posteriores. El caso Range compara2808
resultados entre los motores con estado global OK y los mismos límites. No se
reinterpretan como certificación de cumplimiento completo de estándares.

El worker remoto usó Node24.21.0; la reproducción local publicada en343efdc8
usó también24.22.1, versión del fallo anterior. No atribuir el resultado a una
única causa ni fingir igualdad de los entornos. La referencia remota tardó
130572.2374ms y el candidato18574.3869ms: los timers del arnés no interrumpen
trabajo JS síncrono, por lo que un límite configurado no es un límite estricto
de duración de pared. Se conservan resultados y tiempos observados sin ajuste.

run.json y receipt.json fijan SHA, jobs e identidad del log comprimido.
Este éxito corrige el CI general. El gate independiente de ownership39828339560
sigue rechazando la correspondencia de fuentes históricas; rendimiento no
aceptado, sin merge/tag del hito ni crédito de migración nuevo.
