# Próxima observación: funciones optimizadas y deoptimizaciones

Estado: receta prospectiva; captura todavía no ejecutada. Antes de ejecutar,
publicar y revisar esta receta, fijar el launcher y sus fuentes y verificar
la preparación completa. No repetir las capturas anteriores.

La observación de identidades en Windows nuevos muestra funciones públicas
distintas entre muestras del mismo paquete. Las trazas previas registraron
eventos de optimización tras los warmups, pero no identidad de funciones o
deoptimizaciones. La pregunta siguiente es si el sampler o sus wrappers DOM
registran deoptimizaciones, con qué razones y ubicaciones de fuente. No se
asume que identidades distintas impliquen código compilado distinto.

Usar el worker original congelado en el arnés del ensayo 39735778846,
commit f5526bc1, sin derivar ni cambiar su cuerpo, ocho cargas, tres warmups,
nueve muestras, fixtures, temporizadores, validaciones, afinidad del hilo
principal y cleanup. Verificar las 387 fuentes y la preparación oficial
39720077911 antes y después. Conservar y autenticar el manifest local de
rutas sin modificar el manifest del ensayo original.

Una secuencia local: Node22.12.0 J0 y J1; después Node24.14.1 J1 y J0.
Son cuatro procesos, un paquete por proceso, 32 lotes y 384 ejecuciones de
muestra incluyendo warmups. No ejecutar Rustdom ni comparar A/B. Mantener
CPU2 solo para el principal como el sampler original. Sin builds, suites,
compresión u otros perfiles locales simultáneos.

Flags declarados: `--expose-gc --trace-opt --trace-deopt --trace-deopt-verbose
--trace-file-names`. Verificar su disponibilidad con `--v8-options` en ambas
versiones antes de ejecutar. No activar `--trace-events-enabled`, CPU profiler
o intrinsics de V8. La captura anterior con tracing nativo sigue parcial;
no se relanza ni se mezcla con esta observación.

Conservar argv, PID, versiones, hardware, fuentes, stdout/stderr completos,
reporte original y exit code de cada proceso. Detener ante el primer error,
sin reintentos. Las salidas de tracing añaden overhead y pueden alterar la
ejecución: sus duraciones no se comparan con ningún presupuesto ni se agregan
a las muestras anteriores. La ausencia de una línea no demuestra ausencia
universal de trabajo; documentar las capacidades reales del formato emitido.

Informar todos los eventos y razones observados, con sus ubicaciones de fuente
cuando existan. No asignar eventos a muestras o a intervalos de operación si
los logs no proporcionan una alineación verificable. No convertir conteos en
CPU consumida, pausas o causalidad de las diferencias de Azure. Si el formato
no permite contestar la pregunta, conservar esa limitación sin repetir hasta
obtener una respuesta favorable.

Esta observación no acepta rendimiento ni modifica el estimador, presupuestos
o las ocho filas requeridas. Ownership permanece abierto. La instrumentación
solo dura lo que dura el proceso; se mantienen los endpoints de Window y
Document del sampler original, sin inferir memoria pico ni ausencia universal
de fugas. No hay merge ni tag por publicar esta receta.
