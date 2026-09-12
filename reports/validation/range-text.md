# Stringifier de Range en Rust

`Range.toString()` ahora reúne el texto seleccionado mediante un recorrido
iterativo del árbol Rust. Conserva las porciones parciales de los extremos,
unidades UTF-16 aisladas y la exclusión de CDATA, Comment y ProcessingInstruction
del jsdom 27.4.0 fijado como referencia. No atraviesa hacia fragmentos de template
ni shadow roots separados. El binding copia el resultado a V8; no se agregan
caches ni referencias persistentes a nodos o rangos.

Los setters, el estado y otras mutaciones de Range todavía tienen implementación
JavaScript y continúan pendientes en la migración integral.

Pasaron formato, Clippy, **74 tests Rust, 256 contratos Node, 7 Jest, 11 Vitest,
4 VM y 1.784 casos comparables HTML5**. Las pruebas focales incluyen una matriz
de extremos públicos, cambios posteriores y conservación del string después
de mutar/liberar sus nodos. El
[informe WPT completo](../compatibility/2026-09-12T08-43-40.103Z-linux-wpt.json)
registra **26.522 casos en paridad, 25.592 aserciones de estándares aprobadas
y 930 fallos compartidos**; el nuevo fixture upstream aporta cinco casos.

El [benchmark inicial de diez lecturas](../benchmarks/2026-09-12T08-52-12.649Z-linux-x64.md)
conserva 18 muestras en dos procesos por motor y tamaño, con tres warmups por
proceso y preparación/validación fuera del reloj:

| Filas | jsdom, diez lecturas | rustdom, diez lecturas | Ratio |
| --- | ---: | ---: | ---: |
| 250 | 630,458 ms | 1,506 ms | 418,68× |
| 1.000 | 14.093,829 ms | 6,637 ms | 2.123,44× |

La referencia recorre repetidamente los nodos siguientes para comparar puntos.
Los ratios describen únicamente este patrón sintético; no representan una
mejora del tiempo total de cualquier suite. Para acotar el costo del benchmark
completo en CI, la carga habitual hace una lectura por muestra. La variante
de diez lecturas sigue disponible explícitamente como `range-stringify-10`.
Se conservan ambos escenarios sin descartar las muestras iniciales.

El [benchmark completo de CI](../benchmarks/2026-09-12T09-01-30.401Z-linux-x64.md)
terminó con los timeouts originales. Para una lectura de Range, las medianas
fueron 69,619/0,379 ms (jsdom/rustdom) en 250 filas y 1.542,098/1,420 ms en
1.000 filas. La variante de diez lecturas amortiza trabajo de la primera
consulta; sus ratios no son intercambiables con los de una sola lectura.
El informe completo conserva también las cargas donde rustdom sigue más
lento, como construcción, mutaciones, atributos, namespaces y normalización.

El [estrés de memoria](../memory/2026-09-12T08-52-56.119Z-linux-x64.json) pasó
en ambos motores: 882 Document, 882 Window y 1.000 Range observados sin
supervivientes, mientras se retienen 1.000 resultados de texto. Rustdom terminó
con nodos/datos nativos en cero, heap +2,01 MiB y RSS +7,98 MiB tras GC.
Estos deltas no representan memoria pico ni prueban ausencia absoluta de fugas.

El [Memcheck focal](../memory/2026-09-12T08-54-00Z-range-text-valgrind.log)
pasó los tres tests Rust del stringifier: cero errores y cero bytes perdidos
definitiva o indirectamente. Los 48 bytes posibles y 544 alcanzables del
runtime permanecen visibles, sin supresiones. Su alcance es el ejecutable Rust,
no V8 ni el addon cargado por Node.

El [paquete instalado](../distribution/2026-09-12T08-55-22.759Z-linux-x64.json)
pasó los 18 controles npm/pnpm, incluidos consumidores CJS/ESM, tipos, workers,
Jest, Vitest y pools VM. Su SHA-256 es
`f6cc4798c54a9a80b59dba9b9d4d39d7408f2bc70cefa762babea2810007ebdb`.

El [seguimiento de review](range-text-review/README.md) agrega una regresión
sobre extremos internos desconectados y aclara cuándo la API de bajo nivel
devuelve null. Conserva los cortocircuitos del jsdom original; no cambia el
algoritmo, los benchmarks ni el análisis de memoria de producción.
