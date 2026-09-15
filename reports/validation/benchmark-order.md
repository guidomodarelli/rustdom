# CI: conservar la frontera sincrónica antes de los microtasks

El job 104247788419 del run 34927249644 (PR65, SHA39e9faba) falló en
slot-signal-burst/100: la cola nativa estaba vacía cuando debía contener 100
señales pendientes. El arnés ejecutaba `await blobWork?.validate(result)` en
todas las cargas. Incluso cuando blobWork era undefined, await cedía al loop y
permitía entregar los microtasks antes de comprobar esa cola.

La espera ahora se ejecuta únicamente cuando existe una fixture Blob. El orden
sincrónico de las demás validaciones se conserva, mientras FileReader sigue
validando todos los bytes de Blob fuera de la región medida. No se modifican las
aserciones de señales pendientes ni se agregan demoras artificiales.

[Los 15 tests del arnés](benchmark-order/tests.log) pasaron. La regresión nueva
ejecuta los motores reales para slot-signal-burst de 100 y 1.000 slots, conserva
sus muestras y ejercita la comprobación sincrónica y la entrega posterior. Los
tests también cubren particiones completas, deadlines y diagnósticos.

La comprobación adicional de los benchmarks Blob está en
`benchmark-order/blob-validation.log`; sus lecturas se realizan con FileReader.
Los resultados de estos controles son evidencia del arnés, no una nueva
afirmación de rendimiento del motor.
