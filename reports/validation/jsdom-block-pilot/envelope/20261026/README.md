# Contrato del reporte y su contexto de producción

`pilot/envelope.cjs` reúne las comprobaciones de contexto que hacía el padre y
agrega SDK, revisión de contrato, artifact y límites de las afirmaciones del
sidecar. Contrasta los datos del worker con PID, padre, SDK, calendario y digest
de fuente observados por el executor. Después usa el lector raw existente para
comprobar tareas, warmup, afinidad y cleanup. No cambia la toma de tiempos.

La autenticación del archivo de transporte, de la fuente y del paquete sigue
siendo responsabilidad previa del padre. El sidecar no se autentica a sí mismo.
El resultado lo declara expresamente y no produce observaciones científicas:
solo acepta modo funcional. El capturador científico y su transporte integral
siguen pendientes; este cambio no habilita una captura ni acepta rendimiento.

## Pruebas

Pasaron **124 contratos**, 31 por Windows/Linux × Node 22.12.0/24.14.1.
Los nueve nuevos ejercen 32 reportes reales y rechazan cruces de procesos/SDK,
PIDs, fuentes, revisiones, artifacts, calendarios, contextos incompletos, falsas
afirmaciones de autenticación/aceptación y elevación a modo científico.
Los fixtures conservan su fuente privada `c5298ad1` y su manifiesto original;
no se atribuyen a otro commit ni se convierten en observaciones nuevas.
Actionlint 1.7.12 pasó en Linux. Review encontró y cerró un P2: ambos eventos
del workflow incluyen ahora los fixtures nuevos en sus filtros `paths`.

También pasó el controlador integrado con **44 procesos reales** en Linux:
16 positivos y seis adversos por SDK. La fuente Git nativa limpia fue
`a7c7f16d5f16013272643ae3d8e806daae8b9998`, un fixture privado creado con las
fuentes actuales, sin atribuirlo a un SHA publicado. Se conservan el mapa de
1152 inputs, el objeto commit, el árbol y los diez archivos propios como datos.
El código ejecutado provino del checkout actual; no se ejecutaron copias
archivadas. El paquete sellado se autenticó sin recompilar Rust.

`analysis.json` registra 4608 duraciones medidas, 1536 warmup positivos y 32
adversos; 386 Window y 386 Document separados, dos primeras rondas no claras,
68 endpoints finales claros y seis snapshots del padre. Diez de los adversos
no construyen DOM. Se conservan los raw y contextos íntegros en
`reports/benchmarks/native-class-ownership/jsdom-block-envelope-functional/20261026/`
y los recursos en `reports/memory/jsdom-block-pilot/envelope/20261026/`.
Son controles funcionales de jsdom 27.4.0, sin operaciones del candidato Rust
ni pooling con otras épocas. No prueban memoria pico ni ausencia universal de fugas.

## Recuperación del entorno

El disco de Windows se había llenado y Linux devolvía errores de I/O al leer
`/etc/passwd`. Se verificaron las partes publicadas antes de eliminar dos
archivos temporales duplicados. Antes de reiniciar únicamente la VM propia se
preservaron y verificaron los bytes de sus 9541 archivos temporales legibles.
El backup local tiene SHA256
`a8d5ccd7ab884908669d35811011d21099412726daa8a52aaea699cefa16b2f8`.
Seis enlaces temporales no se pudieron resolver por 9p; sus targets permanecen
en el paquete sellado original. No se afirma conservar metadata POSIX completa.

El reinicio normal recuperó el usuario root y el montaje de lectura/escritura.
No se ejecutó una reparación `e2fsck` ni se tocó otra distribución en uso.
Las nuevas pruebas usan un fixture nuevo y transporte actual, con sus propios
PIDs y commit reales. Los archivos `*.txt` de esta carpeta son procedencia,
no instrucciones para ejecutar scripts archivados.

El gate de ownership conserva el rechazo histórico. Runtime híbrido y migración
general pendientes; sin tag ni merge mientras no exista aceptación íntegra.
