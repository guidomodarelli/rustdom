# Calificación real del aislamiento por carga

Doce contratos pasan en Linux Node22.12.0 y24.14.1, sin omisiones. Por versión:
40 procesos aislados, cinco copias físicas oficiales y ocho cargas por copia;
dos procesos seeded anteriores con ocho cargas cada uno. Son 56 lotes y 504
tiempos funcionales por Node. Esos tiempos no conceden aceptación de rendimiento.
Los endpoints observan Window y Document por separado y exigen liberación antes
de terminar el worker. Los índices históricos seeded se verifican offline y
siguen rechazados; el método nuevo rechaza su relabel como evidencia propia.

El arnés compartido conserva sus defaults históricos y agrega una política
explícita de partición por proceso. El schedule expande cada tratamiento en ocho
procesos y conserva los cuatro factores globales; rowIndex identifica una carga
canónica aunque cambie su orden. Se valida lote único, selección física, flags,
prefijo RNG completo, hashes públicos y endpoints reales. El verificador rechaza
filas ausentes/duplicadas, índices alterados y supervivientes declarados claros.

El estudio previsto mantiene las ocho filas, 16 posiciones, ambas fases y Nodes:
1024 procesos y9216 tiempos por Node. Conserva el pooled-median de144 muestras
por celda, warmups3/9muestras y presupuestos jsdom±2%, Rust AA±5%/AB+5%.
El arranque, GC inicial y teardown se repiten por carga: aumenta su cantidad
global. No se afirma equivalencia de historia GC/JIT, memoria pico o causalidad.
La hipótesis elimina historial entre cargas; sus beneficios aún no se midieron.

qualification.tar.gz conserva795miembros, fuentes congeladas, comandos/versiones,
PIDs, stdout/stderr, informes y launchers prospectivos. raw-files.json autentica
cada miembro y se verificó el readback. source-manifest.json contiene415fuentes,
SHA7b13cad926da839fc5650dc0d7a49e9e49c1c71af7fdf9192df5359ee6da51df.
El archivo tiene11957854bytes ySHA
31a683c302e666342732229403eb00aa6538e59bcdc58f6ed326f8dba5f11c4e.
Los paquetes oficiales y el ensayo previo están publicados en los archivos
históricos del repositorio; sus rutas locales quedan registradas para esta
calificación. No se duplican sus distribuciones aquí.

Los launchers preservan el patrón de fuente publicada: autentican el HEAD remoto,
recibo de revisión y415blobs; construyen un snapshot Git y exigen sus hashes antes
de crear workers. Un marcador exclusivo impide reiniciar la secuencia. Ambos
Nodes deben terminar y verificarse, incluidos rechazos; no se repite ni extiende
el estudio. Se requiere revisión final, commit/push y autenticación antes de medir.
No se debe modificar el grafo medido ni ejecutar trabajo intensivo durante él.

Memoria de calificación:672owners de cada tipo por Node,1344en total por tipo.
Detalles y límites en reports/memory/native-class-ownership-row-isolation-method-2026-10-22.md.
Esto no agrega Rust ni acepta ownership. Los cuatro controles jsdom rechazados
previos siguen publicados en bc269e63; no hay tag/merge ni porcentaje de migración.
