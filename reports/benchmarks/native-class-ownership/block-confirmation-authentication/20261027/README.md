# Calificación funcional del adaptador de fuentes

La matriz nueva ejerció 128 procesos reales en Node 22.12.0 y 24.14.1:
Rust/jsdom, AA/AB, ocho filas y ambos labels, factor 0. Cada SDK terminó además
seis casos adversos. Los 140 comandos de workers y ambos padres terminaron;
esto no cuenta todos los procesos internos del autenticador.

`evidence.tar.gz` conserva muestras crudas, warmup, logs, tareas, contexto
histórico, fuentes de lectores como datos, pruebas, parciales deliberados y
desarrollo de fixtures de metadata. No ejecutar scripts archivados.
`manifest.json` enumera tamaños y hashes; sus 961 miembros se releyeron completos.
El archivo tiene 19.338.673 bytes y SHA-256
`7ca309745d3515384d25632d1804df7037711b8cbfa2aff6b094218b7de5921e`.

`summary.json` publica denominadores y limitaciones. Pasaron 26 contratos Node
y tres Python por SDK fijado; los planes fueron byte idénticos. La primera
calificación de 25 tests y los intentos previos de fixtures se conservan aparte.
Parte del stdout exterior de desarrollo no se retuvo completo; los streams de
los workers funcionales y sus datos están íntegros.

No es una captura científica. No permite aceptar rendimiento, reemplazar los
rechazos históricos ni afirmar memoria pico o ausencia universal de fugas.
El runtime sigue híbrido. Producción todavía difiere en cuatro de 344 inputs.
