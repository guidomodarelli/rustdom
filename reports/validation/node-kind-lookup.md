# Consulta del tipo junto a los enlaces nativos

Las restricciones de Document consultaban el mapa de datos para conocer el
tipo y el mapa de enlaces para continuar el recorrido. El registro de enlaces
ahora conserva una proyección del tipo, actualizada únicamente en el punto
central que confirma los metadatos. Los recorridos obtienen tipo y siguiente
nodo con una sola consulta al mapa de enlaces.

`None` distingue un registro sin metadatos de un tipo válido cuyo valor sea
cero. La activación de topología conserva el tipo existente; una confirmación
de metadatos lo inicializa o actualiza en la misma búsqueda. Las validaciones
fallidas conservan datos, reservas y contadores. No se agrega un mapa de cache
ni referencias a JavaScript: el campo se libera junto con su registro.

El registro `Links` ocupa **72 bytes** antes y después en este Linux x64:
[base](node-kind-lookup-baseline.log), [primer candidato](node-kind-lookup-candidate.log)
y [variante final](node-kind-lookup-final.log). La proyección utiliza espacio
de padding existente; la medición no afirma el layout de arquitecturas no probadas.

## Validación focal

Pasaron 130 tests Rust, Clippy/build y 32 contratos Node focales. La cobertura
incluye todos los inicializadores expuestos, nodos ligados cuyo tipo cambia,
metadatos ausentes/tipo cero, escrituras rechazadas, reservas y templates que
activan el mismo handle u otro ya inicializado. Las matrices de inserción y
reemplazo contra jsdom se mantienen.

La primera prueba de ProcessingInstruction usaba un método inexistente; se
corrigió para usar setCharacterData e initializeProcessingInstructionTarget,
que son los dos pasos reales de la API. No se cambió producción para acomodar
esa equivocación de la prueba.

## Experimento de rendimiento

Se guardaron dos rondas de base y dos de cada candidato, con procesos alternados
por motor y 18 muestras por motor/workload en cada ronda. Las comparaciones
combinan todas las 36 muestras por variante, conservan resultados por ronda,
verifican hashes de documentos y binarios y no eliminan outliers.

El [primer candidato](../benchmarks/2026-09-12T22-28-44.771Z-node-kind-lookup-comparison.json)
mejoró el reemplazo de raíz grande, pero añadió pequeños costos en otros casos.
Se eliminó una búsqueda duplicada al confirmar el tipo durante activación.

La [comparación final](../benchmarks/2026-09-12T22-41-36.736Z-node-kind-lookup-comparison.json)
muestra estos cambios de mediana frente al código base:

| Operación | Tamaño | Base ms | Final ms | Cambio |
|---|---:|---:|---:|---:|
| Construcción | 25 | 10,409 | 10,624 | +2,1% |
| Construcción | 250 | 36,759 | 37,078 | +0,9% |
| Construcción | 1.000 | 106,586 | 107,361 | +0,7% |
| Insertar 100 comentarios | 1.000 | 0,561 | 0,482 | −14,0% |
| Reemplazar raíz 100 veces | 1.000 | 3,798 | 3,097 | −18,4% |

Los restantes casos medidos varían entre aproximadamente −1,1% y +2,2%.
La mejora es específica de los recorridos medidos; dos rondas en un único host
son evidencia finita y no garantizan una mejora universal ni ausencia de toda
regresión. El JSON conserva también p95, mínimos, máximos y controles jsdom.

El [Memcheck completo](../memory/2026-09-12T22-43-44.963Z-valgrind.json) pasó
los **130 tests Rust** en 416,65 segundos, con cero errores y cero pérdidas
definitivas o indirectas. Permanecen visibles 48 bytes posibles y 544 alcanzables
de std/libtest, sin supresiones.

La validación integral aprobó **130 tests Rust, 472 contratos Node, 7 Jest,
18 Vitest y 26 en pools VM**, además de 1.784 casos HTML5 comparables. El
[reporte WPT](../compatibility/2026-09-12T22-50-34.068Z-linux-wpt.json) conserva
43.708 casos en paridad: 42.678 aprobados por el estándar y 1.030 fallos
compartidos. El bootstrap bloqueado de Range-deleteContents permanece declarado.

El [estrés de memoria](../memory/2026-09-12T22-53-48.794Z-linux-x64.json) pasó
en cinco modos, sin supervivientes de los documentos y ventanas observados:
882 en rustdom y 880 por modo Vitest. Los deltas de heap/RSS fueron
2,58/19,22 MiB en rustdom, 3,80/39,68 MiB en Vitest normal y 3,45/88,23 MiB en VM.
Se mantienen las observaciones de nodos/rangos y las referencias externas
del estrés; estas pruebas finitas no demuestran ausencia absoluta de fugas.

El paquete con SHA-256
`e53938ce5d0eecb0bea9fa2a037f13fdcf4ec14f0ac4d4168c7bde133460d7c4`
pasó **18 controles** en [Node 24](../distribution/2026-09-12T22-49-42.408Z-linux-x64.json)
y **18 en Node 22.12** [en este reporte](../distribution/2026-09-12T22-50-02.001Z-linux-x64.json).
