# Wrappers nativos compartidos de MutationRecord

La estructura existente permite compartir también el wrapper N-API de un
payload inmutable. NativeTree.prepareMutationRecordBatch devuelve IDs de
observadores, índices de payload y como máximo dos wrappers nativos por
mutación. El binding DOM conserva un MutationRecord y sus NodeLists propios
para cada observador; únicamente referencia el payload nativo compartido.

No se agregó una arena nueva ni un registro adicional de finalización. Los
owners V8 existentes mantienen los nodos y el wrapper nativo se recolecta al
quedar sin referencias. Los datos y algoritmos canónicos siguen en Rust.
prepareMutationRecords conserva su API raw anterior con wrappers independientes.

## Contratos y memoria

El test Rust verifica correspondencia, orden e índices de los payloads únicos.
Los contratos raw verifican que el batch use dos wrappers, mientras la API
anterior siga devolviendo cuatro wrappers distintos. Los escenarios públicos
ejercen jsdom y rustdom y conservan identidad independiente de MutationRecord,
oldValue por observador y NodeList SameObject por registro.

El [control de cinco ciclos](../memory/2026-09-13T14-08-08.122Z-shared-mutation-bindings.json)
retiene cuatro registros públicos y observa dos wrappers nativos. Al conservar
solo uno, sus pares se recolectan, incluso el que compartía el payload. El
último registro mantiene su nodo hasta soltarse; después se liberan documento,
ventana y todos los contadores. Los siete contratos focales de compartición
y productor aprobaron con este control. Es evidencia finita, no una prueba
absoluta de ausencia de fugas.

Memcheck aprobó los siete tests de preparación y snapshots sin errores ni
pérdidas definitivas o indirectas. El [log completo](../memory/2026-09-13T14-12-14.434Z-shared-mutation-bindings-valgrind.log)
conserva 48 bytes posibles y 544 alcanzables de std/libtest, sin supresiones,
junto con la salida de tests y el hash del ejecutable.

El [estrés de cinco modos](../memory/2026-09-13T14-14-41.083Z-linux-x64.json)
aprobó jsdom, rustdom, native, Vitest y Vitest VM. Rustdom liberó los 1.322
documentos y 882 ventanas observados; ambos modos Vitest liberaron 1.320
documentos y 880 ventanas. Heap/RSS retenido tras warmup y GC: 2,75/19,75 MiB
rustdom, 4,03/25,70 MiB Vitest y 3,67/26,65 MiB VM. Todos los contadores
retornaron al baseline; no se mide memoria pico.

El paquete
`db9ffb024f13340573bfb97cf7cf589bc883d1594f13115cc8f3ff964590e285`
aprobó 18 controles en [Node 24.14.1](../distribution/2026-09-13T14-14-39.098Z-linux-x64.json)
y 18 en [Node 22.12.0](../distribution/2026-09-13T14-17-12.455Z-linux-x64.json).
Los consumidores npm/pnpm comprueban el batch compartido, las APIs raw previas,
los registros públicos de VM, tipos, assets y runners reales.

La validación integral aprobó 191 tests Rust, 571 Node, 7 Jest, 18 Vitest y 26 VM,
además de 1.784 casos HTML5 comparables. El
[WPT](../compatibility/2026-09-13T14-18-18.439Z-linux-wpt.json) conserva 43.708 casos
en paridad, 42.678 aprobados por estándar y 1.030 fallos compartidos. Las
exclusiones y el bootstrap de Range-deleteContents bloqueado siguen explícitos;
no se presenta esa evidencia como compatibilidad integral.

## Métricas y rendimiento

mutationRecords continúa contando wrappers nativos, no objetos MutationRecord
públicos. El benchmark mantiene el recuento completo de registros públicos y
verifica por separado el mínimo esperado de payloads nativos. En fanout, la
primera mutación tiene oldValue nulo compartido y las siguientes tienen dos
variantes; las aserciones de campos, identidad y resultado no se reducen.

La alternativa de handles/arena quedó descartada antes de implementarse porque
la compartición del wrapper existente cubre el costo identificado con menos
estado de lifetime. La decisión se evaluó con el camino completo descrito abajo.

La [comparación aislada](../benchmarks/2026-09-13T14-25-05.881Z-linux-x64.json)
conserva 18 muestras por motor/caso, órdenes alternados y todas las verificaciones
de resultados fuera del timer.

| Operación | Tamaño | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| Productor con múltiples observers | 100 observers | 1,087 | 2,322 | 0,47× |
| Productor con múltiples observers | 1.000 observers | 5,247 | 19,041 | 0,28× |
| Mutaciones y recolección | 100 grupos | 1,442 | 3,574 | 0,40× |
| Mutaciones y recolección | 1.000 grupos | 8,219 | 34,943 | 0,24× |
| Lectura de registros | 100 grupos | 1,421 | 2,295 | 0,62× |
| Lectura de registros | 1.000 grupos | 11,321 | 22,695 | 0,50× |
| Registros en ancestros | 100 ancestros | 8,188 | 8,430 | 0,97× |
| Registros en ancestros | 1.000 ancestros | 64,158 | 44,442 | 1,44× |
| Ráfaga de señales | 100 slots | 6,960 | 5,121 | 1,36× |
| Ráfaga de señales | 1.000 slots | 319,847 | 223,047 | 1,43× |
| Entrega con registros | 100 observers | 0,266 | 0,210 | 1,27× |
| Entrega con registros | 1.000 observers | 12,349 | 1,813 | 6,81× |
| Colas vaciadas y sentinel | 100 observers | 0,250 | 0,039 | 6,48× |
| Colas vaciadas y sentinel | 1.000 observers | 12,124 | 0,079 | 153,51× |
| Entrega combinada | 100 slots | 0,540 | 0,981 | 0,55× |
| Entrega combinada | 1.000 slots | 4,066 | 8,634 | 0,47× |

Ratio = mediana jsdom / mediana rustdom. En la ejecución anterior, fanout de
1.000 observadores medía 32,703 ms en rustdom; esta registra 19,041 ms. La
creación/recolección grande pasó de 36,438 a 34,943 ms. Son corridas separadas,
no un experimento causal aislado. Permanecen costos de 2,1–3,6 veces en fanout,
2,5–4,3 veces en creación común y 1,8–2,1 veces en entrega de slots. No se
presenta una aceleración universal ni se omiten esas regresiones.
