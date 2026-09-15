# Preparación nativa de MutationRecord

La selección y preparación de payloads se ejecutan en una llamada nativa.
Rust produce los registros en orden de primer match y comparte como máximo
dos snapshots inmutables por mutación, diferenciados únicamente por oldValue.
La preparación no encola: el bridge crea cada wrapper real y confirma su
encolado en el orden original. Si una factory falla, se conserva el prefijo
confirmado y no se adelanta el pedido final de microtask.

Los strings JS se toman prestados solo durante la llamada N-API. oldValue se
copia únicamente si algún observer seleccionado lo solicita. Los resultados
contienen datos Rust propios, sin handles JS ni referencias al árbol. La
longitud UTF-16 explícita excluye el terminador del buffer de N-API y preserva
NUL finales reales, surrogates aislados, null y cadenas vacías. El bridge
comparte un array de owners entre registros de la misma mutación.

## Evidencia CPU

El [perfil previo](../benchmarks/2026-09-13T13-02-45.493Z-mutation-producer-analysis.json)
usa 20 batches de 1.000 grupos de atributo, Text y append, con setup y warmup
previos. queueMutationRecord representa 48,46% inclusivo; createMutationRecord,
24,31%; selección, 9,88%; encolado, 3,89%. Los totales inclusivos se superponen.
La etiqueta NativeTree sin URL agrupa trabajo en el borde N-API; no demuestra
que se estuvieran construyendo árboles durante la medición.

El [perfil posterior](../benchmarks/2026-09-13T13-26-59.089Z-mutation-producer-analysis.json)
desplaza el costo a produceMutationRecords, con 46,91% inclusivo. El productor
completo queda en 49,93%. El total muestreado es similar, 730,8 frente a 736,2 ms,
e incluye aproximadamente 10% de overhead de Inspector; no acredita una mejora
general ni es una comparación de tiempo sin profiler. Se guardan los perfiles
crudos, metadatos, hashes, script reproducible y analizador.

## Contratos y memoria

Tres tests Rust verifican orden, variantes compartidas, oldValue, snapshots
tras liberar nodos y errores sin producir registros ni consumir reservas.
Los tests raw verifican preparación sin enqueue, identidad independiente de
wrappers, getters no mutables y preservación exacta de UTF-16/NUL/null.

Un test del borde propio usa las factories WebIDL reales y hace fallar la
segunda invocación: el primer observer conserva su registro y los siguientes
no reciben ninguno. El scheduler mantiene el punto original. No se mockean
las bibliotecas de plataforma.

El [control de cinco ciclos](../memory/2026-09-13T13-25-20.264Z-mutation-production.json)
recolecta el árbol mientras conserva registros preparados. Al retener solo
uno, los otros wrappers se recolectan aunque compartan su payload; al soltarlo,
los contadores vuelven al baseline. Los 25 contratos focales de productor,
records, colas y entrega aprobaron. La prueba finita no demuestra cero fugas
en todos los escenarios.

Memcheck aprobó los seis tests de preparación y snapshots sin errores ni
pérdidas definitivas o indirectas. El [log](../memory/2026-09-13T13-35-04.416Z-mutation-production-valgrind.log)
conserva 48 bytes posibles y 544 alcanzables de std/libtest, sin supresiones,
junto con la salida de tests y el hash del ejecutable.

La validación integral aprobó 190 tests Rust, 567 Node, 7 Jest, 18 Vitest y 26 VM,
además de 1.784 casos HTML5 comparables. El
[WPT](../compatibility/2026-09-13T13-34-23.228Z-linux-wpt.json) conserva 43.708 casos
en paridad, 42.678 aprobados por estándar y 1.030 fallos compartidos. Se mantienen
las exclusiones y el bootstrap de Range-deleteContents bloqueado; no acreditan
compatibilidad integral.

El [estrés de cinco modos](../memory/2026-09-13T13-37-01.607Z-linux-x64.json)
aprobó jsdom, rustdom, native, Vitest y Vitest VM. Rustdom liberó 1.322 documentos
y 882 ventanas; ambos modos Vitest liberaron 1.320 documentos y 880 ventanas.
Heap/RSS retenido tras warmup y GC: 2,77/19,25 MiB rustdom, 4,04/27,18 MiB
Vitest y 3,66/26,94 MiB VM. Los contadores retornaron al baseline; no es memoria
pico ni una prueba absoluta de ausencia de fugas.

El paquete
`037ab2a77096dd8aa67341c358ebb165731d3fd489749b7001fefae3ab7eee5b`
aprobó 18 controles en [Node 24.14.1](../distribution/2026-09-13T13-36-42.168Z-linux-x64.json)
y 18 en [Node 22.12.0](../distribution/2026-09-13T13-39-07.050Z-linux-x64.json).
Los consumidores npm/pnpm verifican preparación raw sin enqueue, UTF-16/NUL,
variantes públicas con y sin oldValue, identidad, tipos y runners reales.

## Alcance

Las factories WebIDL y la confirmación de cada enqueue siguen en el bridge.
No se afirma una aceleración universal; los resultados sin profiler de abajo
conservan los costos pendientes y las otras familias del objetivo siguen abiertas.

## Benchmark sin profiler

La [comparación aislada](../benchmarks/2026-09-13T13-45-08.888Z-linux-x64.json)
conserva 18 muestras por motor/caso, órdenes alternados y verificación de todos
los campos, identidades, recuentos y hashes fuera del timer. Fanout usa diez
mutaciones de atributo y 100/1.000 observadores con oldValue alternado, produciendo
1.000/10.000 registros distintos; incluye preparación, wrappers y takeRecords.

| Operación | Tamaño | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| Mutaciones y recolección | 100 grupos | 1,529 | 4,317 | 0,35× |
| Mutaciones y recolección | 1.000 grupos | 8,418 | 36,438 | 0,23× |
| Lectura de registros | 100 grupos | 1,561 | 2,602 | 0,60× |
| Lectura de registros | 1.000 grupos | 12,413 | 23,379 | 0,53× |
| Productor con múltiples observers | 100 observers | 1,250 | 3,633 | 0,34× |
| Productor con múltiples observers | 1.000 observers | 5,793 | 32,703 | 0,18× |
| Registros en ancestros | 100 ancestros | 8,344 | 8,480 | 0,98× |
| Registros en ancestros | 1.000 ancestros | 66,695 | 46,538 | 1,43× |
| Ráfaga de señales | 100 slots | 7,169 | 5,996 | 1,20× |
| Ráfaga de señales | 1.000 slots | 338,941 | 239,144 | 1,42× |
| Entrega con registros | 100 observers | 0,284 | 0,233 | 1,22× |
| Entrega con registros | 1.000 observers | 12,542 | 1,933 | 6,49× |
| Colas vaciadas y sentinel | 100 observers | 0,258 | 0,041 | 6,24× |
| Colas vaciadas y sentinel | 1.000 observers | 12,761 | 0,090 | 141,63× |
| Entrega combinada | 100 slots | 0,593 | 1,103 | 0,54× |
| Entrega combinada | 1.000 slots | 4,469 | 9,751 | 0,46× |

Ratio = mediana jsdom / mediana rustdom. La preparación compartida no elimina
el costo de wrappers y cruces: fanout conserva un costo de 2,9–5,6 veces frente
a jsdom. La creación/recolección grande pasó de 38,663 ms en la ejecución previa
a 36,438 ms, pero son corridas separadas y no acreditan causalidad. Los perfiles
tampoco prueban mejora global. Se mantiene explícita la necesidad de optimizar
representación y bindings sin regresar algoritmos a JavaScript.
