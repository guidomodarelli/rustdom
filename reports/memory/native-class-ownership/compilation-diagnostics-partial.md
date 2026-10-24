# Recursos de la captura nativa parcial

Fuente `4e1e66c1`, Node 22.12.0/24.14.1, una invocación y ningún reintento.
Se preservan nueve procesos completos y el fallo por SIGSEGV de J0/Node 24.
La instrumentación conserva referencias débiles separadas para `Window` y
`Document`, limpieza del entorno y observaciones de GC. No cambió el runtime.

En los datos persistidos hay 73 lotes completos y uno incompleto, 876
referencias registradas por tipo, 219 observaciones de limpieza y 146 endpoints
finales exigidos claros. Se conservan seis observaciones iniciales aún no
claras; no son seis objetos únicos. Los nueve procesos con telemetry completa
registran 3.267 eventos GC. La telemetry incompleta del proceso fallido solo
tiene su header: no permite inferir cero GC.

Los recuentos corresponden a lo guardado, no al total posiblemente creado
durante el lote que estaba en vuelo. El cierre completo del proceso fallido
y la liberación de sus objetos no están demostrados. Ni la caída del proceso
ni los endpoints claros de otros lotes prueban ausencia general de fugas.
No se atribuye el fallo a ownership de Rust y no se calcula una pendiente de
heap/RSS ni memoria pico a partir de estos recuentos.

Crudos, reportes y `resource-summary.json` están en
`reports/validation/native-class-ownership/compilation-diagnostics-partial/`.
El tar conserva también logs del kernel y simbolización del ejecutable exacto.
Esta evidencia finita y parcial no cierra el hito de ownership ni sustituye
sus presupuestos de rendimiento o la validación completa de memoria.
