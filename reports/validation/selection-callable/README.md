# Selection: invocabilidad de métodos Range

El baseline `7d3c5b3` con la devolución directa produjo `Error: Call Function
failed` cuando el método privado Range.toString o deleteContents no era invocable.
El jsdom independiente produjo TypeError con su diagnóstico intrínseco. La
reproducción inicial y el rojo de la matriz completa están conservados.

El controlador Rust lee el método una sola vez y verifica su tipo antes de
invocarlo. Para un valor no invocable, el adapter crea una vista inerte del valor
ya leído y deja que el motor genere el error con la expresión de referencia.
No consulta globalThis.TypeError ni vuelve a leer el getter real. Funciones,
clases y proxies invocables siguen pasando por la llamada nativa original.
No agrega referencias persistentes ni cambia los algoritmos de Selection.

## Contratos

Pasaron 31 tests en Node 22.12.0 y 24.20.0: Selection diferencial, API nativa,
registro de constructores y cuatro grupos nuevos. Estos últimos comparan 13
tipos de valor por tres variantes del global TypeError, dos métodos y dos
realms: 156 escenarios por motor. Incluyen funciones válidas, clases, proxies
invocables/no invocables/revocados, primitivas y objetos. Se comprueban errores,
realm, retorno, receptor real, una lectura del getter y cero hooks TypeError.

## Memoria

Se amplió cada fixture de memoria con 200 errores de método no invocable,
además de sus 100 ciclos de mutación. La primera ejecución Node22 falló porque
el chequeo del owner nativo exigía recolección tras exactamente dos GC.
El estado Rust sólo contiene un escalar; la observación posterior debía
comprobar liberación sin soltar ese estado, en vez de presuponer el turno exacto.

Se reutilizó la espera acotada existente: máximo 12 rondas, 10 segundos y dos
muestras consecutivas sin supervivientes. No se cambiaron esos límites ni el
criterio de cero DOM/errores. Mientras se mantiene el estado nativo, el baseline
esperado incluye exactamente esa única instancia; después se libera también.
La nueva traza Node22 muestra inicialmente Window/Document/Selection vivos y
luego todos en cero con native-state live=1, en default y VM. La liberación final
volvió al baseline completo. Los 14 escenarios pasaron en Node22 y Node24.

El fallo original `reports/memory/2026-09-15T21-53-42.087Z-selection.json` y los
resultados `2026-09-15T21-56-34.105Z-selection.json` / `21-56-36.317Z-selection.json`
permanecen guardados. Esta evidencia finita demuestra liberación observable;
no acredita ausencia absoluta de fugas ni recolección instantánea.

La validación general y de paquete anterior corresponde al baseline de esta
corrección. Falta validar el estado final junto con los fixes pendientes de PR67
y medir el costo del nuevo chequeo antes del checkpoint.

## Chequeos Rust y costo del guard

Pasaron cargo fmt --check, Clippy locked/all-targets y los dos tests Rust de
Selection. El benchmark de la ruta normal de stringificación usa los mismos
fixtures y valida valores antes de aceptar cada medición: cuatro procesos
secuenciales por comparación, 18 muestras por motor/tamaño y tareas drenadas
fuera del intervalo. Las fuentes y hashes de ambos addons están en los JSON.

Reportes 2026-09-15T22-17-54.991Z-linux-x64.json (baseline) y
2026-09-15T22-18-07.450Z-linux-x64.json (candidata) en reports/benchmarks/.
Para 1.000 operaciones, la mediana rustdom pasó de 1,205 a 1,388 ms (+15,2%).
El control jsdom subió 9,5%; normalizar por ese control deja aproximadamente
5,2%, sin demostrar una causa exclusiva. Los rangos se superponen.

Se conserva el guard por corregir el contrato de error. No se afirma una mejora
de velocidad ni que el costo sea universal. Los resultados anteriores de la
devolución directa pertenecen a la versión sin este chequeo y permanecen
identificados como tales; no se suman sus porcentajes entre experimentos.
