# Registro y selección nativos de MutationObserver

Rust normaliza las opciones, valida sus combinaciones, mantiene las
inscripciones por nodo y selecciona observadores recorriendo los padres
actuales. Conserva el orden del primer match y combina solicitudes de oldValue
del mismo observador en varios ancestros. Los IDs de creación son monotónicos;
la entrega JavaScript todavía usa esos IDs para ordenar callbacks.

Se mantienen diferencias verificadas del jsdom fijado: attributeFilter admite
coincidencia por nombre o namespace, y los errores de observe tras convertir
la entrada son TypeError del host. La conversión WebIDL se completa antes de
decidir en Rust, incluidos efectos de getters. Las opciones inválidas conservan
la inscripción anterior. El recorrido termina en raíces de árbol y no atraviesa
hosts de shadow roots.

El constructor y las colas de registros/callbacks conservan su puente JS. Las
inscripciones y las opciones canónicas residen en Rust, sin referencias V8.
Los nodos mantienen referencias fuertes a sus observadores; el índice inverso
contiene IDs y se limpia al finalizar nodos u observadores en cualquier orden.
Los resultados raw no retienen el árbol ni sus objetos JavaScript.

## Retención detectada y corregida

El [estándar DOM](https://dom.spec.whatwg.org/#interface-mutationobserver)
define referencias débiles a los nodos observados. El jsdom fijado conserva
una lista fuerte, que tampoco vacía al desconectar. La
[medición de referencia](../memory/2026-09-13T10-06-57.317Z-observer-registration-jsdom.json)
retuvo el nodo con un observador vivo tanto desconectado como activo. La
[primera integración](../memory/2026-09-13T10-07-09.288Z-observer-registration-rustdom.json)
reprodujo esa retención al conservar la lista JS.

El registro nativo permite retirar esa lista fuerte. La limpieza de disconnect
resuelve las referencias débiles que siguen vivas; un nodo ya recolectado no
conserva una referencia que deba eliminarse. No se agregan listas de WeakRef que
puedan acumular entradas expiradas. Las tablas nativas se compactan y vacían al
liberar sus miembros.

La [muestra intermedia](../memory/2026-09-13T10-09-51.810Z-observer-registration-rustdom.json)
ya tenía cero nodos retenidos, pero el control no alcanzaba su endpoint porque
proporcionaba estadísticas nativas sin un baseline mientras retenía
deliberadamente el observador. Se corrigió la configuración de ese control:
primero se exige la liberación del target, después se comprueban por separado
el observador vivo y las inscripciones vacías, y finalmente se exige el baseline
completo al soltar el observador. No se relajó la aserción de liberación de nodos.

El [control corregido](../memory/2026-09-13T10-13-31.050Z-observer-registration-rustdom.json)
aprobó ambos casos: un observador vivo, cero targets e inscripciones, seguido
de liberación completa. Document y Window se observan por separado: mientras
el observador vive permanece su realm; al soltarlo ambos se recolectan junto
con el estado nativo. Se registra una mejora de retención frente a la referencia,
no una promesa de reproducir su grafo interno ni una prueba absoluta de cero fugas.

## Contratos

Cinco tests Rust cubren opciones presentes con false, errores atómicos sin
activar reservas, combinación de matches, cambios de topología, filtros UTF-16,
IDs inválidos, agotamiento y limpieza de 512 parejas en ambos órdenes con
capacidades finales en cero. Los diez contratos públicos de base pasaron en
ambos motores antes de reemplazar el recorrido. Los contratos raw y GC elevan
el archivo a doce tests; junto con MutationRecord y señales pasaron 25 tests
reales después de retirar la retención.

La suite Rust completa aprobó 177 tests y Clippy sin warnings. Memcheck aprobó
los cinco tests del registro, sin errores ni pérdidas definitivas o indirectas.
El [log completo](../memory/2026-09-13T10-23-43.868Z-observer-registration-valgrind.log)
preserva 48 bytes posibles y 544 alcanzables de std/libtest, sin supresiones,
junto con la salida de tests y el hash del ejecutable.

Las colas por observador, el ordenamiento del lote activo, la programación y
la invocación de callbacks todavía tienen trabajo de migración. Esta etapa no
completa MutationObserver, eventos ni la compatibilidad integral.

## Validación integral y rendimiento

La validación integral aprobó 177 tests Rust, 541 Node, 7 Jest, 18 Vitest y 26 VM,
además de 1.784 casos HTML5 comparables. El
[WPT](../compatibility/2026-09-13T10-24-27.783Z-linux-wpt.json) conserva 43.708 casos
en paridad, 42.678 aprobados por estándar y 1.030 fallos compartidos. Permanecen
las exclusiones y el bootstrap de Range-deleteContents bloqueado; no acreditan
compatibilidad completa.

El [benchmark aislado](../benchmarks/2026-09-13T10-32-54.105Z-linux-x64.json)
conserva 18 muestras por motor/caso y órdenes alternados. El caso de ancestros
registra el mismo observador en todos los ancestros y el target, ejecuta 100
grupos de tres mutaciones y exige exactamente 300 registros, verificando todos
sus campos e identidades. Mide mutaciones completas y takeRecords; preparación,
callbacks, validación y limpieza están fuera del timer.

| Operación | Tamaño | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| Mutaciones y recolección | 100 grupos | 1,526 | 3,894 | 0,39× |
| Lectura de registros | 100 grupos | 1,339 | 2,320 | 0,58× |
| Mutaciones y recolección | 1.000 grupos | 8,907 | 33,288 | 0,27× |
| Lectura de registros | 1.000 grupos | 11,866 | 22,520 | 0,53× |
| Mutaciones con registros en ancestros | 100 ancestros | 7,922 | 7,505 | 1,06× |
| Mutaciones con registros en ancestros | 1.000 ancestros | 60,860 | 45,985 | 1,32× |

Ratio = mediana jsdom / mediana rustdom. Hay ventaja en el caso profundo, pero
la creación/recolección común conserva un costo de 2,6–3,7 veces y la lectura
de 1,7–1,9 veces. El benchmark anterior de MutationRecord se conserva como otra
ejecución, no como un experimento causal pareado. Quedan transferencias y otros
drivers que optimizar; no se presenta esta etapa como una mejora universal.

El [estrés de cinco modos](../memory/2026-09-13T10-39-23.313Z-linux-x64.json)
aprobó jsdom, rustdom, native, Vitest y Vitest VM. Rustdom liberó 1.322 documentos
y 882 ventanas; los dos modos Vitest liberaron 1.320 documentos y 880 ventanas
cada uno. Heap/RSS retenido tras warmup y GC: 2,80/16,72 MiB en rustdom,
4,04/26,12 MiB en Vitest y 3,67/26,04 MiB en VM. Los contadores de observadores,
nodos observados e inscripciones retornaron al baseline. Son pruebas finitas
de retención, no una medición de memoria pico ni una garantía absoluta.

El paquete
`565952d71e12cbd414a698197df3c20c249ba8ff27c60b374cfeee5f43c27a36`
aprobó 18 controles en [Node 24.14.1](../distribution/2026-09-13T10-39-10.370Z-linux-x64.json)
y 18 en [Node 22.12.0](../distribution/2026-09-13T10-41-32.796Z-linux-x64.json).
Los consumidores instalados con npm y pnpm ejercen registro raw, normalización,
selección, desconexión, estadísticas y el registro público en VM, además de
tipos CJS/ESM, assets y los runners reales. El manifiesto incluye el nuevo
mutation-observer.cjs; los tipos de ObservationStatus reflejan su export nativo
sin prometer índices inversos.

El [control final de ownership](../memory/2026-09-13T10-47-55.180Z-observer-registration-rustdom.json)
agrega el sentido inverso: un target vivo conserva al observador aun sin una
referencia externa a este, y entrega un callback real después de forzar GC.
Al soltar el target se liberan observador, Document, Window y registro nativo.
Los doce contratos del archivo volvieron a aprobar tras ampliar únicamente
esa prueba; el runtime y el paquete ya validados no cambiaron.
