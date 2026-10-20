# HTMLCollection: búsqueda por nombre y nombres de propiedades

Trabajo sobre `checkpoint-059-collection-queries`, commit
`a155685e30510cf626b03f83a6b7fc79c845baf2` (árbol equivalente a `02f7b7d`).
La rama de este hito es `feature/native-collection-members`.

## Cambio y límites

`HTMLCollection.namedItem` y la generación de `supportedPropertyNames` recorren
los miembros y sus atributos canónicos en Rust. Se eliminan las lecturas de
atributos mediante N-API por cada miembro de esas operaciones. Cada elemento
prueba primero su `id` y después su `name`, este último solo en el namespace
HTML; el primer elemento coincidente gana. Los nombres conservan orden,
deduplicación, UTF-16 exacto y exclusión de valores vacíos.

El binding conserva una instantánea de IDs numéricos junto a la lista que ya
posee los nodos. Las consultas nativas reutilizan su array numérico original;
las otras familias de colecciones producen el transporte al actualizarse.
No se crea un índice global de nombres ni un owner adicional del DOM en Rust.
La clave vacía de `namedItem` sigue devolviendo `null` antes de actualizar.

Las comparaciones de metadatos usan igualdad UTF-8 cuando ambas representaciones
lo permiten y comparación exacta de unidades UTF-16 en los demás casos. Esto
incluye las consultas por tag/namespace del hito anterior. No se normalizan
Unicode ni surrogates aislados, ni cambia la equivalencia quirks de jsdom.

WebIDL, el Proxy, factories, ownership visible a V8, invalidación y otros métodos
de `HTMLCollection` mantienen el host existente. Las colecciones especializadas
con overrides propios, como `RadioNodeList`, conservan esos contratos. El motor
sigue siendo híbrido; este hito no acredita migración o compatibilidad completas.

## Pruebas de comportamiento

- Referencia independiente: jsdom **27.4.0** de `node_modules`, sin parchear.
- **93 casos diferenciales** pasaron en Node 22.12.0 y 24.14.1 sobre el baseline
  antes del cambio. El candidato agrega un control del uso de las rutas nativas.
- Los contratos cubren orden y prioridad, namespaces, HTML/XML/quirks,
  propiedades numéricas y reservadas, descriptores, UTF-16/NUL, coerciones,
  atributos vivos, remoción/reordenamiento, expandos y colecciones heredadas.
- Seis tests Rust nuevos cubren búsqueda/orden, atributos canónicos, handles
  inválidos/liberados, strings con distintas representaciones y surrogates.
- La revisión independiente pasó **44 probes diferenciales y 4 de GC por Node**;
  no dejó hallazgos productivos. Dos intentos preliminares de su arnés de GC se
  invalidaron por errores del propio probe y no sustentan las conclusiones.
- Los benchmarks directos comprueban resultado, identidad, nombres, teardown y
  actividad nativa antes de cualquier lectura auxiliar de validación. Esa
  ubicación corrige un falso positivo detectado durante la revisión del arnés.

| Validación | Estado |
|---|---|
| Clippy y 275 tests Rust, 1.98.1 y 1.99.1 | Aprobado |
| 3.157 contratos Node, Jest 21, Vitest 32 y VM 32 por versión | Aprobado |
| Corpus HTML5 1.784 casos y paridad WPT en Node 22/24 | Aprobado |
| 52 contratos del harness de benchmarks, ambos Node | Aprobado |
| Cinco modos de memoria y 275 tests en nueve lotes Memcheck | Aprobado |
| 40 controles del paquete instalado, mismo archivo en ambos Node | Aprobado |
| Ocho reportes de benchmarks, 32 workers y 36 muestras por fila/motor/etapa | Aprobado |

La paridad WPT cubre **221 fixtures y 82.939 assertions por versión**, con
**1.200 fallos de estándar compartidos**. Los reportes conservan `complete:false`,
las exclusiones y el bootstrap bloqueado de Range-deleteContents. Igualar la
referencia no certifica conformidad completa con estándares.
La [evidencia](collection-members/evidence.json) identifica fuentes, tests,
addon, paquete, compiladores, comandos y archivos crudos con checksums. Los
archivos grandes usan gzip sin pérdida; los resultados históricos se conservan.

Se preservan **243 archivos**, con 185,8 MB originales reducidos sin pérdida a
5,2 MB. El digest canónico de fuentes es
`de3fb85d11aa6684c1c519c31b1f60c5a4b3d6187f8ecb455f6be23bba08a22a`;
el addon probado es
`7f24a7e904b0aefbb673b20654ebfac1c2b1bfb0c601a483feec812ef6bb971b`.
Los 40 controles instalaron el mismo paquete, SHA-256
`6def30870fd1c24b41968bf899e533875838747f63aac7869861df77624d8751`.

## Memoria y ownership

Los 30 escenarios de la prueba de colecciones incluyen ambos motores y los
realms default/VM, owners retenidos/liberados y listas obsoletas tras mutaciones.
Dos escenarios nuevos retienen únicamente el `Float64Array` y los nombres
devueltos, mientras exigen recolectar Document, Window, nodos y colección y
restaurar los contadores nativos. Los valores de transporte siguen siendo
legibles después: no mantienen vivo el DOM.

Los resultados de heap JavaScript, memoria externa y RSS posteriores al GC se
guardan en [memoria](../memory/collection-members/). Son controles finitos y no
mediciones de pico ni una prueba de ausencia absoluta de fugas. El Set Rust de
deduplicación y sus strings pertenecen a cada llamada y se destruyen al retornar;
las instantáneas numéricas se reemplazan junto con las listas existentes.

## Rendimiento y tamaño

Los [benchmarks](../benchmarks/collection-members/README.md) comparan el mismo
compilador Rust 1.99.1 y conservan ambos órdenes de etapas y motores. Incluyen
los seis workloads anteriores, hits/misses de `namedItem` y enumeración pública
completa de nombres, con 100/1.000 miembros. Se reportan todas las filas y
variaciones adversas, sin atribuir velocidad por el solo uso de Rust.

Las 36 medianas agrupadas bajan **13,02–96,90%** frente al baseline. Cien
lecturas desde caché con 1.000 descendientes pasan de **72,50 a 4,25 ms** en
Node 24 y de **70,44 a 4,38 ms** en Node 22, aproximadamente **94% menos**;
ambos órdenes conservan esa mejora. El control jsdom varía de −7,21% a +16,62%,
por lo que los cambios pequeños requieren cautela. Persisten costos frente a
jsdom, especialmente con dieciséis clases y en algunas operaciones por nombre;
no se afirma una mejora universal ni velocidad de suites completas.

Los perfiles de CPU capturan un bucle público preparado de `length`/`item`,
excluyendo construcción y validación. Antes predominaban el puente y las
lecturas de atributos de `namedItem`. El nombre de un frame nativo compartido
no prueba que se ejecutara serialización XML. Los tiempos bajo el profiler son
diagnóstico; no se usan como aceleración del benchmark sin instrumentación.

El `HTMLCollection-impl.js` generado pasa de **98 a 73 líneas**. El módulo nuevo
contiene **92 líneas productivas y 191 de tests Rust**, más bindings, transporte
y comparaciones compartidas en el diff. No se afirma reducción total de código.
