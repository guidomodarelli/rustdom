# Diagnóstico de CPU y GC de Range

Después del A/B original y del A/A inconcluso se ejecutan cuatro workers
diagnósticos en orden A B B A, Node 22.12.0 y CPU 2. A carga checkpoint 67 y B
el mismo candidato ya validado. La carga pública es `range-control-1000`, con
los dos tamaños originales, tres warmups y nueve muestras. Se conservan las
assertions y hashes completos de salida del worker existente.

Una copia aislada del arnés agrega `performance.measure` después de detener
cada cronómetro, usando el inicio y la duración ya capturados. Se guardan sus
fuentes antes/después y hashes. Los módulos, el addon, sus opciones y el cuerpo
de la operación permanecen iguales. No se escribe dentro del runtime medido.

Se activan el CPU profiler de Node y las trazas V8/usertiming. Las marcas
permiten comprobar qué eventos de GC se superponen con cada operación. Antes
de interpretar intervalos se debe verificar que la duración de cada marca
coincida con el dato crudo del worker, contemplando el redondeo de timestamps.
Se conservan también warmups y eventos fuera del cronómetro.

Son perfiles con instrumentación y otra selección de cargas; no sustituyen
el A/B, no se suman a sus muestras ni prueban por sí solos cumplimiento del
presupuesto. Se ejecutan una vez. Su finalidad es orientar la investigación
del coste y de la dispersión, conservando fallos y resultados negativos.

## Revisión del método antes de correlacionar

Los cuatro workers de la primera versión terminaron y comprobaron salidas, pero
las trazas no contienen entradas usertiming. Una prueba de capacidad independiente
confirmó entradas Performance API existentes y ninguna marca/medida en tracing;
sí emitió eventos de console. Se conservan esos archivos como método sin
correlación válida y no se atribuye GC a una operación a partir de ellos.

La versión 2 conserva las marcas después del cronómetro y exporta las entradas
al JSON del worker. Verifica sus 24 intervalos y la igualdad de las 18 duraciones
medidas con los datos crudos. Registra tres pares de calibración al inicio y al
final: hrtime antes, performance.now y hrtime después. La intersección de esos
límites permite trasladar intervalos al reloj absoluto de la traza con incertidumbre
explícita. [Node 22 documenta la fuente común de reloj y las unidades](https://nodejs.org/download/release/v22.12.0/docs/api/tracing.html).

Se ejecuta una secuencia A B B A de esta versión corregida, sin cambiar binarios,
fixtures, cuerpo de la operación ni muestras de aceptación. Si los relojes no
permiten una calibración consistente, el diagnóstico se conserva como inválido;
no se repite hasta obtener una conclusión favorable.

## Corrección de la inferencia de CPU durante la revisión

El primer `analysis.json` calculaba cotas de CPU a partir de `tdur` y `dur`.
La revisión encontró eventos reales donde CPU supera pared (523/515 µs), y
una cota inferior mayor que la superior. Esos campos se rechazan; se preservan
el archivo y el analizador anterior, identificados en `analysisRevision` del
manifest. No se usan sus cifras de CPU para ninguna conclusión.

`analysis-wall.json` conserva solo intervalos de pared, con margen explícito
también en los timestamps de cada evento. Las cotas de CPU quedan nulas y
marcadas no válidas. Las trazas y los perfiles originales no cambian. El
verificador vuelve a calcular ese análisis desde los archivos comprimidos.
