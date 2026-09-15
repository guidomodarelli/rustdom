# Interpretación nativa de doctype y entidades XML

El driver XML deja de interpretar doctype y entidades con regex JavaScript.
NativeXmlParser.describeDoctype ejecuta en Rust la prioridad y búsqueda de las
reglas fijadas de jsdom: HTML, PUBLIC, SYSTEM y nombre genérico. Se preservan
espacios ECMAScript, comillas dobles no vacías, coincidencias no ancladas y datos
UTF16. Un resultado sin nombre mantiene el error de acceso original del host.

applyDoctypeEntities extrae las declaraciones con las mismas reglas literales y
registra solo nombres nuevos, sin reemplazar predefinidas ni expandir valores
recursivamente. Se llama después de crear y anexar DocumentType; no adelanta
efectos si ese paso falla. La API lexical no activa la extensión implícitamente,
por lo que conserva sus contratos independientes de comparación con saxes.

## Contratos y memoria

El [baseline](xml-doctype/baseline.log) pasó 216 casos públicos antes de migrar:
variantes PUBLIC/SYSTEM, vacíos, comillas, whitespace, declaraciones dentro del
texto, duplicados, nombres especiales, errores y entidades. La [integración](xml-doctype/integration.log)
pasó 268 tests junto con el parser XML existente y los contratos raw.

La [comparación reproducible](xml-doctype/differential.log) prueba las reglas
nativas contra el contrato RegExp fijado con ediciones sembradas, truncamientos,
declaraciones embebidas y UTF16: pasaron 902 inputs. No evalúa strings de archivos fuente como test.
Dos tests Rust verifican interpretación y extracción en orden.

El helper de GC ahora carga 1.000 entidades en un parser profundo, conserva un
resultado y comprueba que parser, buffers y owners XML se recolectan. Las razones
de licencia/atribución del parser anterior se conservan. La creación de nodos y
los efectos del host siguen siendo parte del trabajo pendiente del motor.

Clippy señaló condicionales anidados; se simplificaron sin desactivar controles.
Se conservan clippy-before.log y validation-before.json. La validación general,
instalación y Memcheck del estado final pasaron; el benchmark también se completó.

El [Memcheck XML](../memory/2026-09-13T20-11-11.019Z-xml-doctype-valgrind.log)
aprobó siete tests del parser y las nuevas reglas: cero errores, cero bytes
definitivamente perdidos y cero indirectamente perdidos, sin supresiones.
Se conservan 48 bytes posiblemente perdidos y 544 alcanzables de std/libtest,
junto con el hash del ejecutable y el log de tests.

El [control general de memoria](../memory/2026-09-13T20-14-24.280Z-linux-x64.json)
aprobó jsdom, rustdom, native, vitest y vitest-vm. Rustdom liberó los 1.322
documentos y 882 ventanas observados; cada modo Vitest liberó 1.320 documentos
y 880 ventanas. Los contadores nativos volvieron al baseline. Se conservan
deltas RSS de 16,98 MiB en rustdom, 26,48 MiB en vitest y 25,22 MiB en vitest-vm;
estos controles finitos no prueban ausencia absoluta de fugas.

## Validación general

La [validación completa](xml-doctype/validation.json) aprobó formato, Clippy,
214 tests Rust, 910 Node, 7 Jest, 18 Vitest y 26 Vitest VM. HTML5 mantuvo 1.784
casos comparables y ocho casos de scripting excluidos. El [WPT ejecutable](../compatibility/2026-09-13T20-18-36.966Z-linux-wpt.json)
conservó 43.708 resultados en paridad: 42.678 aprobados por el estándar y 1.030
fallos compartidos. Range-deleteContents sigue bloqueado por el bootstrap de
la referencia; no se declara completo el corpus.

El paquete con SHA-256
`1212a1563403b7bb3d5fbb796e84573650d76361192b5349c41769d2fa89efd9`
pasó 18 controles en [Node 24](../distribution/2026-09-13T20-14-40.012Z-linux-x64.json)
y 18 en [Node 22](../distribution/2026-09-13T20-17-01.606Z-linux-x64.json),
incluidos npm/pnpm, tipos, CJS, ESM/VM, Unicode, workers y runners reales.

## Benchmark final

La [medición aislada](../benchmarks/2026-09-13T20-25-55.882Z-linux-x64.json)
conserva 18 muestras por motor/operación, en dos procesos con tres warmups y
orden alternado. xml-doctype incluye dos declaraciones por entidad y un intento
de reemplazar amp; se verifican el DocumentType, cada fila y la serialización.

| Operación | Tamaño | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| xml-construct | 100 | 8,376 | 14,044 | 0,60× |
| xml-fragment | 100 | 4,969 | 12,925 | 0,38× |
| xml-parse-error | 100 | 7,927 | 13,264 | 0,60× |
| xml-doctype | 100 | 8,191 | 13,487 | 0,61× |
| xml-construct | 1000 | 28,500 | 82,991 | 0,34× |
| xml-fragment | 1000 | 32,781 | 94,745 | 0,35× |
| xml-parse-error | 1000 | 28,977 | 83,602 | 0,35× |
| xml-doctype | 1000 | 34,362 | 84,003 | 0,41× |

Ratio = mediana jsdom / mediana rustdom. El coste completo sigue siendo mayor
en rustdom; no se presenta esta migración como aceleración. Paquete, memoria y
benchmark comparten el mismo binario nativo:
`eddce7af9aa8cd2d4c6aaa3d67b8557898965f1f91e889adcae03e6d27c1a3c3`.
