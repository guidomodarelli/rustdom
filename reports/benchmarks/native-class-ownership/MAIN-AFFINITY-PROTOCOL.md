# Ownership: operación pública con afinidad del principal

Método `main-affinity-public-v2`, declarado antes de medir. El diagnóstico P M M P conservó los mismos cuerpos
públicos y observó una separación entre pared y CPU envolvente cuando todos
los hilos compartían una CPU; al fijar solo el principal, ambos tiempos fueron
cercanos en sus dos procesos por celda. No identifica qué hilo interfirió ni
demuestra causalidad del SDK. Motiva esta hipótesis discriminable: dejar que
los hilos de fondo existentes mantengan su máscara normal puede permitir una
comparación de pared calibrada sin modificar el trabajo público.

## Fuentes y alcance fijados

Referencia A: checkpoint 67, commit `3d37f89976a48203e80cc5c435e099267f4ce346`,
sourceHash `67523bf38c8bfd32286618de24cee952b684f32fd91a322c407f7111cd73be3f`.
Candidato B: guard de ownership, sourceHash
`8332276799c5ccc18c7a45a5136a856b039736597d5e104e22f074f8e23f1ddd`.
Se comprueban fuentes, binarios, distribuciones completas de A/B y distribución
independiente de jsdom 27.4.0 antes/después. El método también se congela y se
preserva en cada archivo.

La identidad de A/B usa `fingerprint(root, ['dist', 'package.json'])`: incluye
cada archivo compilado, el addon y el descriptor del paquete, con path, tamaño
y SHA-256. Los digests esperados proceden de `packages.distributions.A0` y `B`
del archivo independiente `paired/2026-10-21/index.json`, y se comprobaron
contra los paquetes originales completos antes de declarar v2 (569 archivos
por distribución):

- A: `d360853908d14614fb552c5578e300ce9b7b28dc6925f6558d14e5631e2dc248`.
- B: `efc4f2df4eface0daeb4cd2ea045ee6ffd3ff7ccc2c3425ed0fb050fa13c012d`.

El índice conserva los manifests completos iniciales (`distributions`) y
finales (`distributionsAfter`). Rechaza un digest distinto antes de iniciar
workers; al finalizar vuelve a capturar todos los bytes y exige identidad con
los manifests iniciales y los digests fijados. La verificación offline
recalcula los digests de ambas listas completas y los contrasta con los valores
esperados. Así detecta JavaScript compilado diferente aunque fuentes y addon
sigan idénticos. No es necesario que los paths originales sigan disponibles
para verificar el archivo.

v1 no conservaba la identidad completa de A/B. Sus índices y snapshots son
evidencia de un método distinto e incompleto para este contrato: no se
reutilizan, completan ni aceptan como v2. Los datos interrumpidos permanecen
intactos. El cambio de revisión solo corrige esta comprobación de identidad;
no cambia operaciones, temporizadores, muestras, afinidad ni presupuestos.

Node 22.12.0 y 24.14.1, Linux/WSL en la misma máquina, una secuencia completa
por versión. El host Windows no queda aislado. No se ejecutan builds, tests ni
otras mediciones locales al mismo tiempo. No se cambian JIT, flags de V8, GC
automática ni configuración global del scheduler.

Se usa directamente `benchmarks/worker.cjs` del harness congelado del candidato,
con la selección de paquete ya existente. No se copia ni reescribe su operación
o limpieza. Cada proceso carga una implementación. Las cuatro cargas originales
son `range-control-1000`, `range-state-lifecycle-1000` (250/1.000),
`mutation-records-collect` y `observer-delivery-records` (100/1.000): ocho filas.
Incluyen creación y copia nativas, mutaciones y entrega real de callbacks.

El bootstrap inicializa libuv mediante una lectura asíncrona antes de fijar el
PID principal en CPU 2 con taskset. Registra TID, nombre y máscara inicial,
configurada y final. El principal debe estar en CPU 2 después del cambio y
debe observarse al menos otro hilo con máscara más amplia. No se afirma que
todos los hilos futuros retengan esa máscara: pueden heredar la del principal.
Se conservan errores y archivos parciales. El bootstrap no usa el reloj Rust
auxiliar ni instrumenta los cuerpos cronometrados.

## Secuencia y aceptación

Por Node se completa primero A/A y luego A/B, incluso si A/A no calibra.
Cada fase conserva los ocho bloques A B B A B A A B. Cada bloque ejecuta
cuatro procesos independientes en orden jsdom, Rust, Rust, jsdom. En A/A ambas
etiquetas cargan A; en A/B, B carga el candidato. jsdom es la misma referencia
independiente en todas las etiquetas, fases y versiones.

Cada proceso usa el worker original: tres warmups y nueve muestras por fila,
un DOM nuevo por muestra y su limpieza original. Son 64 procesos y 4.608
duraciones medidas por Node; 128 procesos y 9.216 duraciones en total.
Cada fase/etiqueta/motor/fila aporta 72 muestras. Se conservan todos los stdout,
stderr y sidecars, sin filtrar muestras ni ejecutar corridas adaptativas.

Se comprueban resultados y hashes de salida idénticos en todas las etiquetas,
motores y fases. Los assertions originales verifican checksums y activación
nativa. Se conservan medianas por proceso y medianas agrupadas de las muestras.
A/A exige control jsdom ±2% y Rust ±5% en cada fila. A/B exige control jsdom
±2% y Rust como máximo +5%. Solo aprueba si todas las filas de ambas fases
satisfacen esos criterios. Para el hito completo deben aprobar ambas versiones.
No se usan tiempos de CPU en lugar de pared ni se relajan presupuestos.

Si no calibra, queda inconcluso para atribución. Si calibra y degrada más del
presupuesto, requiere corregir la causa antes de integrar. No se repite esta
misma secuencia para elegir un resultado favorable. Los datos anteriores
permanecen fallidos/inconclusos con sus propios métodos y no se reclasifican.
Una aceptación nueva solo describe este host y protocolo; no prueba mejora
global ni reemplaza por sí sola el gate anterior. Su uso para cerrar el hito
requiere revisión explícita del método, los resultados y los checks.

## Memoria y límites

El worker conserva nueve observaciones de memoria posteriores a su limpieza
por fila. No equivalen a pico ni observan WeakRefs de Window/Document. Este
experimento no reemplaza las regresiones de ownership, workers y endpoints
publicadas para ambos Node. No se cambia GC ni limpieza para obtener mejores
tiempos. Cada proceso termina antes de iniciar el siguiente.

Las pruebas funcionales previas ejecutan las ocho filas sobre A, B y jsdom
en ambos Node y comprueban el contrato del bootstrap/verificador. Esas duraciones
son validación, no forman parte del estudio ni se eligen según su rendimiento.
