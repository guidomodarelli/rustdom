# Backlinks nativos de slots y padre de eventos

Rust guarda el último backlink registrado por cada Element/Text/CDATA, separado
de las listas cacheadas de cada slot. Remover o renombrar un nodo no limpia ese
estado: el getter público puede devolver null y la caché estar vacía mientras
el camino de eventos sigue pasando por el slot anterior. Esa distinción se
verificó contra jsdom 27.4.0 antes de migrar el campo.

Node consulta el backlink y su padre ordinario mediante una sola operación
nativa para `_getTheParent`. Los overrides de Document y ShadowRoot, la entrega
de eventos, señales y las etapas del driver de asignación permanecen en JS.
Los accessors internos solo transfieren identidad; su espejo de referencias V8
mantiene el ownership necesario y no se consulta para decidir resultados.

## Contratos y memoria

Cuatro tests Rust cubren independencia de topología/nombres/caché, errores
atómicos, metadata incompatible, CDATA, reemplazo, miembros compartidos,
autorreferencias raw y finalización en ambos órdenes. Dos picos de 1.000 enlaces
comprueban compactación de mapas y conjuntos inversos mientras todos los nodos
siguen vivos, hasta llegar a cero después de limpiar el último enlace.

Los ocho contratos Node prueban Element/Text/CDATA en roots abiertos y cerrados,
remoción, cambio de nombre, adopción y reasignación, API raw y GC real.
El primer intento del fixture CDATA suponía una actualización inmediata al
insertarlo; la referencia mostró que su guard de inserción no lo trata como
slotable. La prueba conserva esa caché inicial vacía y luego cambia el nombre
del slot para ejercer una actualización real. No se alteró producción ni se
debilitaron las comparaciones contra el motor independiente.

El [control focal de memoria](../memory/2026-09-13T06-11-37.952Z-slot-backlinks.json)
usa cinco ciclos. El nodo se construye en el segundo realm y se asigna a un slot
del primero, para que su constructor no retenga por sí solo la primera ventana.
Tras adoptarlo de vuelta, su backlink todavía conserva el primer árbol. Reasignarlo
a un nuevo slot permite recolectar Document, Window y nodos del primer árbol;
soltar el nodo libera también el segundo y devuelve las capacidades al baseline.
Los endpoints se observan con GC asíncrono y weak refs, sin retener targets en
las muestras. Son escenarios finitos, no prueba absoluta de ausencia de fugas.

Memcheck aprobó 22 tests de slots/backlinks con cero errores y cero pérdidas
definitivas o indirectas. El
[log completo](../memory/2026-09-13T06-15-34.308Z-slot-backlinks-valgrind.log)
conserva también 48 bytes posibles y 544 alcanzables de std/libtest, sin
supresiones. Se guardan la salida de tests y el hash del ejecutable; este control
analiza Rust, mientras los tests Node comprueban el addon y sus owners V8.

El [estrés de cinco modos](../memory/2026-09-13T06-20-42.500Z-linux-x64.json)
aprobó jsdom, rustdom, native, Vitest y Vitest VM. Rustdom liberó 1.322 documentos
y 882 ventanas; cada Vitest liberó 1.320 documentos y 880 ventanas. El heap/RSS
retenido fue 2,76/17,42 MiB en rustdom, 4,05/74,33 MiB en Vitest y 3,66/28,42 MiB
en VM. Son mediciones del proceso después de warmup, teardown y GC, no memoria
pico ni cantidades totales de allocations.

## Validación integral, distribución y rendimiento

La validación integral aprobó 160 tests Rust, 512 contratos Node, 7 Jest,
18 Vitest y 26 VM, más 1.784 casos HTML5 comparables con 8 script-on excluidos.
El [WPT](../compatibility/2026-09-13T06-19-18.325Z-linux-wpt.json) conserva 43.708
casos ejecutables en paridad: 42.678 aprobados por estándar y 1.030 fallos
compartidos. Las exclusiones y el bootstrap bloqueado de
Range-deleteContents siguen explícitos. La migración y compatibilidad integrales
continúan abiertas.

El paquete `9bebbed57992e0a5d201d49ca9258b251fc46e73e4a1c42f616f32d554ec728a`
aprobó 18 controles en [Node 24.14.1](../distribution/2026-09-13T06-19-35.495Z-linux-x64.json)
y 18 en [Node 22.12.0](../distribution/2026-09-13T06-22-01.859Z-linux-x64.json),
con npm/pnpm fuera del checkout. Los consumidores tipados comprueban raw
backlinks y eventParent, y un camino de eventos real en VM cuyo getter público
ya no devuelve el slot anterior.

El nuevo benchmark de eventos usa el fixture denso de slots:
crea y despacha 100 eventos, comprueba target y camino en el listener, valida
conteos exactos y hashes fuera del timer y retira listeners antes de medir GC.

El [informe completo](../benchmarks/2026-09-13T06-26-53.843Z-linux-x64.json)
conserva 18 muestras por motor/caso y órdenes alternados. Corrió después de
terminar todos los runners locales de tests, distribución y memoria.

| Operación | Tamaño | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| 100 eventos con retargeting | 10 roots | 14,975 | 10,690 | 1,40× |
| 100 eventos con retargeting | 30 roots | 180,096 | 30,505 | 5,90× |
| 1.000 lecturas assignedSlot | 25 slots | 4,847 | 1,888 | 2,57× |
| 100 reasignaciones, un candidato | 25 slots | 2,004 | 1,796 | 1,12× |
| 1.000 lecturas assignedSlot | 100 slots | 13,261 | 5,437 | 2,44× |
| 100 reasignaciones, un candidato | 100 slots | 4,215 | 2,372 | 1,78× |
| 100 lecturas de caché | 25 slots | 0,081 | 0,209 | 0,39× |
| 100 consultas frescas, denso | 25 slots | 8,467 | 0,470 | 18,03× |
| 100 reasignaciones, denso | 25 slots | 17,618 | 2,274 | 7,75× |
| 100 eventos por slots | 25 slots | 1,773 | 2,872 | 0,62× |
| 100 lecturas de caché | 100 slots | 0,061 | 0,187 | 0,33× |
| 100 consultas frescas, denso | 100 slots | 100,672 | 1,025 | 98,22× |
| 100 reasignaciones, denso | 100 slots | 198,175 | 3,498 | 56,65× |
| 100 eventos por slots | 100 slots | 1,465 | 2,592 | 0,57× |
| 100 consultas de aplanado | 10 relays | 1,691 | 0,391 | 4,32× |
| 100 consultas de aplanado | 100 relays | 7,474 | 1,724 | 4,34× |

Ratio = mediana jsdom / mediana rustdom. Persisten regresiones de lectura de caché
(0,33–0,39×) y eventos por slots (0,57–0,62×). Las mejoras de consultas densas y
retargeting no garantizan acelerar una suite completa. La siguiente optimización
de eventos debe reducir cruces del puente al migrar su camino completo, manteniendo
la semántica de callbacks y sin devolver el estado canónico a JavaScript. No es
una comparación causal A/B contra el checkpoint anterior.
