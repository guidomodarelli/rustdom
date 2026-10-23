# Recursos del método prospectivo de telemetría nativa

Revisión de diseño y lectores; **sin profiling nativo nuevo ni medición de memoria**.
El runtime `5ef668c4…` y sus rutas de ownership no cambiaron. La revisión de código
y los contratos no demuestran ausencia de fugas del profiler implementado.

`worker.cjs` guarda GC como `startMs/durationMs/kind/flags`, sin WeakRef.deref ni
targets DOM dentro de esos eventos. Perfiles y errores permanecen ligados a un
solo proceso finito; no se agrega un cache global de ventanas o documentos.
El primer error se conserva hasta reportarlo después del teardown; no se afirma
que toda referencia de un error arbitrario esté liberada durante ese intervalo.

Stop y disable de Inspector, drenaje/desconexión del PerformanceObserver y
disconnect de la sesión se intentan por separado. Un error en uno no omite los
siguientes intentos. Los flags de cada operación y sus fallos se conservan en
el sidecar; no se marca completo un proceso con un fallo, incluso si se lanzó
un valor primitivo. El timeout termina el proceso si no finaliza; eso no prueba
que sus destructores o el último log hayan podido ejecutarse.

El sampler conserva doce Window y doce Document por proceso, tres rondas y dos
estados finales claros antes de salir, incluso mientras la instrumentación está
activa. El lector exige esas cantidades canónicas, batch completo y retorno al
baseline nativo con `isReleased`. Los casos negativos reales rechazan trazas
vacías/ausentes, counts relajados, owners omitidos y baselines inválidos.

Si el diagnóstico autorizado llegara a completarse, se esperarían 6144 Window
y 6144 Document en total, separados por motor/mode/Node/paquete en los datos
individuales. Hoy son cantidades planificadas, no observaciones. Inspector no
garantiza stacks internos de Rust y puede cambiar la retención o el costo; el
profiler nativo end-to-end sigue sin validarse antes de esa captura.

El padre escribe cada reporte y su análisis por separado; conserva el índice,
hashes y tres snapshots de `process.memoryUsage()` sin GC forzado. No retiene
todos los árboles de frames/GC/JIT analizados entre workers. Esos snapshots no
son memoria pico ni distinguen por sí solos allocator, heap recolectable o fuga.

El método conserva todos los eventos y perfiles disponibles, sin recortes para
ajustar memoria o aceptación. Hay límites de 180000 ms por worker y 110 minutos
para el colector, además del step/job. Un parcial o rechazo de integridad sigue
incompleto y no autoriza repetir la captura. Se necesita revisión/CI del método
publicado y autorización humana independiente; ningún proceso nuevo se ejecutó
para preparar esta evidencia.
