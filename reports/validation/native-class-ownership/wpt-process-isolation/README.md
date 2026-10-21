# Validación de aislamiento de fixtures WPT

Node 22.12.0 y 24.14.1 Linux completaron las 240 fixtures declaradas con paridad:
83.007 resultados individuales por versión y 1.203 fallos de estándares
compartidos con jsdom. Se preservan las exclusiones y suites bloqueadas del
manifest; esto no es cumplimiento total de WPT ni del objetivo de migración.
El comparador conserva su única normalización previa de la descripción Date
volátil en Blob-constructor; los resultados crudos no se modifican.

Cada fixture/motor se ejecutó en un proceso nuevo. Los 480 procesos por Node
terminaron con código 0, antes de ejecutar el siguiente. El corpus completo
incluye la fixture de 2.808 casos que agotó el timeout de jsdom en macOS: aquí
ambos harness terminaron con status 0 en ambas versiones. Confirmar la corrección
en macOS sigue pendiente de CI; no se afirma que su causa esté demostrada.

Nueve tests específicos y del comparador pasaron en ambos Nodes Linux y en
Windows Node 24.14.1 con el addon real del artefacto CI 12383559216 y npm ci local
con lockfile. Ejercen resultados reales, terminación observada, deadline de
proceso de 1 ms, errores de input/fixture, preservación de outputs y rechazo del
timeout original conservado. No hay mocks de las librerías de plataforma.

El loader, reporter y assertions originales se mantienen. Los deadlines upstream
son 10/60 s; el failsafe de fixture sigue en 90 s. El proceso tiene 120 s para
incluir startup y conserva --max-old-space-size=2048, que limita el espacio viejo
de V8, no el heap total ni RSS. No se fuerza GC. El padre guarda
resultados y stdout/stderr, con diagnóstico de fallos, y limpia temporales propios
después de esperar la terminación. El código recibió review read-only sin hallazgos.

Los dos .wpt.json.gz contienen los bytes completos de los reportes originales,
sin selección de resultados. validation.json registra SHA de los JSON sin
comprimir/comprimidos, siete fuentes verificadas contra las copias ejecutadas,
addon Linux, procedencia Windows, versiones, conteos y límites. Los logs completos
de ambos corpus y las tres ejecuciones de nueve tests están preservados.

Las observaciones de memoria son anteriores y posteriores a close(), sin GC;
no son picos ni endpoints de recolección de Window/Document. Terminar un proceso
no prueba ausencia de fugas dentro del runtime. Este cambio no modifica Rust ni
algoritmos DOM y no acepta el presupuesto de rendimiento de ownership.
