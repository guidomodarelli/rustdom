# Ajustes de rangos vivos por mutaciones en Rust

Los cálculos de extremos para CharacterData, splitText, inserción, eliminación
y normalize se ejecutan sobre snapshots del estado canónico de Rust.
Rust aplica los offsets y devuelve flags solo cuando cambia la identidad de un
nodo. El puente conserva la enumeración de referencias débiles vivas y actualiza
esas referencias con los hooks existentes, antes de volver a exponer el Range.
Los planes numéricos de consulta permanecen disponibles sin mutar el estado.
Ningún préstamo Rust permanece durante callbacks.

Se preservan el orden particular de replaceData (extremos dentro del tramo
antes de extremos posteriores), las fases separadas de splitText/remove,
los guards posteriores a callbacks de normalize y el conjunto de rangos
originalmente recorrido. El comportamiento fijado de _insert que puede mover
un extremo de otro nodo según su offset queda cubierto explícitamente.

La primera implementación transfería un array de planes por rango. Pasaron
cuatro tests Rust focales y Clippy; también **27 contratos Node** de
mutaciones, inserción, contenidos, CharacterData y normalización. Los nuevos
casos ejercen 12 mutaciones sobre 100 rangos vivos y sus clones, StaticRange,
MutationObserver, texto UTF-16 y planes crudos con entradas inválidas.

El [Memcheck de Range](../memory/2026-09-12T14-11-00Z-range-mutations-valgrind.log)
pasó **36 tests**, con cero errores y cero pérdidas definitivas o indirectas.
Los 48 bytes posibles y 544 alcanzables de std/libtest permanecen visibles,
sin supresiones. La prueba ESM conserva 3.000 planes mientras exige liberar
2.001 estados nativos y cinco árboles; este control pasó en la suite Node.
Son pruebas finitas y no equivalen a una garantía universal de ausencia de fugas.

La validación completa de esa primera implementación pasó **104 tests Rust, 302 contratos Node, 7 Jest,
11 Vitest, 4 VM y 1.784 casos HTML5 comparables**. El
[corpus WPT ejecutable](../compatibility/2026-09-12T14-12-28.130Z-linux-wpt.json)
mantiene 43.708 casos en paridad: 42.678 aprobados según estándar y 1.030
fallos compartidos. El bootstrap CDATA bloqueado sigue declarado aparte y
la cobertura no se presenta como completa.

El [estrés de cinco modos](../memory/2026-09-12T14-17-24.901Z-linux-x64.json)
libera todas las referencias observadas y vuelve a los contadores nativos
iniciales. Rustdom registra heap +2,39 MiB y RSS +19,62 MiB; Vitest normal
y VM registran RSS +0,47 y +4,90 MiB. Estas medidas corresponden a memoria
del proceso después de GC y no a memoria pico.

El control de planes retenidos pasó tanto en
[Node 24](../memory/2026-09-12T14-16-00Z-range-mutation-plans-esm-node24.json)
como en [Node 22](../memory/2026-09-12T14-16-00Z-range-mutation-plans-esm-node22.json):
3.000 planes permanecen vivos mientras se liberan los 2.001 estados y los
cinco árboles observados. El control retenido primero impide aceptar el GC.

La distribución pasa 18 gates npm/pnpm en
[Node 24](../distribution/2026-09-12T14-18-33.400Z-linux-x64.json) y en
[Node 22](../distribution/2026-09-12T14-20-58.827Z-linux-x64.json), sobre el
mismo paquete SHA-256
`f27a5ce8c753e9e4f9d7f43cd0e2c886353b468f36a3b214ff0b04da03a9b754`.
Los consumidores CommonJS y ESM ejercen las nuevas operaciones además de
workers, Jest y Vitest normal/VM.

El [primer benchmark](../benchmarks/2026-09-12T14-25-28.317Z-linux-x64.json)
reveló que esa ruta de transferencia de planes tardaba 245–251 ms en los
ciclos de CharacterData y 405–409 ms en los del árbol, frente a 14,6–14,8 y
21,3–22,1 ms de jsdom. Ambos workloads mantienen 1.000 rangos y consumen
offsets intermedios, además de verificar todos los extremos finales.

Por ese resultado se implementó la aplicación directa de offsets dentro de
Rust. Evita serializar planes a JavaScript y volver a escribir los mismos
offsets por N-API. Solo los cambios de nodeID requieren actualizar ownership
en el puente. El candidato pasó **5 tests Rust focales, Clippy y 33 contratos
Node**, incluidos GC, snapshots, movimientos de nodos y errores atómicos.
Las validaciones de 104/302 tests y el paquete f27 anteriores corresponden
al primer candidato; la evidencia de la ruta optimizada se registra por separado.

La [repetición aislada con aplicación directa](../benchmarks/2026-09-12T14-39-16.652Z-linux-x64.json)
conserva exactamente los dos workloads y sus verificaciones:

| Operación | Filas | jsdom mediana (ms) | rustdom mediana (ms) | jsdom/rustdom |
|---|---:|---:|---:|---:|
| CharacterData, 100 pares | 250 | 14,058 | 69,246 | 0,20× |
| Árbol, 100 pares | 250 | 20,950 | 77,867 | 0,27× |
| CharacterData, 100 pares | 1.000 | 14,271 | 69,162 | 0,21× |
| Árbol, 100 pares | 1.000 | 21,461 | 74,443 | 0,29× |

Las medianas de rustdom bajan aproximadamente 3,5–3,6 veces para texto y
5,3–5,4 para árbol frente al primer candidato medido. Es una comparación de
dos implementaciones experimentales en la misma máquina, con hashes de código
y muestras conservados; no es una comparación contra el checkpoint anterior.
El motor todavía tarda aproximadamente 3,5–4,9 veces más que jsdom en este
escenario de 1.000 rangos simultáneos, por lo que rendimiento integral sigue abierto.

El [Memcheck del candidato optimizado](../memory/2026-09-12T14-40-00Z-range-mutation-apply-valgrind.log)
pasó **37 tests de Range**, con cero errores y cero pérdidas definitivas o
indirectas. Los mismos 48 bytes posibles y 544 alcanzables del runtime siguen
visibles sin supresión. La validación general de este candidato pasó sus
**105 tests Rust** y está registrada separadamente de los resultados iniciales.

La validación completa de la aplicación directa pasó **105 Rust, 303 Node,
7 Jest, 11 Vitest, 4 VM y 1.784 casos HTML5 comparables**. El
[WPT final](../compatibility/2026-09-12T14-45-55.468Z-linux-wpt.json)
conserva los 43.708 casos ejecutables en paridad, con las mismas diferencias
compartidas y el bootstrap bloqueado explícito. Estos son los gates funcionales
del candidato optimizado; los anteriores permanecen como evidencia experimental.

El [estrés final en cinco modos](../memory/2026-09-12T14-50-02.309Z-linux-x64.json)
también pasó con aplicación directa: todas las referencias observadas se
liberan y los contadores nativos vuelven al inicio. Rustdom registra heap
+2,39 MiB y RSS +18,65 MiB tras GC; Vitest normal y VM registran RSS +0,25 y
+6,03 MiB. Estos son los resultados finales de retención del proceso,
manteniendo los límites de las pruebas finitas descritos anteriormente.

El paquete final de aplicación directa pasa 18 gates npm/pnpm tanto en
[Node 24](../distribution/2026-09-12T14-51-26.158Z-linux-x64.json) como en
[Node 22](../distribution/2026-09-12T14-55-10.439Z-linux-x64.json), con SHA-256
`c948bd148456a2427ca94d8c40c1d8d1ea89446b40a0e8fabba8b14c7c34609f`.
Los consumidores ejercen applyCharacterData/applyTreeMutation y los nuevos
enums con imports CommonJS y ESM reales. El control de 3.000 planes retenidos
también pasa de nuevo en
[Node 24](../memory/2026-09-12T14-50-00Z-range-mutation-apply-esm-node24.json) y
[Node 22](../memory/2026-09-12T14-50-00Z-range-mutation-apply-esm-node22.json):
se liberan los 2.001 estados y cinco árboles observados en cada runtime.
