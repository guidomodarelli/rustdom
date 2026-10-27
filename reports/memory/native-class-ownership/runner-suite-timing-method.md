# Recursos del método de tiempo completo

Este cambio agrega drivers de medición y replay; no modifica el DOM Rust ni
su ownership. La calificación final ejecutó 18 CLIs y 558 tests, con los
addons oficiales y el teardown real de los runners. Los ejercicios anteriores
se conservan como historia de validación y no son réplicas del ensayo formal.

El driver abre los logs antes del reloj y cierra sus descriptores en `finally`,
incluso ante fallos. Conserva argumentos, rutas, contadores y JSON; no agrega
referencias persistentes a Window/Document ni caches o listeners del producto.
Cada CLI corre en un proceso nuevo y la secuencia se detiene al primer error.
Los tests ejercitan procesos reales con salida no cero, señal y reporte inválido.

GNU Time registra CPU, fallos de página, cambios de contexto y RSS máximo.
El RSS corresponde al mayor hijo esperado por GNU Time; no es la suma
simultánea del árbol de procesos ni una medición de heap retenido. El exit
de proceso no demuestra recolección de Window o Document antes del exit.
Los warmups no comparten el estado de V8 entre CLIs.

No se afirma ausencia de fugas ni una mejora de memoria con estos datos.
No se midieron aquí pendientes de memoria retenida por ciclo, heap JavaScript
ni memoria externa después de GC. Los estudios previos conservan su alcance.
Fuentes, recursos crudos y límites están en
`reports/validation/native-class-ownership/runner-suite-timing-method/`.
