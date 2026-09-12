# Límites y selección de Range en Rust

Rust decide las actualizaciones de `setStart`, `setEnd`, las cuatro variantes
Before/After, `selectNode` y `selectNodeContents`. Un plan transitorio comunica
al binding los extremos y el orden de entrega. Cambiar el inicio más allá del
final actualiza primero el final; cambiar el final antes del inicio actualiza
primero el inicio. Las selecciones actualizan inicio y final en ese orden.

Los errores no modifican el Range. Tipo y offset se comprueban antes de raíces,
y se conserva la omisión de CDATA de `nodeLength` en jsdom 27.4.0. Esa decisión
de longitud se comparte con las consultas ya migradas para evitar divergencias.
El binding mantiene los distintos realms de excepciones de setters directos,
variantes relativas y selecciones. `commonAncestorContainer` alinea profundidades
en Rust, sin recursión, caches adicionales ni referencias persistentes.

La representación de Range, su `collapse` y la entrega/actualización de
referencias vivas todavía tienen responsabilidades JavaScript; esta etapa no
completa la migración integral.

Los tests focales cubren las ocho operaciones con tres estados iniciales y
29 puntos, incluyendo offsets WebIDL, surrogates, DocumentType, Attr, CDATA,
fragmentos, shadow roots y documentos diferentes. También cubren errores
entre realms, identidad del ancestro, mutaciones, adopción y conservación de
planes después de liberar los nodos. Pasaron **78 tests Rust y 13 contratos
focales Node** de límites, consultas y texto. Los fixtures WPT nuevos se
conservan intactos desde la revisión fijada en el manifiesto.

La validación completa pasó **78 tests Rust, 261 contratos Node, 7 Jest,
11 Vitest, 4 VM y 1.784 casos comparables HTML5**. El
[informe WPT completo](../compatibility/2026-09-12T09-25-03.812Z-linux-wpt.json)
registra **37.993 casos en paridad, 36.965 aserciones de estándares aprobadas
y 1.028 fallos compartidos**. Los cinco fixtures nuevos aportan 11.471 casos
y 98 fallos compartidos de offsets/longitud; no se presentan como conformidad
con el estándar.

El [Memcheck focal](../memory/2026-09-12T09-23-51Z-range-boundaries-valgrind.log)
pasó los cuatro tests de límites y ancestros, incluidos recorrido profundo y
liberación: cero errores y cero pérdidas definitivas/indirectas. Los 48 bytes
posibles y 544 alcanzables del runtime se conservan en el log, sin supresiones.
Su alcance es el ejecutable Rust y no una inspección completa de V8.

El [benchmark aislado](../benchmarks/2026-09-12T09-29-06.336Z-linux-x64.md)
registra 100 conjuntos de los ocho setters/selecciones, más identidad del
ancestro. Preparación y comprobación de extremos quedan fuera del reloj:

| Filas | jsdom | rustdom | Ratio |
| --- | ---: | ---: | ---: |
| 250 | 11,806 ms | 1,912 ms | 6,17× |
| 1.000 | 69,983 ms | 1,864 ms | 37,54× |

Las consultas Element/Text que comparten el cálculo de longitud también se
midieron: sus ratios quedan entre 1,61× y 1,94×. Se conservan todas las muestras
y metadatos; estos resultados sintéticos no equivalen a acelerar por esos
factores una suite completa.

El [estrés de memoria](../memory/2026-09-12T09-30-27.777Z-linux-x64.json)
ejercita los ocho setters/selecciones y el ancestro común antes de liberar
cada árbol. Ambos motores terminaron con cero supervivientes entre los 882
Document, 882 Window y 1.000 Range observados, conservando 1.000 strings.
Rustdom registró heap +2,06 MiB y RSS +6,79 MiB después de GC. El informe
conserva deltas y contadores; no mide memoria pico ni prueba ausencia absoluta
de todas las fugas posibles.

El [paquete instalado](../distribution/2026-09-12T09-32-37.556Z-linux-x64.json)
pasó los 18 controles npm/pnpm, con los nuevos contratos de planes/ancestros
en CommonJS y setters públicos dentro de una VM. Su SHA-256 es
`700f8cf21a53e1fd0da2b5b7e84f0b22359d850d8b945c8016d932e5268fe463`.
