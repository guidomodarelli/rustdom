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
