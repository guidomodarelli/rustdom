# Atributos canónicos sin snapshots redundantes

Los lectores HTML, CSS y de slots consultan directamente los Attr canónicos en
Rust. Se elimina la copia de todos los nombres, namespaces, prefijos y valores
en NodeData después de cada mutación. Los nodos nativos que solo tienen datos
de snapshot conservan ese modo; no se cambia la API pública ni los hooks JS de
observadores/custom elements.

## Diagnóstico y diseño

El [baseline](../benchmarks/2026-09-15T00-18-32.287Z-linux-x64.json) sobre el
binario publicado en PR62 midió 143,863 ms para escribir 1.000 atributos de
dataset y 67,647 ms para borrarlos. Los perfiles de
[escritura](../benchmarks/2026-09-15T00-18-45.817Z-attributes-dataset-write-analysis.json)
y [borrado](../benchmarks/2026-09-15T00-18-50.846Z-attributes-dataset-delete-analysis.json)
conservan muestras V8 y sitúan buena parte del tiempo en las fronteras nativas.
No identifican stacks Rust internos: nombres como setEntity o frames sin nombre
no se interpretan como funciones Rust concretas.

La inspección local encontró que snapshot_attributes clonaba toda la colección
y refresh_attribute_cache volvía a recorrerla para detectar UTF-16 no convertible.
Esa operación se repetía en cada escritura, inserción, reemplazo y borrado. El
candidato elimina esa duplicación y reutiliza AttributeViews para las lecturas.
Los selectores siguen solicitando compatibilidad cuando un Attr del árbol contiene
UTF-16 no convertible; un Attr suelto de otro árbol no invalida consultas válidas.
La serialización conserva orden, prefijos, escaping y el atributo sintético is.
La búsqueda de slots lee sus nombres actuales, incluidos valores UTF-16.

NodeData.attributes queda reservado a nodos de snapshot sin colección canónica.
Los metadatos entrantes de elementos canónicos descartan también la capacidad
del vector ignorado. Los contadores observables de cambios del owner se conservan
sin reproducir copias. Los índices de ownership/aliases siguen siendo los mismos.

El test Rust que corrompe deliberadamente un índice privado ahora verifica el
error del lector canónico: ya no existe el cache que se verificaba antes. La
serialización rechaza el Attr inexistente en lugar de servir una copia obsoleta.
Los guards de las APIs públicas para transiciones inválidas siguen ejercitados.

## Validación disponible

[Nueve contratos nuevos](attribute-cache/contracts-before.log) pasaron antes del
cambio. Después pasaron esos nueve y 85 contratos de dataset, para un total de
[94 focales](attribute-cache/contracts-after.log). Los
[231 tests Rust](attribute-cache/rust-tests.log), formato y Clippy pasaron.

Se están midiendo las operaciones modificadas y sus lectores. La opción
RUSTDOM_BENCHMARK_PACKAGE permite ejecutar un paquete histórico real sin reemplazar
dist. Los reportes separan la identidad del harness/árbol de trabajo de la del
motor cargado. El baseline de lectores usa el paquete de PR62 con SHA-256
ff9270d031d6729ef2cd8177cac5c07cb87b93f3388a0e52e343ffadfbcd7d44, ya probado en
Node 22/24. La validación general y memoria del candidato final se detallan abajo.

## Primer candidato y ajuste posterior

El [primer candidato medido](../benchmarks/2026-09-15T00-31-24.117Z-linux-x64.json)
redujo escritura de 1.000 atributos de 143,863 a 27,622 ms y borrado de 67,647 a
12,624 ms. Los borrados todavía son más lentos que jsdom. El
[baseline de lectores del paquete anterior](../benchmarks/2026-09-15T00-29-46.519Z-linux-x64.json)
y el [primer candidato de lectores](../benchmarks/2026-09-15T00-32-33.825Z-linux-x64.json)
registraron estas medianas rustdom, que también se conservan:

| Operación | Tamaño | Paquete anterior (ms) | Primer candidato (ms) |
|---|---:|---:|---:|
| selectors-100 | 250 | 19,594 | 23,422 |
| slot-lookup-1000 | 25 | 1,999 | 2,297 |
| slot-lookup-1000 | 100 | 5,444 | 7,063 |
| serialize-utf8 | 250 | 0,562 | 0,638 |
| serialize-utf8 | 1.000 | 1,985 | 2,298 |

Las medianas de esos lectores empeoraron. El ajuste posterior reutiliza NodeData
ya validado durante recorridos inmutables y calcula la condición HTML una vez
por búsqueda de atributos. Volvieron a pasar los 231 tests Rust y 94 contratos
focales. Las mediciones del estado final se conservan por separado; no se
presentan las del primer candidato como resultados de ese ajuste.

## Validación general del candidato final

La [validación general](attribute-cache/validation.json) terminó con todos sus
gates aprobados: formato, Clippy, Rust, Node, Jest/Vitest y corpus configurados.
Incluye 231 tests Rust, 1.605 Node, 12 Jest, 23 Vitest y 26 Vitest VM. El contrato
compartido de lectores se ejecuta mediante los runners reales.
El [WPT final](../compatibility/2026-09-15T00-46-33.733Z-linux-wpt.json) y los
resultados HTML5 mantienen las exclusiones y fallos compartidos de la referencia:
47.072 resultados WPT en paridad, 46.005 aprobados por el estándar y 1.067 fallos
compartidos; HTML5 conserva 1.784 comparables y ocho exclusiones. No se presentan
como certificación de compatibilidad completa.

El [GC focal de dataset](../memory/2026-09-15T00-49-15.526Z-dom-string-map.json)
pasó los seis ciclos conservando arrays de claves/valores mientras libera los
owners. La [prueba de capacidad con owners vivos](../memory/2026-09-15T00-49-16.670Z-attribute-capacity.json)
pasó en jsdom y rustdom: tres warmups y cinco bursts de 2.048 atributos con
valores de 1 KiB, conservando el mismo Document, Element y alias legítimo. Los
Attr eliminados se recolectaron antes de close. El crecimiento retenido rustdom
entre endpoints fue 1.277.952 bytes RSS, 178.744 bytes heap y 28.929 externos;
son muestras finitas posteriores a GC, no memoria pico ni prueba absoluta de
ausencia de fugas.

El [estrés general](../memory/2026-09-15T00-51-02.880Z-linux-x64.json) pasó en los
cinco modos. Rustdom liberó 1.762 documentos y 882 ventanas observados; cada
modo Vitest liberó 1.760 documentos y 880 ventanas. Los deltas RSS conservados
fueron 13,56 MiB, 39,77 MiB y 42,29 MiB para rustdom, Vitest y Vitest VM.

[Memcheck](../memory/2026-09-15T00-51-02.000Z-attribute-cache-valgrind.log) pasó
30 tests Rust relacionados con atributos, sin errores ni bytes definitivamente
o indirectamente perdidos. Conserva 48 bytes posiblemente perdidos y 544
alcanzables de std/libtest, sin supresiones. La validación del binding real y de
V8 proviene de los controles de memoria anteriores.

El binario final tiene SHA-256
`7095ea8d5a2b048d8fa7e36300343806925b6519ec46193d6a36eb2a552740ad`;
el paquete creado tiene SHA-256
`53c876bf09b666d633d30e1f6d757cd286b418be870b361e7db16cd35a83776e`.
El mismo paquete pasó los 18 controles de [Node 24](../distribution/2026-09-15T00-52-44.204Z-linux-x64.json)
y los 18 de [Node 22](../distribution/2026-09-15T00-54-59.416Z-linux-x64.json),
incluidos npm/pnpm, tipos, CJS/ESM/VM, workers y runners.

## Mediciones finales y límites

Los [11 tests del arnés](attribute-cache/benchmark-tests-final.log) pasaron,
incluido el contrato de carga desde una raíz de paquete explícita. El
[benchmark con override de entornos](../benchmarks/2026-09-15T00-58-52.823Z-linux-x64.json)
también pasó con el paquete anterior: verifica esa opción y sus adapters reales,
no mide el rendimiento del candidato actual. Su binario es el de PR62.

Los resultados finales de [dataset](../benchmarks/2026-09-15T01-00-33.854Z-linux-x64.json)
y [lectores](../benchmarks/2026-09-15T01-01-44.360Z-linux-x64.json) usan el binario
7095ea8d… del candidato. Cada fila conserva 18 muestras en dos procesos por
motor, tres warmups por proceso, Node 24.14.1, jsdom 27.4.0, Intel i7-1360P y
WSL2. Se excluyen preparación, validación y limpieza; se incluyen las operaciones
públicas y sus cruces N-API. Se verifican resultados completos fuera del tiempo.

| Operación | Tamaño | rustdom anterior (ms) | rustdom final (ms) | jsdom final (ms) |
|---|---:|---:|---:|---:|
| dataset-read | 4 | 0,073 | 0,079 | 0,112 |
| dataset-enumerate | 4 | 0,115 | 0,124 | 0,139 |
| dataset-write | 4 | 0,215 | 0,236 | 0,161 |
| dataset-delete | 4 | 0,229 | 0,272 | 0,163 |
| dataset-read | 1.000 | 10,024 | 10,297 | 58,073 |
| dataset-enumerate | 1.000 | 20,211 | 20,309 | 112,919 |
| dataset-write | 1.000 | 143,863 | 28,168 | 61,726 |
| dataset-delete | 1.000 | 67,647 | 12,158 | 3,250 |
| selectors-100 | 250 | 19,594 | 25,028 | 34,654 |
| slot-lookup-1000 | 25 | 1,999 | 2,341 | 5,178 |
| slot-lookup-1000 | 100 | 5,444 | 7,304 | 13,850 |
| serialize-utf8 | 250 | 0,562 | 0,615 | 1,452 |
| serialize-utf8 | 1.000 | 1,985 | 2,273 | 4,076 |

La escritura de 1.000 atributos mejora 5,1 veces respecto del estado anterior y
el borrado 5,6 veces. El borrado sigue siendo 3,7 veces más lento que jsdom.
Los lectores empeoran aproximadamente 9–34% en sus medianas, aunque conservan
ventaja frente a jsdom en estas entradas. El ajuste de metadatos no eliminó esa
regresión. Las operaciones pequeñas también conservan resultados desfavorables.
Son comparaciones de muestras finitas; variaciones pequeñas no se presentan
como diferencias estadísticamente demostradas ni como aceleración universal.

Los perfiles finales de [escritura](../benchmarks/2026-09-15T01-01-56.225Z-attributes-dataset-write.json)
y [borrado](../benchmarks/2026-09-15T01-01-57.702Z-attributes-dataset-delete.json)
verifican que los contadores de parsing no cambian durante las mutaciones. Los
nombres atribuidos por V8 a frames nativos pueden ser ambiguos, incluso mostrar
parseFragmentTape: no se interpretan como evidencia de parsing ni como stacks
Rust fiables. Sus muestras crudas y análisis se conservan junto a los metadatos.
