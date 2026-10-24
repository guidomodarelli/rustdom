# Diagnóstico con el contexto completo de las cargas

Estado: preparación. No hay secuencia ejecutada con este método, aceptación de
rendimiento ni cambio al runtime de producción. El diagnóstico anterior sigue
terminado; no se repite ni se combina con esta secuencia.

## Pregunta y fundamento

El estudio C completo registró siete de ocho primeros lotes más lentos en jsdom
Node22 A/A range-control-1000/250. El contraste de una sola fila no reprodujo ese
patrón: cuatro de ocho en ambos modos Node22 y tres de ocho en ambos Node24.
El contraste había omitido las siete filas restantes del contexto original.

Un análisis offline adicional incluye los 1.024 lotes y 9.216 muestras de C,
reproduciendo sus medianas y aceptación originales. En el caso citado, la mediana
descriptiva de la razón entre medianas de las primeras/últimas tres muestras es
+5,269491% en el primer lote y +0,094076% en el segundo, con rangos amplios.
Los warmups no se registraron: esto no demuestra que tres sean suficientes o
insuficientes ni explica por sí solo la diferencia entre lotes.

La pregunta prospectiva es si, conservando todo el contexto original, compartir
el módulo de las cargas produce diferencias observables de orden y trazas frente
a dos módulos de código idéntico independientes. No se modifica la carga medida
ni se atribuye causalidad a coincidencias entre trazas y lotes.

## Casos y secuencia fijados

Se seleccionan antes de medir las posiciones históricas 0 y 4. Mantienen paquetes
físicos J0/J1 y carga A/B; difieren únicamente en orden de lotes. En la fila
citada de C, posición0 dio −5,472932% primero/segundo y posición4 +32,533273%.
Se incluye así un caso con el patrón y otro sin él, manteniendo iguales los
otros factores. No se selecciona el caso de mayor diferencia.

Una única secuencia, Node22.12.0 y después Node24.14.1. Por Node:

1. shared/posición0;
2. independent/posición0;
3. independent/posición4;
4. shared/posición4.

Cada proceso ejecuta las ocho filas originales, en su orden original, con los
dos lotes por fila, tres warmups y nueve muestras. Total: ocho procesos, 128 lotes
y 1.152 duraciones medidas. El brazo que lidera se balancea entre posiciones.
No se generaliza a las ocho combinaciones factoriales ni se calcula aceptación.

Se mantienen los dos jsdom27.4.0 independientes y sus pins; los 53 archivos
del harness son idénticos entre brazos. Se mantienen afinidad del principal a
CPU2, hilos auxiliares con máscaras más amplias, GC y todos los checks públicos
originales. Cada fila debe producir el mismo checksum en ambas etiquetas,
brazos y procesos; no basta comprobar la primera fila.

## Trazas, recursos e identidad

Los flags son los mismos del contraste aislado: --expose-gc --trace-opt
--trace-deopt --trace-file-names. Los marcadores delimitan lotes completos,
incluyendo preparación, warmup, comprobaciones y limpieza. No permiten ubicar
eventos dentro del cronómetro ni identificar funciones anónimas sin más datos.

Se conservan tres rondas y dos endpoints finales claros por lote, observando
Window y Document por separado. Se comprueban 1.536 WeakRef por tipo, incluyendo
warmups. Solo se ejecuta jsdom; no se cargan ni miden recursos nativos Rust.
No son mediciones de memoria pico ni garantía universal de ausencia de fugas.

El driver conserva estados parciales, stdout/stderr completos, paquetes,
fuentes congeladas, muestras y resultados de todas las filas. Una falla detiene
la secuencia sin reiniciar y conserva lo disponible. No hay repeticiones según
el resultado ni cambios a umbrales, estimadores o aceptación de los estudios
anteriores. El método debe publicarse, pasar contratos Node22/24 y obtener
revisión local completa antes de ejecutar; registrar SHA, huella y recibo.
La revisión remota sigue requerida para el merge del hito.

El worker/driver compartido conserva por defecto el diagnóstico aislado. Esta
receta tiene revisión, entrada y alcance de fuentes propios; el verificador y
snapshot históricos no cambian. El protocolo previo es un documento congelado
de preparación, no una instrucción para volver a ejecutarlo.

```sh
node reports/benchmarks/native-class-ownership/runner-sharing-context-diagnostic.cjs \
  /ruta/manifest.json /ruta/salida-nueva /ruta/provenance.json
```
