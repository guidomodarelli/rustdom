# DOMRect y DOMRectReadOnly nativos

Rust conserva los cuatro escalares y calcula top/right/bottom/left y los ocho
valores de los snapshots. El binding posee exclusivamente cuatro doubles; no
almacena Document, Window, callbacks ni referencias N-API persistentes. Los
wrappers WebIDL conservan coerción, branding, readonly, herencia y factories.
El bridge mantiene la referencia al realm visible a V8 y construye el objeto
de toJSON en el mismo realm que la implementación de referencia.

Los cálculos siguen las reglas de
[Geometry Interfaces](https://drafts.csswg.org/geometry/#domrect) y las
operaciones de la referencia jsdom 27.4.0. La comparación de extremos propaga
NaN y distingue +0 y -0; no sustituye Math.min/Math.max por las operaciones
Rust que ignoran un operando NaN. También conserva overflow, infinitos y
subnormales. No se agregan caches ni registros de objetos vivos: los contadores
son escalares y Drop registra liberaciones.

El hito no agrega layout ni cambia el comportamiento simulado de
getBoundingClientRect en jsdom. No completa CSSOM ni las otras familias de
plataforma pendientes.

## Evidencia focal

[Baseline](dom-rect/baseline.log) e [integración](dom-rect/integration.log)
aprobaron 25 contratos públicos en realms normal y VM. Incluyen 169 pares de
valores especiales por constructor y realm, ambas dimensiones, coerción,
errores, setters reentrantes, fromRect, herencia, copia independiente,
descriptores y realm/orden de toJSON. Los JSON diferenciales codifican NaN,
infinitos y -0 explícitamente para no perder la evidencia al serializarla.

[Cuatro tests Rust](dom-rect/rust-focused.log) y Clippy pasaron. La
[ejecución conjunta](dom-rect/contracts.log) aprobó los 25 contratos públicos
y tres contratos nativos: snapshots independientes, todas las parejas de
valores especiales y activación de los factories públicos.

Los [WPT focales originales](../compatibility/2026-09-14T23-50-18.140Z-linux-wpt.json)
aprobaron sus 70 casos en ambos motores. Se conservan los archivos y hashes de
la revisión `8d124dbe46f46f55531f28f13eccf1113f794c12`; no se modificaron sus
assertions. Los avisos compartidos de CSS del harness no cambiaron esos resultados.

La [memoria focal](../memory/2026-09-14T23-50-37.337Z-dom-rect.json) pasó 12 ciclos:
jsdom/rustdom, realms normal/VM y tres repeticiones con 1.000 rectángulos cada una.
Mientras los rectángulos permanecen retenidos, también lo hacen Document y Window,
igual que en la referencia. Tras soltarlos, los tres grupos se recolectan aun
conservando los snapshots. Las 6.000 asignaciones nativas observadas retornaron a
cero vivas, con 6.000 liberaciones registradas. Son observaciones finitas, no una
prueba absoluta de ausencia de fugas.

## Validación general

La [ejecución general](dom-rect/validation.json) pasó 231 tests Rust, 1.595 Node,
11 Jest, 22 Vitest y 26 Vitest VM, además de formato, Clippy y corpus completos
dentro del alcance configurado. Después de esa ejecución se agregó un contrato
público contra setters heredados en Object.prototype; su
[validación adicional](dom-rect/prototype-regression.log) pasó en ambos motores
sin cambios de implementación. El conteo de 1.595 corresponde a la ejecución
general anterior a ese caso adicional, no a una repetición de toda la suite.

HTML5 mantuvo 1.784 casos comparables con ocho exclusiones de scripting. El
[WPT general](../compatibility/2026-09-14T23-58-48.728Z-linux-wpt.json) mantuvo
47.072 resultados en paridad: 46.005 aprobados por el estándar y 1.067 fallos
compartidos. Range-deleteContents conserva su exclusión por error en el bootstrap
de la referencia; esto no se presenta como conformidad total.

## Memoria y distribución

La [memoria focal final](../memory/2026-09-15T00-01-29.477Z-dom-rect.json) volvió a
aprobar los 12 ciclos. El [estrés general](../memory/2026-09-15T00-02-55.164Z-linux-x64.json)
aprobó los cinco modos. Rustdom liberó los 1.762 documentos y 882 ventanas
observados; cada modo Vitest liberó 1.760 documentos y 880 ventanas. Los deltas
RSS conservados son 29,50 MiB para rustdom, 25,23 MiB para Vitest y 43,11 MiB
para Vitest VM. Se distinguen esos deltas de allocator/RSS del número de owners
retenidos y de memoria pico.

[Memcheck](../memory/2026-09-15T00-02-55.000Z-dom-rect-valgrind.log) ejecutó los
cuatro tests Rust sin errores ni pérdidas definitivas o indirectas. Conserva
48 bytes posiblemente perdidos y 544 alcanzables en std/libtest, sin supresiones.
La liberación del binding N-API se verifica con los ciclos de GC anteriores;
los tests Rust aislados no ejercen V8.

El binario tiene SHA-256
`fd288751b461f115439e3d720c1338e06a2d741249aa68e081aee5dfdc3ebe44`.
El paquete `ff9270d031d6729ef2cd8177cac5c07cb87b93f3388a0e52e343ffadfbcd7d44`
pasó los [18 controles de Node 24](../distribution/2026-09-15T00-04-04.285Z-linux-x64.json)
y los [18 de Node 22](../distribution/2026-09-15T00-06-14.838Z-linux-x64.json).
Ambas instalaciones ejercen el mismo archivo y binario mediante npm/pnpm,
consumidores tipados, CJS/ESM/VM, workers y runners reales.

Los [11 tests del arnés de benchmarks](dom-rect/benchmark-tests.log) pasaron.
Sus diagnósticos deliberados de deadline/rechazo se conservan en los archivos
`*-failed.json`; no se confunden con las muestras finales de DOMRect. Los
benchmarks finales completaron su ejecución aislada.

## Rendimiento

El [resultado final](../benchmarks/2026-09-15T00-10-29.501Z-linux-x64.md) conserva
[muestras crudas, entorno, hashes y metodología](../benchmarks/2026-09-15T00-10-29.501Z-linux-x64.json).
Se midieron 18 muestras por fila en dos procesos por motor, con tres warmups
por proceso, Node 24.14.1, jsdom 27.4.0, Intel i7-1360P y WSL2. Cada fila mide
100 o 1.000 rectángulos. Preparación, comprobaciones y limpieza quedan fuera del
tiempo, excepto la construcción cuando esa es la operación medida. Los cruces
N-API y los wrappers públicos quedan incluidos. Cada campo y checksum se
verifica fuera del tiempo. Los rectángulos se sueltan antes del GC final.

| Operación | Rectángulos | jsdom mediana (ms) | rustdom mediana (ms) | jsdom / rustdom |
|---|---:|---:|---:|---:|
| Creación | 100 | 0,150 | 0,293 | 0,51× |
| Lectura de bordes | 100 | 0,134 | 0,252 | 0,53× |
| Mutación y bordes | 100 | 0,237 | 0,423 | 0,56× |
| toJSON | 100 | 0,169 | 0,254 | 0,66× |
| Creación | 1.000 | 0,651 | 1,425 | 0,46× |
| Lectura de bordes | 1.000 | 0,824 | 1,504 | 0,55× |
| Mutación y bordes | 1.000 | 1,236 | 2,766 | 0,45× |
| toJSON | 1.000 | 0,714 | 1,390 | 0,51× |

Todas las operaciones medidas son más lentas que jsdom: aproximadamente 1,5–2,2
veces. El hito acredita migración de estado y cálculos, no una mejora de
rendimiento. El tiempo incluye el binding por operación; estas mediciones no
separan causalmente cada costo. La memoria del benchmark es posterior al GC y
no representa memoria pico ni reemplaza los controles de ownership anteriores.
