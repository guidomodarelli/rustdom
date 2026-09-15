# Parser XML incremental en Rust

El runtime XML ya consume NativeXmlParser, sin delegar la tokenización o las
decisiones de namespaces/estructura a saxes. El estado Rust conserva UTF16,
posiciones, entidades y elementos abiertos; devuelve eventos y solicitudes de
prefix al host antes de sus efectos. El algoritmo de compatibilidad adapta
saxes6 con su atribución ISC y reutiliza clases de caracteres de xmlparser.
La licencia se conserva en third-party/saxes y en el paquete instalado.

El bridge mantiene creación de nodos, errores de la realm, scripts, templates y
resolución de contexto real. Las heurísticas de interpretación de doctype y la
extracción de entidades del driver jsdom todavía contienen código JavaScript;
siguen pendientes de migración. No se declara terminado XML ni el objetivo
integral por este avance.

El [baseline](xml-parser/baseline.log) pasó 46 tests reales. La
[captura completa](../compatibility/2026-09-13T18-32-15.169Z-xml-contracts.json)
guarda árboles, atributos ordenados, namespaces/prefijos, owners de templates,
serialización, errores exactos, documentos parciales y efectos de scripts.
También cubre fragmentos con resolución de prefijos del contexto y documentos
parsererror de DOMParser. Ese baseline histórico ejecutaba saxes en ambos motores;
las ejecuciones nativas posteriores se detallan a continuación.

Un caso verifica que un script ejecutado antes de un error posterior conserve
su efecto. Por eso no basta con validar todo el input antes de construir el
documento: la integración debe preservar el orden de tokens y callbacks. Los
errores de fragmento deben dejar intacto el árbol que se pretendía reemplazar,
sin ocultar efectos externos anteriores del parser.

## Primitivas evaluadas

- xml5ever0.39 ya está en el árbol de dependencias. Su fuente local declara XML5
  con recuperación, namespaces parciales y DTD fuera de alcance; no reemplaza
  directamente al parser de la referencia.
- [xmlparser0.13.6](https://docs.rs/xmlparser/0.13.6/xmlparser/) ofrece tokenización
  y primitivas XML1.0 sin asignaciones. No valida estructura de árbol ni atributos
  duplicados y solo recibe UTF8. Se seleccionó como biblioteca de primitivas;
  no se confunde con la capa completa de compatibilidad.
- [quick-xml](https://docs.rs/quick-xml/0.42.0/quick_xml/reader/struct.Config.html)
  ofrece controles configurables para comentarios y cierres, pero esos controles
  no prueban equivalencia con errores, entidades y comportamiento de saxes.

La referencia real es saxes6.0.0, forzada a XML1.0 y namespaces. Sus eventos,
mensajes, posiciones y reglas de entidades deben preservarse explícitamente.
La entrada debe conservar UTF16: convertirla con pérdida a UTF8 cambiaría casos
de surrogates aislados y el momento de los errores. Los detalles observados en
la referencia deben verificarse con contratos, no corregirse hacia otro parser
sin documentar la diferencia de compatibilidad.

## Trabajo pendiente

Completar la migración de las heurísticas de doctype y extracción de entidades
que todavía usa el driver, junto con los algoritmos de construcción/efectos que
siguen en el host. Ampliar pruebas de encodings y demás rutas aplicables. No cerrar
XML con un subset válido, recuperación silenciosa o fallback JavaScript.

## Evidencia de la implementación nativa

La [integración inicial](xml-parser/native-integration.log) pasó los 46 casos.
La [prueba de contexto reentrante](xml-parser/reentrant-context.log) añadió un
custom element real cuyo constructor cambia xmlns:p antes del siguiente tag del
fragmento: el parser consulta el contexto después de ese efecto y conserva el
namespace observado en la referencia. Los 47 casos pasaron.

La [comparación de entradas mutadas](../compatibility/2026-09-13T19-20-14.022Z-xml-tokenizer.json)
pasó 2.348 entradas con eventos y errores exactos, incluyendo todos los
truncamientos de las bases y ediciones con seed reproducible. El [corpus
upstream](../compatibility/2026-09-13T19-20-35.763Z-xml-upstream.json) pasó 2.585
fixtures. Se respetan sus xml:base y se guardan hashes por archivo. Se decodifican
como strings UTF8 para esta comparación; no se presenta como certificación de
encodings, DTD externo o conformidad con todos los estándares.

El [control de memoria](../memory/2026-09-13T19-20-40.751Z-xml-parser.json) ejerció
cinco ciclos de documentos válidos y parciales, cierre y recolección de
Document/Window. También conserva un resultado nativo mientras se recolecta el
parser con un input profundo todavía abierto. Los buffers y contadores vuelven
al baseline; el resultado de texto/atributos sigue siendo válido.

La [ejecución ampliada](xml-parser/expanded.log) pasó 51 tests, incluyendo uso
nativo verificable, receptores ajenos y errores terminales. Clippy detectó un
resultado de error grande; se reemplazó por una resolución pequeña y explícita,
sin suprimir el lint. Se preservan clippy-before.log y validation-before.json.
La validación general y el benchmark final de ese ajuste también se completaron.

El [Memcheck nativo](../memory/2026-09-13T19-30-50.803Z-xml-valgrind.log) aprobó
cinco tests de input, eventos, namespaces y entidades: cero errores, cero bytes
definitivamente perdidos y cero indirectamente perdidos, sin supresiones.
Los 48 bytes posiblemente perdidos y 544 alcanzables de std/libtest permanecen
visibles. Se conserva el hash del ejecutable y el log de tests.

El [control general de memoria](../memory/2026-09-13T19-33-34.580Z-linux-x64.json)
aprobó jsdom, rustdom, native, vitest y vitest-vm. Rustdom liberó los 1.322
documentos y 882 ventanas observados; cada modo Vitest liberó 1.320 documentos
y 880 ventanas. Los contadores nativos, incluidos parsers XML e inputUnits,
volvieron al baseline. Se conservan deltas RSS de 20,43 MiB en rustdom,
74,28 MiB en vitest y 74,52 MiB en vitest-vm; no se confunden con una prueba
de ausencia absoluta de fugas ni con memoria pico.

La [medición inicial](../benchmarks/2026-09-13T19-25-31.085Z-linux-x64.json)
registró XML construct/fragment/error con validación completa de filas, CDATA,
atributos, serialización y error. Para 1.000 filas, construcción dio 81,428 ms
frente a 28,277 ms en jsdom, fragmento 96,680 ms frente a 31,092 ms y error tardío
82,665 ms frente a 29,782 ms. Son costos pendientes, no una aceleración; la
medición final después del ajuste de Clippy se conserva aparte.

## Validación final y rendimiento

La [validación general](xml-parser/validation.json) aprobó formato, Clippy,
212 tests Rust, 691 Node, 7 Jest, 18 Vitest y 26 Vitest VM. HTML5 mantuvo sus
1.784 casos comparables y ocho casos de scripting excluidos. El [WPT ejecutable](../compatibility/2026-09-13T19-38-26.554Z-linux-wpt.json)
conservó 43.708 resultados en paridad: 42.678 aprobados por el estándar y 1.030
fallos compartidos. Range-deleteContents sigue bloqueado por el bootstrap de
la referencia; no se presenta el corpus como completo.

Los controles instalados pasaron 18 gates en [Node 24](../distribution/2026-09-13T19-33-51.616Z-linux-x64.json)
y 18 en [Node 22](../distribution/2026-09-13T19-36-29.826Z-linux-x64.json),
incluidos npm/pnpm, tipos, CJS, ESM/VM, workers, Unicode y runners reales.

El [benchmark final aislado](../benchmarks/2026-09-13T19-44-42.574Z-linux-x64.json)
conserva 18 muestras por motor y operación, en dos procesos con tres warmups
cada uno y orden alternado. Las salidas incluyen el XML completo y los errores.

| Operación | Tamaño | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| construct-native-eligible | 25 | 11,375 | 12,324 | 0,92× |
| construct-native-eligible | 250 | 31,801 | 44,886 | 0,71× |
| construct-native-eligible | 1000 | 75,790 | 137,462 | 0,55× |
| event-dispatch | 100 | 0,559 | 1,649 | 0,34× |
| event-dispatch | 1000 | 3,424 | 13,635 | 0,25× |
| xml-construct | 100 | 8,009 | 13,162 | 0,61× |
| xml-fragment | 100 | 4,663 | 12,452 | 0,37× |
| xml-parse-error | 100 | 8,111 | 14,069 | 0,58× |
| xml-construct | 1000 | 28,551 | 80,956 | 0,35× |
| xml-fragment | 1000 | 32,097 | 95,085 | 0,34× |
| xml-parse-error | 1000 | 27,730 | 81,660 | 0,34× |

Ratio = mediana jsdom / mediana rustdom. El parser nativo y su bridge todavía
son más lentos en estas cargas; conservar ese costo y optimizar operaciones
completas mientras se migra lo pendiente. No se atribuyen diferencias entre
corridas separadas a una causa aislada ni se promete aceleración universal.

Paquete validado, memoria general y benchmark final usan el mismo binario:
`494abeca45e5b8f8f4bbb61135384962480a2a74701f517cb11902a62f69694d`.
Tras actualizar la descripción XML del README se volvió a empaquetar sin
reconstruir. La [comparación de contenido](xml-parser/package-readme-audit.json)
verifica que ese archivo fue el único cambio; runtime, tipos y licencias
conservan exactamente los bytes del paquete que pasó los 36 controles.
