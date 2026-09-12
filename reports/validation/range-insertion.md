# Geometría de Range.insertNode en Rust

Rust elige el padre y la referencia de inserción a partir del estado nativo
del Range. Devuelve un plan temporal sin ownership de nodos. La validación
de jerarquía, splitText, retiro e inserción mantienen el orden de los hooks
existentes. Una segunda consulta calcula el offset después de splitText y
removeChild, porque sus callbacks pueden modificar el árbol y el fragmento.
El driver comprueba el estado collapsed después de insertBefore, como antes.

Se conserva el realm del nodo insertado para Invalid start node, la diferencia
entre Text y CDATA, los errores tardíos de jerarquía y los índices JavaScript
no integrales. La API cruda rechaza handles no asignados antes de cualquier
decisión, sin consumir reservas ni modificar el árbol.

Pasaron **4 tests Rust focales**, Clippy y **10 contratos Node** de inserción
y surround. Los contratos incluyen 120 combinaciones de extremos y nodos,
MutationObserver, rangos vivos, UTF-16 con sustitutos aislados, realms distintos,
XML, identidad de nodos y callbacks síncronos de estilos que modifican el
tamaño del fragmento y la posición de referencia. El primer test Rust de
movimiento falló con AlreadyAttached: se corrigió la preparación para llamar
a remove antes de append, tal como requiere el contrato del árbol nativo.
No fue necesario cambiar la implementación para ese fallo del escenario.

El [Memcheck de Range](../memory/2026-09-12T13-40-00Z-range-insertion-valgrind.log)
pasó **32 tests**, con cero errores y cero bytes perdidos definitiva o
indirectamente. Los 48 bytes posibles y 544 alcanzables de std/libtest quedan
visibles sin supresiones. Los planes solo transfieren handles y offsets:
no registran instancias ni mantienen ownership adicional de nodos o ventanas.

La validación general pasó **100 tests Rust, 297 contratos Node, 7 Jest,
11 Vitest, 4 VM y 1.784 casos HTML5 comparables**. El
[WPT ejecutable](../compatibility/2026-09-12T13-42-48.391Z-linux-wpt.json)
mantiene 43.708 casos en paridad, con 42.678 aprobados según el estándar y
1.030 fallos compartidos. El bootstrap de range-deletion sigue bloqueado por
el error CDATA del jsdom fijado; no se cuenta como aprobado ni como prueba de
compatibilidad completa.

El [estrés en cinco modos](../memory/2026-09-12T13-47-24.499Z-linux-x64.json)
también pasó. Rustdom libera los 5.500 nodos/fragmentos observados, 1.500
rangos y los 3.500 estados nativos creados. Cada modo Vitest libera 2.640
nodos/fragmentos, 1.760 rangos y 3.520 estados nativos. No sobreviven los
documentos ni ventanas observados. En rustdom el heap queda +2,39 MiB y
el RSS +22,21 MiB después de GC; son medidas de memoria retenida del proceso,
no memoria pico ni una prueba de ausencia absoluta de toda fuga posible.

Los 18 gates de instalación npm/pnpm pasan en
[Node 24](../distribution/2026-09-12T13-48-33.719Z-linux-x64.json) y
[Node 22](../distribution/2026-09-12T13-50-43.554Z-linux-x64.json).
Ambos ejercen el mismo archivo SHA-256
`a529dc56f3ad324061a754595db82ff528ee76d878629bfb003dca04d936c139`.
Incluyen tipos, consumidores CommonJS/ESM, workers, Jest y Vitest normal/VM.

El [benchmark aislado](../benchmarks/2026-09-12T13-53-59.905Z-linux-x64.json)
ejecuta 100 inserciones públicas de filas preparadas sobre un Range situado
en medio del tbody. La preparación queda fuera del tiempo; después comprueba
identidad y orden de las 100 filas, los extremos, el total de filas y el digest
del documento completo en ambos motores. Se conservan 18 muestras por motor.

| Filas iniciales | jsdom mediana (ms) | rustdom mediana (ms) | jsdom/rustdom |
|---|---:|---:|---:|
| 250 | 1,583 | 2,504 | 0,63× |
| 1.000 | 4,285 | 5,642 | 0,76× |

Rustdom tarda aproximadamente 1,58 y 1,32 veces más en este patrón. La decisión
ya se ejecuta en Rust, pero el costo total sigue incluyendo hooks y cruces del
puente. Esta comparación entre motores no aísla el efecto del cambio frente
al checkpoint anterior ni permite afirmar una mejora del tiempo total.
