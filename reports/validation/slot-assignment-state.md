# Estado nativo de asignaciones a slots

Rust conserva los snapshots ordenados de asignación y decide si cambiaron. El
plan es de solo lectura: captura candidatos, JavaScript señala el cambio y
recién entonces confirma la lista capturada. Los backlinks siguen actualizándose
después del commit. Esta separación conserva el orden observable incluso cuando
un listener modifica las asignaciones durante la entrega de `slotchange`.

`assignedNodes()` obtiene IDs de la caché nativa y devuelve arrays independientes.
Un espejo de referencias en V8 mantiene el ownership del snapshot; no se consulta
para decidir resultados. Las listas vacías no reservan entradas nativas.
Un índice inverso permite eliminar referencias al liberarse el slot o un miembro,
incluyendo miembros compartidos y duplicados de la API raw. El cambio no completa
la migración de los backlinks `_assignedSlot`, eventos ni otros drivers DOM.

## Contratos y memoria

Cuatro tests Rust nuevos comprueban captura sin efectos, commit del plan original
después de cambios, rechazos atómicos de handles/metadata, miembros compartidos,
duplicados, órdenes de finalización y reducción de 1.000 miembros a uno y a cero.
El primer intento detectó una expectativa incorrecta del test: exigía capacidad
exacta de uno para un vector con un elemento. El test ahora exige liberar la
reserva grande y llegar a cero al vaciarse. No se cambia producción para forzar
una estrategia de reserva: [Vec no garantiza esa estrategia](https://doc.rust-lang.org/std/vec/struct.Vec.html#guarantees).

Los cuatro contratos del addon ejercen el protocolo raw, snapshots independientes,
errores sin cambios parciales, notificaciones coalescidas y listeners reentrantes
contra jsdom 27.4.0 real, además del control de GC.

El [control focal de memoria](../memory/2026-09-13T05-38-27.827Z-slot-assignment.json)
guarda cinco ciclos con tres controles: snapshot retenido, liberado y array vacío
retenido. Los primeros conservan nodos y entradas nativas; soltarlos devuelve
conteos y capacidades al baseline. Document, Window y nodos se observan por
separado, en turnos distintos de GC, sin devolver referencias dereferenciadas.
Es evidencia finita de esos escenarios, no una prueba absoluta de ausencia de fugas.

Memcheck aprobó 18 tests de slots sin accesos inválidos ni pérdidas definitivas o
indirectas. El [log completo](../memory/2026-09-13T05-41-00.301Z-slot-assignment-valgrind.log)
conserva 48 bytes posibles y 544 alcanzables del arnés Rust, sin supresiones;
se guardan también la salida de tests y el SHA-256 del ejecutable. Este control
inspecciona el ejecutable Rust; el GC del addon se cubre con los controles Node.

El [estrés de cinco modos](../memory/2026-09-13T05-45-28.109Z-linux-x64.json)
aprobó jsdom, rustdom, native, Vitest y Vitest VM. Rustdom liberó los 1.322
documentos y 882 ventanas observados, y cada Vitest liberó 1.320 documentos y
880 ventanas. Heap/RSS retenido: 2,76/18,31 MiB en rustdom, 4,05/87,75 MiB
en Vitest y 3,65/29,75 MiB en VM. Estos valores son memoria del proceso después
de warmup, teardown y GC; no son memoria pico ni conteos totales de allocations.

## Validación integral y distribución

`npm run validate` aprobó 156 tests Rust, 504 contratos Node, 7 Jest, 18 Vitest y
26 VM, más 1.784 casos HTML5 comparables. El informe
[WPT](../compatibility/2026-09-13T05-41-50.512Z-linux-wpt.json) conserva 43.708 casos
ejecutables en paridad: 42.678 aprobados por estándar y 1.030 fallos compartidos;
el bootstrap bloqueado de
Range-deleteContents y las exclusiones siguen declarados. No se equipara esa
paridad con compatibilidad completa ni con aprobación total del estándar.

El paquete `1c5bb0209641bb77ab3b17d293f810a7380bdea74038fe5e7e227dd55dbb026e`
aprobó 18 controles en [Node 24.14.1](../distribution/2026-09-13T05-44-41.933Z-linux-x64.json)
y 18 en [Node 22.12.0](../distribution/2026-09-13T05-47-03.114Z-linux-x64.json).
Ambos instalan con npm y pnpm fuera del checkout; los consumidores tipados
ejercen la API raw de caché, snapshots independientes y el DOM real en VM.
La primera invocación directa del empaquetado fue rechazada por faltar el contexto
de npm. La ejecución correcta fue `npm exec -- node scripts/package.mjs`, sin
modificar código ni reconstruir durante las pruebas.

## Rendimiento

El benchmark agrega 100 lecturas públicas de la caché sobre el mismo fixture
denso de 25/100 slots. Consume longitudes e identidades y valida todas las listas
y hashes fuera del timer. El tiempo incluye llamadas N-API y resolución de
wrappers. El [informe completo](../benchmarks/2026-09-13T05-51-12.045Z-linux-x64.json)
conserva 18 muestras por motor/caso, warmup y órdenes alternados de procesos.
La medición corrió después de terminar todos los tests, memoria y distribución,
sin otros runners locales simultáneos.

| Operación | Tamaño | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| 1.000 lecturas assignedSlot | 25 slots | 5,277 | 1,775 | 2,97× |
| 100 reasignaciones, un candidato | 25 slots | 2,478 | 1,709 | 1,45× |
| 1.000 lecturas assignedSlot | 100 slots | 14,111 | 5,339 | 2,64× |
| 100 reasignaciones, un candidato | 100 slots | 4,203 | 2,307 | 1,82× |
| 100 lecturas de caché | 25 slots | 0,075 | 0,213 | 0,35× |
| 100 consultas frescas, denso | 25 slots | 9,629 | 0,435 | 22,14× |
| 100 reasignaciones, denso | 25 slots | 18,117 | 1,999 | 9,06× |
| 100 lecturas de caché | 100 slots | 0,064 | 0,183 | 0,35× |
| 100 consultas frescas, denso | 100 slots | 103,807 | 1,088 | 95,42× |
| 100 reasignaciones, denso | 100 slots | 205,443 | 3,069 | 66,94× |
| 100 consultas de aplanado | 10 relays | 1,833 | 0,391 | 4,69× |
| 100 consultas de aplanado | 100 relays | 9,724 | 1,762 | 5,52× |

Ratio = mediana jsdom / mediana rustdom. La lectura de caché cuesta aproximadamente
2,8× frente a jsdom, aun con tiempos absolutos pequeños en este fixture; queda
pendiente reducir llamadas/copias del puente manteniendo el estado canónico en
Rust. Las demás mejoras no compensan automáticamente esa regresión en cualquier
aplicación. Son cargas sintéticas, no tiempos de suites completas ni una prueba
causal A/B contra el commit anterior.
