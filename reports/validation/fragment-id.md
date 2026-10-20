# getElementById de DocumentFragment en Rust

DocumentFragment.getElementById, incluido ShadowRoot y template.content, ejecuta el recorrido y filtro exacto del atributo id sin namespace en Rust. Para en el primer match físico, excluye el root y otros árboles y devuelve null para ID vacío. Conserva UTF-16, orden, identidades, mutaciones y adopción. Reutiliza el lector prestado de atributos y following_within; no agrega caches ni listas intermedias.

WebIDL, factories y owners siguen en el host actual. Document.getElementById mantiene su índice JavaScript y SVGSVGElement.getElementById conserva su implementación separada: sus reglas incluyen el propio root y permiten un atributo ID vacío. El runtime continúa siendo híbrido y el objetivo integral permanece abierto.

Base: checkpoint-062-name-queries, main e5a2daa, árbol idéntico al head revisado 645f2ec del PR 74. foundation/ conserva merge, ocho checks y revisión limpia; el addon ca4c8081… es el baseline real. La rama del hito es feature/native-fragment-id; comprobar el estado remoto antes de asumir integración.

| Validación | Resultado |
|---|---|
| Rust 1.98.1 / 1.99.1 | Clippy y 291 tests por versión |
| Node 22.12.0 / 24.14.1 | 3.506 contratos, Jest 21, Vitest 32 y VM 32 por versión |
| Baseline diferencial | 84 contratos por Node antes de migrar |
| Focales integrados | 760 por Node antes de añadir el test separado de GC |
| Focal final | 87 por Node: 84 diferenciales, dos de uso nativo y un proceso GC |
| Memoria focal | 78 escenarios de fragmentos y 52 anteriores de colecciones por Node |
| Harness de benchmarks | 80 tests por Node; ocho nuevos en ambos motores reales |
| CLI real | Cuatro workers y ocho filas por Node; inputBytes 21 y hashes iguales |
| Paquete instalado | 20 controles por Node con npm/pnpm, mismo archivo |
| HTML5 | 1.784 comparables por Node; exclusiones conservadas |
| WPT v24.14.1 | 240 fixtures y 83007 resultados en paridad; 1203 fallos de estándar compartidos |
| WPT v22.12.0 | 240 fixtures y 83007 resultados en paridad; 1203 fallos de estándar compartidos |

Cada Node ejecutó el corpus WPT completo de 240 fixtures en un único comando. Incluye los quince fixtures de nombres previos y cuatro nuevos de Document/DocumentFragment y ShadowRoot dinámico. Estos últimos conservan bytes, Git blob y SHA-256 de la revisión upstream fijada. Se mantienen todos los hashes, suites y exclusiones anteriores. complete:false y el bootstrap bloqueado de Range-deleteContents siguen visibles; paridad con jsdom no certifica conformidad completa.

Los diferenciales cubren HTML/XML, default/VM, fragmentos, template.content, ShadowRoot, namespaces, ID vacío, literal *, NUL, surrogates, duplicados, árbol físico, Attr directo, reemplazos, movimientos, clonación, remoción, adopción, WebIDL y errores. Los seis tests Rust cubren filtros, orden y retorno temprano, valores, atributos canónicos, scopes/ownership y handles inválidos sin activar nodos reservados.

La revisión estática aislada de Codex terminó sin hallazgos accionables sobre los catorce paths de código, bindings, tests y benchmarks. Sus observaciones y los gates reales se conservan por separado; no se atribuyen ejecuciones independientes al reviewer.

Los ocho reportes de rendimiento guardan 32 workers y 36 muestras por fila/motor/etapa/runtime. La variación frente al baseline va de -95.99% a +2.68%; todas las filas, controles y regresiones se conservan.
El benchmark consume cien operaciones públicas en 100/1.000 Element y valida también la serialización completa del scope separado. Preparación, validación, cierre y GC quedan fuera del tiempo. Los smoke tests del CLI solo validan corrección y se excluyen de estas mediciones finales. No se extrapola a suites completas.

Fuente canónica: `73f242643bfee440594c36b15635917118a01221cabea18bd7b85bd58553ef73`.
Addon: `69577fc60935fd561f37cfb0b2bfbbd7cf970434448ffb7e795877f17706d23e`.
Paquete instalado: `80cbd5de7e61d280d467f702243710d65f6057f9a6a4a408f30b5ed7e8c53f26`.

- [Inventario, comandos y checksums](fragment-id/evidence.json).
- [Benchmarks](../benchmarks/fragment-id/README.md).
- [Memoria y límites](../memory/fragment-id/README.md).

Los datos grandes usan gzip sin pérdida y se verifican sus bytes originales. Quedan el índice de Document, la búsqueda SVG, factories, WebIDL y otras APIs delegadas a JavaScript/jsdom.
