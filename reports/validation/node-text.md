# Lecturas de texto de Node en Rust

`nodeValue` y el getter de `textContent` consumen los datos canónicos de Rust.
Element y DocumentFragment reúnen Text y CDATA en orden mediante un recorrido
iterativo sin una pila de handles ni referencias a wrappers. Los demás tipos
conservan su valor directo o `null`, según jsdom. Los resultados UTF-8 prestados
se copian a V8; los agregados y las unidades UTF-16 aisladas usan la transferencia
UTF-16 sin pérdida.

El recorrido sigue exclusivamente las relaciones de hijos. No cruza hacia
siblings del contexto, `template.content` ni shadow roots separados. Las lecturas
de un árbol incompleto devuelven errores sin activar reservas ni alterar el árbol.
Los setters y sus hooks actuales siguen conectados con mutaciones, rangos y
observadores; esta etapa no declara migradas esas responsabilidades.

Los tests propios cubren todos los tipos de Node, texto actualizado después de
movimientos y reemplazos, XML/CDATA, NUL, surrogates y resultados conservados
después de mutar/liberar el nodo. El estrés mantiene vivos strings devueltos de
500 clones transitorios para comprobar que no retengan el DOM. El corpus incorpora
los fixtures upstream de Node.nodeValue, Node.textContent y MutationObserver.

La validación completa pasó: formato, Clippy, **54 tests Rust, 186 contratos Node,
7 tests Jest, 11 Vitest, 4 de pools VM y 1.784 casos HTML5**. El
[informe WPT](../compatibility/2026-09-12T04-31-50.363Z-linux-wpt.json) registra
**3.525 casos en paridad, con 3.517 aserciones de estándares aprobadas**. Los
92 casos nuevos pasaron las aserciones upstream: 7 de nodeValue, 81 de textContent
y 4 de MutationObserver. Los ocho fallos compartidos preexistentes quedan visibles.

El [paquete instalado](../distribution/2026-09-12T04-35-07.688Z-linux-x64.json)
pasó los 18 controles con npm y pnpm, incluidos los métodos de texto del addon
real, tipos, CommonJS, ESM/VM, workers, Unicode, Jest y Vitest. Su SHA-256 es
`0342719b5903a79d5ed21a2b056a672e175bfd5be602706142641f6b4eb98217`.

El [estrés del DOM](../memory/2026-09-12T04-38-13.771Z-linux-x64.json) pasó en
ambos motores manteniendo vivos 500 strings devueltos. Se recolectaron los
882 Document/Window y 1.500 nodos comparados. Los nodos, datos, colecciones,
owners y holders nativos volvieron a cero; quedaron capacidad reutilizable de
112 entradas y 124 handles reservados, dentro del lote máximo de 128.
Rustdom registró heap +0,97 MiB y RSS +12,16 MiB; se conserva toda la variación.
Los strings se retienen deliberadamente y RSS también refleja páginas retenidas
por los allocators, sin identificar por sí solo una fuga ni representar memoria pico.

El [benchmark público](../benchmarks/2026-09-12T04-47-51.515Z-linux-x64.md)
midió cien lecturas completas por muestra, en cuatro procesos con orden alternado,
sin otros tests/builds en paralelo. Verifica el texto completo y consume la
longitud de cada lectura, dejando construcción y GC fuera del tiempo medido.

| Filas | jsdom | rustdom | Ratio |
| --- | ---: | ---: | ---: |
| 250 | 9,554 ms | 4,041 ms | 2,36× |
| 1.000 | 42,941 ms | 24,291 ms | 1,77× |

Es una mejora de esta operación; no representa el tiempo de una suite completa
de Jest o Vitest.

El [Memcheck completo](../memory/2026-09-12T04-48-51.941Z-valgrind.json) pasó
los **54 tests Rust en 329,99 segundos**, dentro del watchdog original de 600.
No registró errores de acceso ni pérdidas definitivas o indirectas. Los logs
conservan las asignaciones posibles/alcanzables del runtime de tests sin
supresiones. Este análisis cubre el ejecutable de tests Rust; las pruebas de
GC anteriores ejercen adicionalmente el addon real y sus resultados en V8.

## Integración de las fases anteriores

La unión con namespaces y `2f128fe193c2e0678956c87ba5e5da96a6996a54` pasó
**57 tests Rust, 198 contratos Node, 7 Jest, 11 Vitest, 4 VM y 1.784 casos HTML5**.
Los [3.525 WPT](../compatibility/2026-09-12T05-22-55.882Z-linux-wpt.json) mantienen
paridad. El PR base sigue corrigiendo las transiciones implícitas de atributos
detectadas por su revisión posterior; esta validación no cierra ese hallazgo.

## Copia directa de buffers

El agregado copia ahora los buffers UTF-16 por slices y reutiliza los enlaces
ya leídos al comenzar el ascenso. Conserva el fallback UTF-8 y el mismo orden,
sin agregar caches ni referencias persistentes. Pasaron Clippy, **57 tests Rust**,
los tres contratos públicos y los [92 WPT de texto](../compatibility/2026-09-12T05-27-13.602Z-linux-wpt.json).

El [benchmark posterior](../benchmarks/2026-09-12T05-43-20.255Z-linux-x64.md)
midió **3,561 ms** para 250 filas y **21,015 ms** para 1.000: aproximadamente
12 % y 13 % menos que el baseline Rust anterior. jsdom midió 10,709 ms y
43,873 ms; los ratios de esa ejecución son **3,01× y 2,09×**. Las muestras y
la variación del oráculo quedan visibles; no se compara el tiempo de suites.

El [estrés posterior](../memory/2026-09-12T05-29-11.679Z-linux-x64.json) pasó
con 500 strings retenidos y cero supervivientes entre 882 Document/Window y
1.500 nodos comparados. Rustdom registró heap +0,97 MiB y RSS +12,81 MiB.
El [Memcheck focal](../memory/2026-09-12T05-32-45Z-text-slices-valgrind.log)
pasó las tres pruebas de texto sin errores, pérdidas definitivas/indirectas ni
supresiones. Permanecen los 48 bytes posibles y 544 alcanzables del runtime.
El ejecutable fue `9982e6bcc3a7960219fd5d52c6ffbd5a75d71ba2e6c0254177782be6f29bbe88`
(SHA-256); no se presenta ese análisis focal como repetición de Memcheck completo.

## Unión final con los guards completos

La unión con namespaces y `21817575405bfe642f640134884bcc7597a5f191` pasó
**62 tests Rust, 240 contratos Node, 7 Jest, 11 Vitest, 4 VM y 1.784 casos HTML5**.
Los [3.525 WPT](../compatibility/2026-09-12T06-19-47.177Z-linux-wpt.json) mantienen
paridad, con los 92 casos de texto aprobados. Los fixes de atributos y las
comparaciones ya están en main, con sus checkpoints10 y11 y revisiones limpias.

El [estrés de la unión final](../memory/2026-09-12T06-22-18.022Z-linux-x64.json)
pasó en ambos motores con los 500 strings retenidos deliberadamente. Se
recolectaron 882 Document/Window y 1.500 nodos comparados; los registros nativos
de nodos, datos, colecciones, owners y holders volvieron a cero. Rustdom
registró heap +0,97 MiB y RSS +11,08 MiB, conservados en el informe.
