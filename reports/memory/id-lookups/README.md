# Memoria del índice de IDs y consultas SVG

El registro Rust guarda IDs numéricos y keys UTF-16 compartidas por Arc.
No posee wrappers V8 ni referencias JS. Un índice reverso permite liberar
todos los aliases al destruir Element o Document. Al vaciar registros se
liberan los mapas y los buckets; los cambios reutilizan las estructuras
intermedias dentro de una transacción. Los resultados públicos conservan
los owners existentes y la identidad original.

Cada Node 22.12.0/24.14.1 pasó 62 escenarios nuevos, sobre jsdom y rustdom
en default/VM, junto con los 78 anteriores de fragmentos y 52 de colecciones.
Se observan por separado Window, Document, roots y Elements. Los lotes usan
12 ventanas, 24 miembros y 40 cambios, warmup y tres ciclos medidos; los roots
se colocan en head para que close no borre anticipadamente el fixture.

Se prueban cierre/creación repetidos, resultados y owners retenidos, remoción,
IDs numéricos sin wrappers, aliases y compactación tras 512 cambios de un
atributo id extranjero sin prefijo. Con el documento vivo queda una entrada
al final de ese churn; al quitar el atributo quedan cero entradas y capacidad
del índice de nombres. No se confunde capacidad del allocator con fuga.

Una diferencia deliberada de retención privada: jsdom puede mantener un
Element SVG/extranjero removido por el alias en _ids. El índice numérico
permite recolectarlo. En HTML, window.alias puede exponer públicamente ese
Element: ambos motores deben conservarlo mientras Window siga vivo.
Las pruebas separan ambos casos y verifican la liberación completa cuando
se sueltan los owners. No se usa close como sustituto de observar GC.

Todos los endpoints finales recuperaron cero supervivientes y los contadores
nativos de vida útil del baseline. Se conservan trazas de GC, heap, external,
ArrayBuffer y RSS. Son observaciones finitas de estos escenarios; no prueban
ausencia absoluta de fugas ni representan memoria pico.

Memcheck ejecutó los 299 tests Rust en diez lotes, con cero errores y cero
bytes definitivamente o indirectamente perdidos. Se compara con 291 tests
del checkpoint 63. Los residuos posibles y alcanzables del harness/stdlib
permanecen visibles, con sus stacks, sin ampliar supresiones. La distribución
de tests por lote cambia: sus duraciones no son benchmarks equivalentes.

- [Evidencia y archivos crudos](../../validation/id-lookups/evidence.json).
- [Comparación Memcheck](../../validation/id-lookups/native-memory-baseline-comparison.json).
- v22.12.0, 62 escenarios: [GC](../../memory/id-lookups/history/id-lookups/2026-10-20T23-57-31.713Z-v22.12.0.json.gz).
- v24.14.1, 62 escenarios: [GC](../../memory/id-lookups/history/id-lookups/2026-10-20T23-51-56.816Z-v24.14.1.json.gz).
