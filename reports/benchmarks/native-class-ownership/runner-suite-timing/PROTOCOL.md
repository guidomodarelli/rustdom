# Tiempo completo de suites: receta previa a medir

Estado: método nuevo, sin ensayo ejecutado. Este entregable complementa los
microbenchmarks y no acepta ni reemplaza sus resultados rechazados. No agrega
código DOM migrado ni permite cerrar ownership por sí solo.

## Inputs y métricas

Usar exclusivamente la preparación de suites calificada en `53b4d225`, tar
SHA-256 `905f195308e58d038eab929b6905cdd6ae9752e482de6144f927b85a985e14dd`.
Fijar por SHA independiente su índice completo, sus dependencias, paquetes
A0/A1/B, adapters, fixtures, configs y diez fuentes del arnés original. No
reinstalar, reconstruir addons o adoptar otra preparación del CI. Verificar
todos los inputs antes y después de cada Node; conservar el recibo y snapshots.

Node22.12.0 y después24.14.1, Linux x64/WSL. Cada muestra es un CLI nuevo de
Jest, Vitest normal o Vitest con ambos pools VM. Mantener comandos, suites,
workers y probes de la calificación. Jest23, Vitest34 y VM36 tests completos,
sin skips, fallos o cambios de cantidad. Registrar el módulo nativo y dos
asignaciones Range por probe. No mockear bibliotecas de plataforma.

Abrir logs fuera del reloj y medir `hrtime.bigint()` inmediatamente antes y
después de `spawnSync` que ejecuta GNU Time y el CLI. Conservar nanosegundos
crudos y milisegundos: incluye lanzamiento del wrapper, Node, carga, suite,
teardown y espera/recolección del proceso. Excluye crear directorios, abrir o
cerrar logs, guardar índices, leer JSON, validar resultados y hashear inputs.
Los tiempos internos de los runners no sustituyen esta métrica.

GNU Time registra además elapsed, CPU usuario/kernel, RSS máximo, page faults
y context switches. Fijar `LC_ALL=C`, `CI=1`, `FORCE_COLOR=0` y las variables
de procedencia/cache del arnés. Registrar versión y hash de ambos Node y de
GNU Time, incluido su identificador de paquete si existe. En este host GNU
Time informa versión UNKNOWN y dpkg1.9-0.1build2; no presentarlo como1.10.
Comprobar los hashes de ejecutables después. No cambiar JIT, afinidad, energía
o GC, ni ejecutar builds, otras suites, compresión o perfiles locales durante
la captura. El host Windows y actividades ajenas no están bajo control total.

El RSS es el valor de GNU Time basado en getrusage: no es la suma simultánea
del árbol ni memoria retenida. En Linux, el máximo de hijos corresponde al
hijo de mayor RSS, no al pico concurrente de todos. CPU/RSS son descriptivos,
sin presupuestos nuevos derivados de ellos. No prueban liberación de Window
o Document ni ausencia de fugas. Referencias:
[GNU Time](https://www.gnu.org/software/time/manual/time.html) y
[getrusage de Linux](https://man7.org/linux/man-pages/man2/getrusage.2.html).

## Orden y replicación fijados

Por Node, primero tres rondas de warmups de cada uno de los tres paquetes y
cada runner:27 CLIs. Cada ronda rota el orden de runners y alterna el orden
de paquetes. Cada CLI crea otro proceso: esos warmups no calientan un isolate
V8 compartido. Sus datos quedan separados y no participan de la decisión.

Después ejecutar A/A y A/C, sin condicionar A/C al resultado de A/A. Cada fase
usa doce posiciones: producto completo de cuatro combinaciones de orden de
etiquetas/asignación física y tres rotaciones del orden de runners. Bit0 elige
AB/BA; bit1 intercambia A0/A1 en A/A y el baseline A0/A1 en A/C. La rotación
es floor(position/4). Cada runner lidera cuatro posiciones, cada orden de par
aparece seis veces y cada asignación física seis. Node24 recorre posiciones
en orden inverso. A/C siempre mantiene al candidato C en B.

Cada posición ejecuta las dos etiquetas adyacentes de cada runner, sin
concurrencia entre CLIs. Son144 CLIs medidos por Node,288 en total, más54
warmups:342 invocaciones de CLI y12 tiempos separados de CLI por celda. Cada
invocación también lanza GNU Time y puede crear workers del runner; el número
no representa todos los procesos del sistema. No se
presentan tests, workers internos o probes como réplicas adicionales. El orden
es fijo y no se afirma aleatorización ni independencia estadística poblacional.

## Presupuestos, errores y publicación

Para cada runner/Node/fase, usar la razón de medianas de los doce tiempos de
CLI por etiqueta:100*(medianaB/medianaA-1). A/A exige±5%; A/C admite como máximo
+5% y requiere que A/A de ese mismo runner/Node calibre. Las doce filas deben
pasar. El5% conserva el presupuesto Rust de operaciones para esta métrica
distinta; no se eligió a partir de una corrida de tiempos completos ni modifica
el±2% de jsdom o los límites de los experimentos anteriores.
Las medianas se conservan como enteros de dos veces nanosegundos y los límites
se comparan mediante productos enteros exactos. El porcentaje decimal es
descriptivo; no se añade un epsilon ni se rechaza un5% exacto por redondeo binario.

No eliminar muestras, usar tiempos internos para elegir otra decisión,
seleccionar filas o aumentar réplicas hasta pasar. Este método no compara un
jsdom puro: las suites contienen aserciones nativas internas. La paridad con
jsdom permanece en sus pruebas diferenciales y corpus independientes.

Un error de ejecución, recursos, JSON, tests, procedencia o identidad detiene
la secuencia y conserva lo parcial, sin reintentos. Un rechazo presupuestario
completo conserva todas las filas y no impide completar el segundo Node.
Publicar fuentes, receta, contratos y revisión antes de la única invocación.
El operador debe cotejar commit y archivos en Git/GitHub; un JSON con un SHA
no demuestra publicación. El CLI solo compara bytes con ese recibo.

Los contratos ejercitan procesos Node reales, fallos y aritmética. Antes de
medir, el modo de ejercicio debe ejecutar los tres paquetes y runners en
ambos Node:18 CLIs/558 tests, con el wrapper exacto. Estos datos califican el
registrador y nunca se incorporan al ensayo. Conservar también sus fallos.

Una aceptación, si ocurre, tiene alcance de tiempo total de estas suites en
este host. Los microbenchmarks siguen requiriendo resolución separada; no
hay merge, checkpoint ni cierre del objetivo global por este resultado solo.
