# Contraste hosted completo: verificado, sin aceptación

El [run 39721610003](https://github.com/guidomodarelli/rustdom/actions/runs/39721610003)
terminó con el protocolo publicado en `56825a50535b28d3c6ba082de1a81153c21b94ed`.
Ambos Node completaron sus 32 procesos; los 64 workers terminaron con exit 0.
Los dos drivers devolvieron exit 1 por presupuesto, sin errores de ejecución.
Se conservan las 9.216 duraciones, sin filtrar muestras o filas.

El artefacto oficial `12402457156` está completo en `artifact-12402457156.zip`:
40.535.613 bytes, SHA-256
`526ec22b70bdee0c1cee824f3a1365cdd5beeba825c1c712eb332dc7674401d6`,
coincidente con el digest de GitHub. El tar interior tiene SHA-256
`8b05a1ea0b295723b136f9165e43362c03ab7a494185857acb0e6ad901d1d4a5`,
8.881 entradas y seis enlaces relativos verificados antes de extraer.
Conserva paquetes, dependencias, fuentes, procesos, stdout/stderr, muestras y endpoints.

Los verificadores congelados dentro del artefacto reprodujeron
`verified=true, accepted=false` en Node 22.12.0 y 24.14.1. También se recalculó
la preparación completa en ambos Node. Estas comprobaciones offline no ejecutaron
DOM, nuevos benchmarks ni compilaciones. El arnés conserva sus 373 archivos y SHA-256
`7ef509af5d2e5cf32bcb9ab059fd77e128d34c638028c482b315cdab480f4123`.

## Decisión original

Se mantienen ±2% para el control jsdom, ±5% para Rustdom A/A y +5% para Rustdom
A/B, todas las filas y ambos Node. A/A compara dos copias de checkpoint067;
en A/B, B identifica C. El control jsdom usa copias idénticas en ambas fases.

| Node | Fase | Filas calibradas | Rango de cambio Rustdom |
| --- | --- | ---: | ---: |
| 22.12.0 | A/A | 5/8 | +0,07% a +3,24% |
| 22.12.0 | A/B | 5/8 | −11,91% a +2,20% |
| 24.14.1 | A/A | 6/8 | −1,85% a +0,69% |
| 24.14.1 | A/B | 8/8 | −3,85% a +0,65% |

Todas las diferencias puntuales Rustdom A/A están dentro de ±5%, y ninguna
diferencia A/B supera +5%. Node 24 A/B calibra las ocho filas y las ocho cumplen
el presupuesto. La aceptación global sigue siendo falsa: A/A no calibra
completamente en ningún Node y A/B no calibra completamente en Node 22.
No se usa el subconjunto calibrado para aceptar el hito.

El control `range-state-lifecycle-1000/250` de Node 22 A/A cambia +12,41% aunque
el candidato C no interviene en esa comparación. La diferencia Rustdom de −11,91%
en Node 22 A/B aparece en una fila sin calibrar y no se presenta como una mejora
atribuible. Estos resultados no prueban que el cambio de host o afinidad resuelva
la calibración; tampoco identifican una regresión causada por el guard.

El host fue AMD EPYC 9V74, cuatro vCPU, Linux 6.8.0-1070-azure. Se usaron los
paquetes oficiales preparados en el run 39720077911, sin reconstruirlos.
Difieren de los binarios locales de estudios anteriores; esos datos no se mezclan.
La implementación medida sigue siendo híbrida, con las rutas Rust y JavaScript de C.

Las 32 filas completas, con tiempos y precisión original, están en `rows.csv`
y `analysis.json`; el ZIP conserva cada muestra. `analyze.py` recalculó
independientemente las medianas agrupadas de todos los samples y coinciden con
el verificador congelado. `process-rows.json` conserva 512 razones descriptivas
por proceso/fila y sus factores. No reemplazan el estimador ni establecen causalidad.

## Recursos

El método y sus assertions validan 12.288 referencias de Window y otras tantas
de Document en los fixtures, incluidas las de warmup. Los 4.096 endpoints finales
exigidos están claros y satisfacen los baselines nativos mediante el verificador
original. Se conservaron también los 91 endpoints inicialmente no claros de las
primeras rondas; no son 91 objetos distintos ni fugas persistentes. Las 6.144
observaciones completas permanecen en los reports originales.

Heap JavaScript, memoria externa y RSS son observaciones después de limpieza,
del proceso con dos paquetes del mismo motor. No aíslan A/B, no son picos ni
prueban ausencia universal de fugas. `analysis.json` conserva sus rangos sin
alterar las trazas. Los metadatos oficiales, el log y los comandos/salidas
offline están junto al ZIP. La preparación conserva el UUID y las huellas
A/C/jsdom/dependencias publicadas antes de medir.

## Continuación

El ensayo está terminado y no se repite. No hay merge ni checkpoint de ownership.
Antes de medir otra vez se requiere una hipótesis y un método distintos, revisados
y publicados, que mantengan ambos Node, las ocho cargas y los presupuestos.
Una hipótesis a evaluar es retirar del sampler la carga de dos paquetes en el
mismo proceso; todavía no se adopta como solución ni se atribuye a ella la
variación observada. La prioridad sigue siendo cerrar este hito antes de integrar
las fases de implementación pendientes.
