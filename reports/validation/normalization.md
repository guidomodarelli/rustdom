# Planificación de normalización en Rust

Rust captura candidatos Text en orden inclusivo, vuelve a leer cada candidato
después de las mutaciones anteriores y agrupa/concatena sus siblings Text.
Los planes sólo contienen IDs, longitud y datos; no guardan wrappers ni caches.
El driver de JavaScript conserva replaceData, ajustes de rangos y remociones,
incluyendo su orden relativo a callbacks. Es una etapa parcial de la migración
de normalize; esas responsabilidades todavía no se consideran nativas.

Se preserva la particularidad de jsdom al normalizar un Text conectado con
siblings previos: el valor propio precede a los datos concatenados. La lista de
remociones se captura antes de replaceData, pero los siblings e índices para
rangos se leen después de sus hooks. Un callback real de VirtualConsole que
agrega texto durante un error CSS verifica esa diferencia temporal.

El primer fixture usó un comentario CSS incompleto, que el parser actual acepta
sin emitir el callback esperado. Se cambió a una llave de cierre inesperada
tras inspeccionar @acemir/cssom; se conserva la assertion que exige reentrancia
real. No se cambió producción para acomodar ese fixture.

Pasaron formato, Clippy, los 65 tests Rust y los tres contratos públicos. El
[foco WPT](../compatibility/2026-09-12T06-34-15.544Z-linux-wpt.json) pasó las
cuatro aserciones upstream. La validación completa, benchmark y memoria se
registrarán al terminar sus ejecuciones.

La validación completa pasó **65 tests Rust, 243 contratos Node, 7 Jest,
11 Vitest, 4 VM y 1.784 casos HTML5**. Los
[3.529 WPT](../compatibility/2026-09-12T06-42-48.848Z-linux-wpt.json) mantienen
paridad (3.521 aserciones de estándares aprobadas y ocho fallos compartidos).

El [benchmark inicial](../benchmarks/2026-09-12T06-45-47.703Z-linux-x64.md)
conserva una regresión frente a jsdom:

| Escenario | Filas | jsdom | rustdom | Ratio |
| --- | ---: | ---: | ---: | ---: |
| Textos separados | 250 | 4,660 ms | 7,918 ms | 0,59× |
| Textos aislados | 250 | 0,816 ms | 2,043 ms | 0,40× |
| Textos separados | 1.000 | 17,450 ms | 30,117 ms | 0,58× |
| Textos aislados | 1.000 | 3,688 ms | 7,844 ms | 0,47× |

Construcción, división del texto y GC quedan fuera del tiempo medido. Se
verifican texto completo, un Text por anchor y hashes de serialización; cuatro
procesos alternan motores y preservan todas las muestras. No se presenta la
migración de planificación como una aceleración.

El [estrés](../memory/2026-09-12T06-47-54.933Z-linux-x64.json) normaliza
500 clones y observa 20.000 Text adicionales que serán removidos. Pasó en ambos
motores con cero supervivientes de Document/Window y los nodos observados.
Rustdom registró heap +1,83 MiB y RSS +11,68 MiB. El
[paquete instalado](../distribution/2026-09-12T06-49-15.657Z-linux-x64.json)
pasó sus 18 controles con npm y pnpm.

El [Memcheck focal](../memory/2026-09-12T06-53-40Z-normalization-valgrind.log)
pasó las tres pruebas de planificación sin errores ni pérdidas definitivas o
indirectas. Los 48 bytes posibles y 544 alcanzables del runtime siguen visibles,
sin supresiones. Es una verificación focal del ejecutable Rust, complementada
por GC del addon real; no prueba ausencia absoluta de toda fuga.
