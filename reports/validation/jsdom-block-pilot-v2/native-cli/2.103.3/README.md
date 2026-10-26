# CLI nativo para transporte Linux

Se fijó GitHub CLI 2.103.3 con metadata de la release oficial, checksums y tar
íntegro. El ELF extraído tiene SHA256 b768184570b12536be4ac1528893f6340d1c6a7b40b56ad45bca9cd0e87ad34d.
`tools/evidence-transport/native-cli.lock.json` conserva la identidad portable.
Fuente: https://github.com/cli/cli/releases/tag/v2.103.3

La descarga autenticada nativa coincide con el ZIP existente de artifact
12688950325, run40395417183/intento1, 104.325 bytes. No ejecuta su contenido.
Una fixture HTTP real demora la respuesta: el deadline de0,5segundos recolecta
el cliente nativo y se cierran socket y thread. Dos pruebas adicionales envían
SIGTERM/SIGINT durante cleanup y verifican que la cancelación impida éxito.
Los cuatro guards de -O/PYTHONOPTIMIZE actuales también pasan. Los guards de la
versión anterior siguen separados; no se suman como datos nuevos.

P2 corregido antes de la prueba autenticada: el timeout esperado podía consumir
una señal diferida sin rechazar el recibo posterior. El calificador ahora
comprueba cancelación tras ese timeout y antes de escribir éxito. Revisión local
de método y resultados sin hallazgos pendientes.

La lectura de la credencial existente de Windows es breve y no se journaliza.
Las transferencias largas usan el ELF Linux; esta evidencia no prueba cierre
de procesos Windows. El token real se mantiene en memoria/entorno del proceso,
se restaura el entorno y no aparece en journals ni configuración; la fixture
local recibe solo un token de prueba o ninguna autorización. No se guarda ni
imprime la credencial. El directorio de configuración propio quedó vacío.

Alcance: transporte Linux y pruebas finitas de cancelación. No mide DOM Rust,
V8, memoria pico ni ausencia universal de fugas. No reconstruye el candidato
sellado, no altera los903inputs/850pins ni inicia la captura v2. El colector
científico secuencial por criterio todavía debe integrarse y probarse. Los
rechazos históricos permanecen; sin tag ni merge. Runtime híbrido, objetivo activo.
Los scripts `readers-as-run/` son auditoría; no ejecutarlos ciegamente.
