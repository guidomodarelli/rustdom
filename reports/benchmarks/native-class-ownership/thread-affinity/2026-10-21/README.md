# Diagnóstico de afinidad y CPU del hilo

La única secuencia P M M P terminó entre 2026-10-21T19:19:43.736Z y 2026-10-21T19:20:46.071Z con exit 0 de fidelidad. accepted=false: no se ejecutó el candidato B ni se aprueba rendimiento. Node v22.12.0/V8 12.4.254.21-node.21, 13th Gen Intel(R) Core(TM) i7-1360P, Linux/WSL y principal en CPU 2.

Se verificaron ocho procesos, 144 duraciones y 192.000 copias públicas incluyendo warmups, las quince fuentes congeladas y el reloj Rust de 546640 bytes/SHA-256 dcf97f05c4a088916a6a391efd32d62663c719a35788540f0396ea014dc4c51d. Cada fila tiene 18 muestras de dos procesos. P fija todo el proceso; M solo el principal y conserva máscaras más amplias en hilos existentes. Los raw guardan cada máscara por TID.

| Motor | Filas | Modo | Pared pública ms | CPU del bracket ms | Pared exterior ms |
| --- | ---: | --- | ---: | ---: | ---: |
| rustdom | 250 | process | 16.0630 | 4.6688 | 18.2657 |
| rustdom | 250 | main | 5.6071 | 5.6115 | 5.6171 |
| rustdom | 1000 | process | 16.9264 | 4.5114 | 18.8854 |
| rustdom | 1000 | main | 5.6186 | 5.6067 | 5.6282 |
| jsdom | 250 | process | 9.8220 | 2.2577 | 10.5296 |
| jsdom | 250 | main | 2.8042 | 2.8083 | 2.8165 |
| jsdom | 1000 | process | 2.2788 | 1.9790 | 14.5591 |
| jsdom | 1000 | main | 2.3676 | 2.3716 | 2.3788 |

Las columnas son medianas independientes y no se restan entre sí para inferir una mediana de pausas. El intervalo de CPU contiene al temporizador público y está contenido por el intervalo de pared exterior. Incluye parte de la instrumentación; no es CPU exacta del cuerpo. El campo heredado medianNonMainCpuPercent representa un residuo entre intervalos de límites distintos: no es una división exacta del tiempo público ni identifica la causa de espera. No se utiliza como criterio de aceptación.

En este contexto P y M producen observaciones distintas, con diferencias grandes entre pared y CPU en P. Esto justifica estudiar un método con afinidad del principal. No identifica por sí solo al hilo responsable, no atribuye causalidad a V8/SDK, no traslada estos tiempos al estudio original ni garantiza calibración A/A o presupuesto A/B. No se repite esta secuencia para elegir resultados favorables; el presupuesto original continúa pendiente.

Las 192 observaciones conservan tres rondas de limpieza y los dos endpoints finales claros de Window/Document; Range vuelve a cero en los workers Rust. Memoria posterior a limpieza no equivale a pico ni prueba universal de ausencia de fugas. Los recursos están resumidos en reports/memory/native-class-ownership/thread-clock/affinity-2026-10-21.json. Son casos de éxito A0/jsdom; no cubren las fugas de errores conocidas del checkpoint 67.

Fuentes y contratos previos: reports/validation/native-class-ownership/thread-clock/. Rust fmt, Clippy, test y Memcheck aprobaron; se conservan 48 bytes posiblemente perdidos y 548 alcanzables de std/test. Node22 conserva el skip explícito de la API threadCpuUsage ausente, y Node24 ejerció su comparación adicional. El helper usa CLOCK_THREAD_CPUTIME_ID mediante libc/napi-rs; se puede reconstruir con su Cargo.lock y build.mjs. El binario no forma parte del paquete de producción.

Verificar: node reports/benchmarks/native-class-ownership/thread-diagnostic.cjs --verify reports/benchmarks/native-class-ownership/thread-affinity/2026-10-21
