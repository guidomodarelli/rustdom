# Integración de restricciones de inserción con la base actualizada

La rama de inserción incorporó la cabeza de setters
`74833f46ec1cd4fdacacebb19668dc2a2f2935fd`, que ya contiene main
`402c7276430ba828db08097632cf7b044562702f` y las correcciones de entornos.
El merge local es `60e62d3fdc6a0af1980d660ab1bf14d80406ce3b`.

No hubo conflictos de código. Se resolvieron únicamente los siete informes
genéricos de validación; los informes históricos con timestamp se conservaron
y la ejecución actual regenera los resúmenes de la combinación.

Las fuentes nativas, sus tipos, el adaptador ESM y el parche de build son
idénticos a los del hito de inserción ya probado. Pasaron **125 tests Rust,
465 contratos Node, 7 Jest, 18 Vitest y 26 en pools VM**, además de 1.784
casos HTML5 comparables. El [reporte WPT](../compatibility/2026-09-12T21-05-00.358Z-linux-wpt.json)
mantiene 43.708 casos en paridad, con 42.678 aprobados por el estándar y
1.030 fallos compartidos. El bootstrap CDATA bloqueado sigue declarado.

El binario reconstruido tiene SHA-256
`ceb624fe164124d876cd5ca2dfe82d518e0a6317fedf3505f46c72c86049637f`,
idéntico al del hito de inserción anterior. Se conserva por ello el Memcheck
focal de ese módulo; se repiten la integración, memoria y distribución con
los entornos actualizados.

El [estrés de memoria combinado](../memory/2026-09-12T21-07-07.622Z-linux-x64.json)
pasó en cinco modos. rustdom liberó los 882 documentos y ventanas observados;
cada modo Vitest liberó 880 documentos y ventanas, incluidos fallos de
inicialización y referencias externas conservadas tras teardown.
Los deltas de heap/RSS fueron 2,55/18,35 MiB en rustdom,
3,79/28,03 MiB en Vitest normal y 3,43/39,77 MiB en VM.

El paquete integrado con SHA-256
`bac2345a003f9b5ce28511a6dee39531b25fa1fca3b479909ce5ff6eb985fa80`
pasó **18 controles** en [Node 24](../distribution/2026-09-12T21-03-38.804Z-linux-x64.json)
y **18 en Node 22.12** [en este reporte](../distribution/2026-09-12T21-03-55.000Z-linux-x64.json).

El [benchmark final de la combinación](../benchmarks/2026-09-12T21-09-59.628Z-linux-x64.json)
se ejecutó sin carga concurrente y conservó todos los contratos y hashes.

| Operación, 100 intentos | Comentarios previos | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| Insertar comentarios | 250 | 0,754 | 0,538 | 1,40× |
| Rechazar elementos duplicados | 250 | 2,752 | 2,699 | 1,02× |
| Insertar comentarios | 1.000 | 2,323 | 0,468 | 4,96× |
| Rechazar elementos duplicados | 1.000 | 4,476 | 2,596 | 1,72× |

El ratio es tiempo jsdom / tiempo rustdom. Las inserciones y el rechazo del
caso grande son más rápidos en estos patrones; el rechazo pequeño queda cerca
de la paridad. Las diferencias frente a ejecuciones históricas no se atribuyen
causalmente al merge y no representan una mejora universal de todas las APIs.
