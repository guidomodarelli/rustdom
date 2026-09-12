# Preflight de surroundContents en Rust

Los nodos parcialmente contenidos son los ancestros de exactamente uno de
los extremos, por debajo del ancestro común. Rust recorre esos dos caminos
para detectar nodos distintos de Text, evitando inspeccionar todo el subárbol.
Después valida el tipo del contenedor nuevo. La API nativa comprueba primero
que los tres handles tengan topología asignada, sin activar reservas.

Se conserva el InvalidStateError antes del InvalidNodeTypeError, el realm
del Range y la exclusión de CDATA de los nodos Text aceptados. Text, Comment,
PI y Attr no se rechazan anticipadamente como si fueran tipos prohibidos:
sus errores de jerarquía posteriores mantienen las mutaciones que ya produjo
el driver original. Extracción, vaciado, inserción y selección siguen pasando
por sus hooks actuales.

Pasaron formato, Clippy, **96 tests Rust y nueve contratos focales Node** de
contenido y surround. Los casos ejercen éxito, contenedores con hijos previos,
tipos rechazados, nodos parcialmente contenidos, errores entre realms,
mutaciones anteriores a fallos tardíos y rechazo de handles sin mutación.
La cobertura XML de CDATA también forma parte de la validación general.

La validación general pasó **96 tests Rust, 292 contratos Node, 7 Jest,
11 Vitest, 4 VM y 1.784 casos comparables HTML5**. El
[corpus ejecutable](../compatibility/2026-09-12T13-16-21.795Z-linux-wpt.json)
conserva los 43.708 casos en paridad y los 1.030 fallos compartidos; el
bootstrap WPT bloqueado sigue separado y no se considera cobertura completa.

El [Memcheck de Range](../memory/2026-09-12T13-13-40Z-range-surround-valgrind.log)
pasó 28 tests sin errores ni pérdidas definitivas o indirectas. Los 48 bytes
posibles y 544 alcanzables del runtime permanecen visibles sin supresiones.

El [estrés de cinco modos](../memory/2026-09-12T13-15-22.954Z-linux-x64.json)
incluye contenedores creados por surroundContents. Rustdom libera 4.500 nodos/
fragmentos/contenedores, 1.500 rangos observados y 3.500 estados nativos.
Cada modo Vitest libera 1.760 nodos/contenedores y 1.760 rangos observados,
con 3.520 estados nativos creados y destruidos. No sobreviven documentos ni
ventanas observados. Rustdom registra heap +2,32 MiB y RSS +19,27 MiB tras
GC; no se confunden estas variaciones con memoria pico ni con una garantía
absoluta de ausencia de toda fuga posible.

La distribución pasa sus 18 gates npm/pnpm tanto en
[Node 24](../distribution/2026-09-12T13-17-26.729Z-linux-x64.json) como en
[Node 22](../distribution/2026-09-12T13-19-27.911Z-linux-x64.json), con el
mismo archivo SHA-256
`d0041894f8592dd4f3fb8f70657e7d9b29ad8c2debd23a94be7ed7c15ca717b7`.

El [benchmark aislado](../benchmarks/2026-09-12T13-25-37.136Z-linux-x64.json)
mide la operación pública completa, incluyendo sus hooks y cambios del árbol.
Verifica identidad de la tabla movida, eliminación del contenido previo del
contenedor, texto y selección final; conserva muestras y hashes por motor.

| Filas | jsdom mediana (ms) | rustdom mediana (ms) | jsdom/rustdom |
|---|---:|---:|---:|
| 250 | 4,554 | 7,850 | 0,58× |
| 1.000 | 17,157 | 35,030 | 0,49× |

En este escenario rustdom tarda aproximadamente 1,7–2,0 veces más que jsdom.
La reducción del recorrido de preflight no elimina el costo de las mutaciones
y del puente; este hito migra la decisión a Rust y conserva compatibilidad,
pero no acredita una mejora del tiempo total. Los resultados comparan motores,
no aíslan el efecto del cambio frente al checkpoint anterior.
