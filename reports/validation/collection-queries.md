# Consultas de colecciones DOM en Rust

Trabajo sobre el checkpoint `checkpoint-058-dom-parser`, integrado en `main`
por el PR 70 (`36526284a644f508c37d5141f1e24acb2b5d9495`). Su árbol coincide
con `02235afb02aad73983d4aee27acc4f46950feeeb`, base original de esta rama.

## Alcance

`getElementsByClassName`, `getElementsByTagName` y `getElementsByTagNameNS`
seleccionan sus resultados recorriendo el árbol y los atributos canónicos en
Rust. El recorrido excluye el root, los hermanos externos, ShadowRoot y el
contenido de templates que no pertenece al árbol consultado. No se convierten
las consultas a selectores CSS ni se usa su ruta de compatibilidad.

El bridge conserva la factory, el realm, la invalidación y la lista de owners
de `HTMLCollection`. Sus métodos y el Proxy WebIDL todavía pertenecen al host
JavaScript. Este hito migra los filtros y el recorrido; el objetivo integral
continúa abierto.

## Decisiones de diseño

- Un módulo Rust concentra las tres consultas. Reutiliza los atributos
  prestados y el parser de tokens existentes, preservando UTF-16 arbitrario
  sin snapshots adicionales de cada elemento.
- El recorrido acotado se comparte con el driver de slots. No requiere una
  pila de handles proporcional a la profundidad y no entra en árboles externos.
- Los resultados contienen IDs numéricos temporales. El bridge recupera las
  mismas implementaciones y conserva los owners visibles a V8; Rust no guarda
  referencias persistentes a Document, Window o colecciones.

El modo HTML de la consulta por tag queda capturado al crear la colección;
el modo quirks de clases se consulta cuando la colección se recalcula. Se
conserva así el comportamiento de colecciones existentes después de adoptar
su root en otro documento.

La referencia fijada es jsdom **27.4.0**. Su helper de clases en quirks compara
unidades UTF-16 con `| 0x20`, incluyendo algunas equivalencias no ASCII y de
signos. Se conserva ese contrato observable; no se lo presenta como una
regla normativa de Unicode o de los estándares. La búsqueda por nombre
calificado mantiene la conversión ASCII propia de esa operación.

## Validación

La validación se realiza en Linux x64/WSL2, Node **22.12.0 y 24.14.1**, Rust
**1.98.1 y 1.99.1**. El addon release se construye con Rust 1.99.1.

- Pasaron los **269 tests Rust**, con Clippy estricto, en ambos compiladores.
- La suite completa pasó **3.060 contratos Node** por versión, además de
  **Jest 21, Vitest 32 y VM 32**. Ejercen las consultas en los runners reales.
- Se agregaron **301 casos diferenciales** de consultas y un control de uso
  nativo, incluidos 54 pares aislados que cubren la equivalencia quirks.
- El fuzz reproducible añade tres escenarios y **29.646 comparaciones** por
  versión, con 61 consultas, 81 estados y lecturas de colecciones retenidas y
  nuevas. Incluye mutaciones de Attr, reordenamiento y adopción entre documentos.
- Corpus HTML5 y WPT se ejecutan en ambos runtimes. Sus exclusiones y fallos
  de estándar compartidos se conservan; paridad no equivale a conformidad total.

El inventario de [evidencia](collection-queries/evidence.json) conserva comandos,
logs, resultados completos y hashes. Las pruebas suplementarias de fuzz y del
harness se ejecutan después de la suite general; sus recuentos están separados.

Identidades verificadas:

- Fuentes medidas: `8cf504cebae2dd8c46486c87e0083f39804efb368941b8f12f1b7f06a8ca28e1`.
- Addon release: `21e3385f1b8d37770965858340f7310f7bcdcf45bed81d3816bb572e51aac4fb`.
- Paquete instalado en ambos runtimes: `f340e0b66ef781e1ff322f188442bc4c5963a1c15f5057573e038f5138187ec9`.

El digest canónico enumera implementación, harness y dependencias bloqueadas.
Los checksums de los tests nuevos y tipos públicos se registran por separado,
y se comprobaron iguales al runtime validado.

## Revisión y correcciones

La revisión independiente encontró una divergencia en quirks: comparar solo
ASCII rechazaba `É` frente a `é` y algunos pares de signos y surrogates que
jsdom equipara. La fixture inicial contenía ambas variantes en un mismo elemento
y ocultaba el problema. Se corrigió la comparación y se agregaron variantes
aisladas y regresión Rust. La revisión final no encontró otros problemas.

También confirmó, por versión de Node, 29.700 comparaciones diferenciales,
44 ejecuciones de fixtures de benchmarks y 12 escenarios de GC. Esos probes
complementan los tests versionados; las ejecuciones de fixtures no son mediciones
de rendimiento.

## Memoria

Las pruebas distinguen Window, Document, roots, elementos y colecciones. Un
warmup y tres lotes medidos crean doce ventanas cada uno por motor y realm,
con cuarenta mutaciones por ventana. Otros escenarios conservan una colección
de clases, tags o namespaces después de cerrar la ventana y luego la liberan.
Se exige la retención esperada mientras existe el owner, y dos muestras claras
tras liberarlo, junto con los contadores nativos en su baseline.

Los tokens de la consulta se liberan sin esperar al GC. No se agrega una caché
global de consultas ni un owner Rust del DOM. El contador `nativeCollectionQueries`
es acumulativo y no representa objetos vivos.

Los resultados de GC, heap, memoria externa y RSS están en
[reports/memory/collection-queries](../memory/collection-queries/). Son pruebas
finitas y mediciones posteriores a GC, no memoria pico ni una demostración de
ausencia absoluta de fugas.

Memcheck ejecutó los 269 tests en nueve lotes, con **0 errores**, **0 bytes
definitivamente perdidos y 0 indirectamente perdidos**. Los diagnósticos de
48 bytes posiblemente perdidos y 548 bytes alcanzables se mantienen visibles;
sus stacks corresponden al harness de tests y al runtime de Rust, iguales al
control previo con Rust 1.99.1. El estrés general también pasó en los cinco
modos: rustdom liberó 1.762 documentos y 882 ventanas observadas, con heap
retenido +1,95 MiB y RSS +12,69 MiB tras GC. No son mediciones de memoria pico
ni una comparación causal con corridas anteriores.

## Rendimiento y tamaño del cambio

Los [benchmarks](../benchmarks/collection-queries/README.md) usan el mismo
compilador para el baseline y el candidato. Miden recálculo tras invalidación,
creación, lectura desde caché y una consulta con dieciséis clases. Conservan
todas las muestras y los costos del puente; no se atribuyen mejoras por el
solo hecho de usar Rust.

Las medianas agrupadas de las consultas por clases bajan aproximadamente
25–49% frente al baseline. Tags y namespaces conservan variaciones adversas
de hasta **+15,43%**. La ruta de caché de 1.000 descendientes permanece cerca
de 70 ms por cien lecturas completas, frente a 3,7–6,3 ms en jsdom en estos
grupos. Todas las filas y las dos repeticiones están guardadas. Quedan abiertos
los costos del host y las comparaciones nativas por tag/namespace; no se afirma
una aceleración universal.

El archivo generado `node.js` pasa de **251 a 108 líneas**. Los tres helpers
anteriores ocupaban 147 líneas; los nuevos módulos tienen **197 líneas de
implementación**, más 318 líneas de tests Rust embebidos. Los bindings y el
recorrido compartido se detallan aparte en el diff. La reducción del archivo
JavaScript no es una reducción del tamaño total de la implementación.

## Incidencias del entorno

El primer intento de Memcheck no pudo iniciar `valgrind`: faltaba su directorio
en el `PATH`, aunque la herramienta ya estaba instalada. Se conservó el error,
se corrigió el entorno y se retomó desde ese control. No se modificaron los
tests ni se omitió una validación para resolverlo.
