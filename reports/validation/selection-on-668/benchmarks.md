# Selection sobre 668: rendimiento y perfil

Reporte comparable: `reports/benchmarks/2026-09-15T20-37-38.447Z-linux-x64.json`.
Fuentes `2b6eb990f1b0f7dfc339ee26e7cef47868fcf79a4a5f4041cd59c6d5985d80de`.
Addon `792e1c2dafb6eac8d70232daf892d3b62e3e968689d6a24e1ade08fde372c0b2`.

Mismo arnés y metodología del baseline DCE: cuatro procesos secuenciales en
orden alternado, tres warmups y nueve muestras por proceso, 18 por motor/caso.
Se verificaron valores, identidades y activación nativa fuera del intervalo.
El teardown drena las tareas reales de selectionchange fuera del tiempo medido.

| Operación | Cantidad | jsdom mediana ms | rustdom mediana ms | jsdom/rustdom |
|---|---:|---:|---:|---:|
| selection-read | 100 | 0.144 | 0.822 | 0.175 |
| selection-associate | 100 | 0.403 | 1.659 | 0.243 |
| selection-extend | 100 | 0.519 | 2.21 | 0.235 |
| selection-contains | 100 | 0.222 | 1.186 | 0.187 |
| selection-stringify | 100 | 0.057 | 0.175 | 0.329 |
| selection-read | 1000 | 0.787 | 6.703 | 0.117 |
| selection-associate | 1000 | 2.827 | 14.392 | 0.196 |
| selection-extend | 1000 | 4.292 | 20.42 | 0.21 |
| selection-contains | 1000 | 1.704 | 9.813 | 0.174 |
| selection-stringify | 1000 | 0.24 | 1.196 | 0.2 |

Los diez casos siguen siendo más lentos que jsdom. La integración de los fixes
no se presenta como una optimización de Selection ni se atribuye la variación
entre ejecuciones sólo al código. Los resultados anteriores permanecen guardados.

## Perfil diagnóstico

`profile.cjs` reutiliza los fixtures públicos y `benchmarks/analyze-cpu-profile.cjs`
para muestrear 20.000 operaciones tras tres warmups de 1.000, a intervalos
nominales de 100 microsegundos. Validación, preparación y drenaje quedan fuera
del perfil. Cada resultado fue comprobado con las mismas aserciones del benchmark.

Se conservaron los tres perfiles crudos y sus análisis con prefijos
`2026-09-15T20-41-27.870Z-selection-read`,
`2026-09-15T20-41-28.169Z-selection-associate` y
`2026-09-15T20-41-28.790Z-selection-stringify` en reports/benchmarks/.

El frame `_run` y las llamadas nativas dentro de él concentran 121,9 de 127,2 ms
inclusivos del frame de trabajo de lectura, y 253,2 de 261,1 ms
en asociación. Los getters de dirección y límites de Range aparecen como llamadas
anidadas; estos totales se superponen y no deben sumarse.

V8 muestra varios callbacks nativos con la etiqueta genérica `rangeInsertionPlan`
sin URL. Esa etiqueta no prueba que se esté ejecutando el algoritmo de inserción:
el perfil sólo identifica el borde JS/N-API, no los stacks Rust. El inspector
también ocupa una fracción importante, especialmente en stringificación. Sus
muestras permanecen visibles; no se usan estos perfiles para afirmar ratios
de velocidad ni para atribuir el tiempo a una función Rust concreta.

La próxima optimización debe medir el costo de los cruces y la devolución de
resultados de `_run`, preservando identidad, reentrada, excepciones primitivas
y ownership. Una modificación de ese borde necesita repetir los contratos, GC
y comparaciones; este perfil por sí mismo no justifica relajar compatibilidad.
