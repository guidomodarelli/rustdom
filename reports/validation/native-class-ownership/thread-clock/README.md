# Reloj de CPU y diagnóstico de afinidad

El helper Rust separado en `benchmarks/native-thread-clock` utiliza `libc` y
`napi-rs`, con lock propio y `publish=false`. No modifica producción. Se construyó
con Rust 1.99.1/Linux; `build.mjs` copia su cdylib a `thread-clock.node`, que no
se versiona ni se incorpora al paquete de rustdom. Su SHA-256 ejecutado es
`dcf97f05c4a088916a6a391efd32d62663c719a35788540f0396ea014dc4c51d`.

## Validación antes de medir

Pasaron `cargo fmt --check`, Clippy `--all-targets -- -D warnings` y el test Rust
que mantiene ocupado otro hilo mientras observa la CPU del llamador. Los logs
son `fmt.log`, `clippy.log` y `rust.log`; `artifacts.jsonl` identifica el ejecutable.
Memcheck de ese test terminó con exit 0 y cero errores, sin pérdidas definitivas
ni indirectas. Se conservan 48 bytes posiblemente perdidos y 548 alcanzables,
con stacks de std/test, en `reports/memory/native-class-ownership/thread-clock/`.
Este control no instrumenta el addon completo dentro de V8.

Con el helper compilado y `RUSTDOM_PAIRED_MANIFEST` apuntando a las distribuciones
reales A0/J0 de `/tmp/rustdom-paired-copies-xkeEqd/manifest.json`:

```sh
node --expose-gc --test reports/benchmarks/native-class-ownership/thread-clock.spec.cjs
```

La primera secuencia pasó en ambos Node. Después de agregar PID y comprobarlo
contra el proceso real, se repitió completa: Node 22.12.0 aprobó seis tests y
conservó un skip explícito de `process.threadCpuUsage`, ausente en esa versión;
Node 24.14.1 aprobó los siete. Incluyen el addon real en un Worker ocupado,
comparación con el reloj nativo de Node 24, checksum y salida originales y
cuatro workers completos de los dos motores en ambas configuraciones de afinidad.
Los logs finales son `node22.log` y `node24.log`; los anteriores se conservan
como `initial-node22.log` y `initial-node24.log`. No son muestras del diagnóstico.

La revisión nativa aislada de solo lectura cerró con cero hallazgos antes de
medir. `before-performance.json` congela quince fuentes, el binario del reloj
y once archivos de evidencia. Sus hashes coinciden al finalizar la corrida.

## Resultado y alcance

La única secuencia P M M P terminó con exit 0 de fidelidad, `accepted=false`,
ocho procesos, 144 duraciones y 192.000 copias públicas. No ejecuta al candidato
B ni aprueba su rendimiento. Los 46 archivos del manifest y su manifest están en
`reports/benchmarks/native-class-ownership/thread-affinity/2026-10-21/`.

La afinidad del proceso completo y la del principal produjeron resultados
distintos. Los datos justifican estudiar el contexto de afinidad del principal;
no identifican al responsable de las pausas ni convierten el A/B anterior en
aceptado. Los intervalos de CPU contienen el temporizador público pero no tienen
sus mismos límites. Se conserva pared exterior e instrumentación; el residuo
porcentual guardado no es una división exacta del tiempo público. Se usan las
medianas completas sin filtrar muestras. Son dos procesos por celda, con los
límites exploratorios documentados en `THREAD-PROTOCOL.md`.

Los raw guardan las tres rondas de limpieza de las 192 observaciones, con
los últimos dos endpoints claros de Window/Document y Range liberados en los
workers Rust. El resumen posterior a limpieza está en
`reports/memory/native-class-ownership/thread-clock/affinity-2026-10-21.json`.
No mide memoria pico ni ausencia universal de fugas; no cubre los errores de
construcción conocidos del SDK de referencia.

Después de la corrida se agregaron cinco contratos de `thread-evidence.spec.cjs`
sobre los archivos reales y copias físicas privadas. Recalculan toda la corrida
y rechazan timestamps de CPU invertidos, máscara principal incorrecta, Range
retenido y aceptación falsa, aun refrescando el hash interno del reporte. Pasaron
5/5 en ambos Node; logs `evidence-node22.log` y `evidence-node24.log`. No producen
nuevas muestras ni forman parte de las quince fuentes congeladas del método.
