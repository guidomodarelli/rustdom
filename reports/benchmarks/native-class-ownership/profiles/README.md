# Perfiles de la carga pública de Range

Se conservan cuatro workers A B B A por versión del método. A usa checkpoint
67 y B el candidato de ownership; ambos conservan la misma operación pública,
fixtures, tres warmups y nueve muestras por tamaño. Son diagnósticos con CPU
profiler/tracing, separados de los tiempos de aceptación originales.

## Métodos y evidencia

`v1/` conserva los perfiles completos, fuentes y la prueba de capacidad. Node
22.12.0 generó entradas Performance API, pero no eventos usertiming en esas
trazas. No permite atribuir GC a los intervalos de operación.

`v2/` exporta 24 marcas por worker y seis pares de calibración hrtime/performance.
Las 18 duraciones medidas por worker coinciden exactamente con los datos crudos.
La intersección de calibración, incluyendo el margen de timestamp, tiene entre
2,379 y 2,465 microsegundos de ancho. Se incluyen también márgenes en los extremos
de los eventos antes de calcular intersecciones garantizadas y posibles.

El resultado vigente es `v2/analysis-wall.json`: ninguna de las 72 muestras
medidas se superpone con GC del thread principal; 69 se superponen con intervalos
de compilación de fondo tanto con el límite garantizado como con el posible.
Hay intervalos en referencia y candidato. Esto documenta actividad de V8
superpuesta, sin demostrar que todo ese intervalo fue CPU ejecutada ni que el
guard causó o resolvió una diferencia de tiempo.

El `v2/analysis.json` anterior queda **rechazado para inferencias de CPU**. La
revisión encontró `tdur > dur` en eventos reales y cotas invertidas. Sus campos
de CPU no son válidos. El analizador rechazado y los datos originales permanecen
intactos; `diagnostic-evidence.json` identifica el reemplazo. El análisis vigente
reporta las cotas de CPU como `null` y `valid=false`.

Las trazas y CPU profiles se conservan en gzip sin pérdidas, con tamaños y
hashes originales/comprimidos. `verify-diagnostics.cjs` comprueba su integridad
y recalcula el análisis vigente directamente desde los archivos comprimidos.

## Conclusión y límites

La GC no explica la dispersión de estos perfiles concretos. La compilación
superpuesta es un factor a considerar al interpretar la carga, que crea un
JSDOM nuevo por muestra antes del cronómetro. Atribuirle todo el +9,41% original
sería una inferencia no demostrada. Estos perfiles no aprueban ese presupuesto
ni se añaden a las muestras del A/B original.

El microdiagnóstico `native-copy/` aísla el camino class-return modificado y
comprueba su coste y ownership por separado. Tampoco sustituye la operación
pública, las factories de realm ni la medición completa de runners.
