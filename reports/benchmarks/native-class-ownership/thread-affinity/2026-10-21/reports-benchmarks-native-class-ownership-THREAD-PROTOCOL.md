# Diagnóstico de CPU del hilo y afinidad

Se declara antes de medir. El A/A contrabalanceado no calibró: jsdom varió
−31,74%/−7,52% y Rust −2,13%/−0,33% en 250/1.000. Las muestras individuales
alternan entre valores bajos y altos hasta las últimas rondas; no se observa
un calentamiento convergente que justifique simplemente prolongarlo. Los
perfiles anteriores registraron superposición de compilación, sin demostrar
CPU consumida ni causalidad del SDK.

## Pregunta y reloj

¿Cuánto tiempo de los intervalos observados ejecuta realmente el hilo principal,
y qué ocurre al fijar únicamente ese hilo en lugar del proceso completo?
Es un diagnóstico descriptivo de contexto, **no una comparación del candidato**.
No acepta rendimiento, no cambia umbrales ni gates anteriores y no acredita
nuevas APIs Rust. Se usan únicamente checkpoint 67/A0 y jsdom 27.4.0/J0.

El addon separado `benchmarks/native-thread-clock` reutiliza `napi`/`libc` y
consulta `CLOCK_THREAD_CPUTIME_ID`. No crea referencias persistentes ni estado.
Tiene Cargo.lock propio; no modifica el lock ni el addon de producción. La
prueba Rust ejerce dos hilos reales. Los contratos Node ejercen el addon real
y un Worker ocupado para comprobar que no se cuenta su CPU en el hilo principal.
Node 24 además compara con `process.threadCpuUsage`; Node 22.12 carece de esa
API y conserva explícitamente esa exclusión, sin sustituir el reloj por un mock.

La alternativa `/proc/thread-self/schedstat` se descartó para los límites de
intervalos tan cortos: Linux 6.6 publica `sum_exec_runtime` acumulado, sin
forzar una actualización en ese handler. El contador de espera tampoco se
interpreta como cero cuando `sched_schedstats=0`, como ocurre aquí. No se cambia
esa configuración global. La prueba preliminar de `/proc` es exploratoria,
no una medición de DOM ni evidencia de CPU exacta del benchmark anterior.

Fuentes primarias: [relojes Linux](https://man7.org/linux/man-pages/man3/clock_gettime.3.html),
[handler Linux 6.6](https://github.com/torvalds/linux/blob/v6.6/fs/proc/base.c#L449-L461),
[estadísticas del scheduler](https://docs.kernel.org/scheduler/sched-stats.html),
[API Node](https://nodejs.org/api/process.html#processthreadcpuusagepreviousvalue).

## Diseño fijado

Node 22.12.0, Linux/WSL y CPU 2. Una sola secuencia de cuatro bloques:
proceso completo, hilo principal, hilo principal, proceso completo (P M M P).
Cada bloque ejecuta un proceso real por motor, alternando cuál se ejecuta
primero. Son ocho procesos; no hay A/B, extensión ni reintento según resultados.
No ejecutar builds, tests o benchmarks locales simultáneos a la medición.

- P: `taskset -c 2 node ...`; todos los hilos heredan CPU 2.
- M: Node inicia con su máscara normal. Se inicializa libuv con una lectura
  asíncrona antes de `taskset --pid --cpu-list 2 <pid>`, que fija solo el hilo
  principal. Los hilos existentes conservan sus máscaras. Se registran máscaras
  antes/después y al terminar; se exige principal en CPU 2 y algún hilo de fondo
  con otra máscara. Hilos creados después pueden heredar CPU 2: no se presume
  que todos los compiladores/collectors tengan otra máscara ni se infiere su rol.

Cada proceso carga un único paquete A0 o J0; no se duplica su módulo. Se
reutilizan el fixture y cleanup anteriores; el sampler instrumentado conserva
preparación, contenido, clones, consultas y todas las comprobaciones originales.
Cada muestra construye otro JSDOM. Por tamaño conserva tres warmups y nueve
muestras, con 1.000 cloneRange/collapse/compareBoundaryPoints y checksum 500.
Tamaños 250/1.000, invertidos en bloques impares. Total: 144 duraciones medidas,
192 observaciones y 192.000 copias públicas incluyendo warmups.

Fuera del temporizador público se toman dos lecturas del reloj nativo, encerradas
por otro intervalo de pared. Se guardan los seis timestamps escalares. El delta
de CPU pertenece a ese **intervalo envolvente**, que incluye el pequeño costo
de instrumentación; no se presenta como CPU exacta del cuerpo cronometrado.
Se informa también ese overhead. La diferencia pared/CPU puede contener espera,
descheduling, virtualización u otras pausas: no se atribuye automáticamente a
compilación de V8 ni al SDK. No se filtran muestras ni se usa CPU en lugar de
pared para aprobar el presupuesto original.

Se conservan Window/Document por separado y tres rondas fijas de limpieza,
exigiendo los últimos dos endpoints claros y contadores Range equilibrados.
Los snapshots posteriores a limpieza no miden memoria pico ni ausencia universal
de fugas. Paquetes, fuentes del método y binario del reloj quedan identificados
antes/después. Las quince fuentes se congelan antes de medir. Se preservan todos
los raw, errores y stdout/stderr; `accepted=false` es incondicional.

## Criterio de interpretación

Se publican medianas completas de pared pública, CPU envolvente, pared envolvente,
overhead y fracción no ejecutada por el hilo principal, por motor/tamaño/modo.
Son dos procesos por celda: sirven para un diagnóstico acotado, no para una
certificación ni para estimar efectos pequeños con confianza estadística.
La fidelidad y las comprobaciones de recurso deben pasar; el resultado de
rendimiento del candidato continúa sin aceptar cualquiera sea el diagnóstico.
