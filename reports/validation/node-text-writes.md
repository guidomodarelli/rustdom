# Decisiones de escritura de texto en Rust

`TreeStore.text_write_action` selecciona el efecto de nodeValue/textContent
desde el tipo canónico: ignorar, cambiar un Attr, reemplazar CharacterData
o sustituir hijos. No modifica datos ni topología y devuelve una acción escalar
que no mantiene recursos nativos ni referencias a V8.

El puente mantiene la normalización de null y los hooks originales de Attr,
replaceData y _replaceAll. La creación de Text se entrega al documento original.
Las conversiones WebIDL ocurren antes de entrar al setter privado; las reacciones
y callbacks ocurren después de terminar el préstamo nativo. No se omiten
escrituras idénticas, porque sus registros y reacciones son observables.

Antes del cambio pasaron tres pruebas de baseline contra jsdom independiente:
156 combinaciones de propiedad, familia de nodo y valor con dos escrituras cada
una; conversiones que fallan incluso sobre nodos que ignoran escrituras; y
reacciones reentrantes de custom elements. La matriz observa identidades,
hijos retirados, contenido, MutationObserver con oldValue y rangos vivos.

Se agregan contratos de decisiones nativas y errores sin consumo de reservas,
consumidores CJS/ESM y benchmarks de 1.000 escrituras alternadas de ambas
propiedades. Pasaron **121 tests Rust**, Clippy/build y **19 contratos Node
focales** de setters, lecturas de texto, topología y colecciones de atributos.
La validación integral y las mediciones finales se detallan más abajo.

La primera prueba Rust expuso un problema adicional de liberación: setData
aceptaba un snapshot Attr sin nombre, pero release intentaba obtener su nombre
cualificado y devolvía NotAttribute. El fallo ocurría en el cleanup, después de
que las decisiones de escritura ya hubieran coincidido con lo esperado.

La liberación ahora obtiene una clave únicamente cuando existen referencias
de ownership o índices que deban retirarse. Un snapshot sin referencias se
libera sin exigir metadata de Attr completa. Esto conserva la protección de
atributos indexados y evita que un árbol nativo retenido acumule esos snapshots.
Las regresiones Rust y N-API repiten 1.024 ciclos, comprueban links, reintentos
idempotentes y contadores finales de nodos/datos en cero. La matriz de setters
usa nombres válidos; la entrada incompleta queda cubierta por la regresión
específica de liberación.

El [Memcheck de la suite Rust completa](../memory/2026-09-12T19-15-59.946Z-valgrind.json)
pasó **121 tests** en 315,95 segundos, con cero errores y cero pérdidas
definitivas o indirectas. El log conserva 48 bytes posibles y 544 alcanzables
de std/libtest, sin supresiones. Esta prueba cubre el ejecutable Rust; el GC
de V8 y el teardown de entornos se verifican por separado.

La validación integral pasó **121 tests Rust, 326 contratos Node, 7 Jest,
11 Vitest y 4 en pools VM**, además de 1.784 casos HTML5 comparables. El
[reporte WPT](../compatibility/2026-09-12T19-26-13.602Z-linux-wpt.json) conserva
43.708 casos en paridad: 42.678 aprobados por el estándar y 1.030 fallos
compartidos. El bootstrap bloqueado de Range-deleteContents sigue declarado;
no se cuenta como aprobación ni se alteraron sus fixtures.

El [estrés de memoria en cinco modos](../memory/2026-09-12T19-30-24.800Z-linux-x64.json)
pasó. rustdom terminó con cero supervivientes de 882 documentos, 882 ventanas,
6.500 nodos observados y 1.500 rangos. Cada modo Vitest liberó sus 440 documentos
y ventanas, 3.520 nodos y 1.760 rangos observados. El crecimiento final de
rustdom fue 2,46 MiB de heap y 18,40 MiB de RSS; se conservan muestras y
contadores nativos, sin afirmar ausencia absoluta de fugas.

El paquete con SHA-256
`0d1aee9e9667d83d9d2c35a8b98bb9c7628e52dc0594f5c380d3df979243d8bd`
pasó **18 controles** en [Node 24](../distribution/2026-09-12T19-30-03.800Z-linux-x64.json)
y **18 en Node 22.12** [en este reporte](../distribution/2026-09-12T19-32-28.496Z-linux-x64.json).
Se verificaron instalaciones npm/pnpm, tipos, consumidores CJS/ESM, Unicode,
workers y runners reales. El consumidor ESM comprueba el nuevo named export.

## Rendimiento

El [benchmark guardado](../benchmarks/2026-09-12T19-37-14.841Z-linux-x64.json)
se ejecutó con CPU coordinada y sin otros builds, pruebas o controles de memoria.
Mide 1.000 escrituras públicas alternadas y comprueba datos, hijos e identidades
fuera del tiempo medido. Los cuatro procesos alternan motores y preservan las
muestras crudas; el ratio divide tiempo jsdom por tiempo rustdom.

| Operación | Filas de la tabla de contexto | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| nodeValue de Text, 1.000 escrituras | 250 | 0,405 | 1,635 | 0,25× |
| textContent de Element, 1.000 escrituras | 250 | 5,763 | 11,057 | 0,52× |
| nodeValue de Text, 1.000 escrituras | 1.000 | 0,449 | 1,588 | 0,28× |
| textContent de Element, 1.000 escrituras | 1.000 | 5,477 | 10,403 | 0,53× |

En estos patrones rustdom sigue siendo más lento: aproximadamente 3,5–4× para
nodeValue y 1,9× para textContent. Esta comparación contra jsdom no aísla el
incremento respecto al commit anterior. El hito migra decisiones y conserva
compatibilidad; todavía quedan optimizaciones del puente y de los drivers.
