# Recursos del ensayo de suites completas

Se completaron 342 CLIs seriales con los addons oficiales: 54 warmups y
288 mediciones. Los 456 probes observaron 912 asignaciones NativeRange al
crear y clonar rangos. No se observó individualmente la liberación de esas
asignaciones; no son evidencia de ausencia de fugas.

GNU Time conserva CPU, page faults, context switches y RSS máximo por CLI.
Entre las 288 mediciones, el RSS reportado va de 162,200 a 533,956 KiB.
Las muestras y medianas de cada celda permanecen en `resources.json` del
informe de benchmarks. Son estadísticas descriptivas sin presupuesto nuevo.
El RSS es el máximo del mayor hijo esperado por GNU Time, no la suma del
árbol concurrente ni heap retenido. No permite deducir fugas ni mejoras de
memoria a partir de diferencias entre paquetes.

Los logs se abren antes del reloj y se cierran en `finally`. El driver
conserva metadata escalar, rutas y JSON, sin wrappers del DOM. Los probes no
retienen Window/Document en sus resultados. El exit libera los recursos del
proceso, pero no demuestra recolección de Document o Window antes de salir.
No se midieron aquí heap JavaScript, memoria externa o pendientes de memoria
retenida después de GC en ciclos repetidos. Los estudios anteriores conservan
su alcance y límites; el código de ownership no cambió durante este ensayo.

Los inputs, ejecutables y fuentes permanecieron iguales antes y después.
La evidencia completa está en
`reports/validation/native-class-ownership/runner-suite-timing-study/`.
El éxito de tiempo completo no cierra los microbenchmarks rechazados ni el
hito de ownership.
