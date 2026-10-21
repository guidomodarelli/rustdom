# Fallo verificado de CI en macOS

La ejecución 39679501823 del head 61ed417d terminó con fallo únicamente en macOS.
Linux, Windows, los cuatro shards y su agregación aprobaron. La validación macOS
ejecutó Node 24.21.0 y reportó una única diferencia WPT:
dom/ranges/Range-mutations-dataChange.html.

Se descargó el artefacto 12384632098 y se verificó el SHA-256 del ZIP completo
contra el digest de GitHub. Se extrajo el reporte WPT original y se conserva el
registro completo de la fixture en fixture.json.gz; provenance.json identifica
ZIP, entrada original, hashes y estado observado. La compresión no elimina
resultados, nombres, mensajes ni estados de los motores.

Los 2.808 resultados individuales son idénticos y aprobaron en ambos motores.
El estado global del harness de referencia es 2 (TIMEOUT en el testharness.js
fijado); el de rustdom es 0. No es evidencia de una diferencia semántica en esos
casos individuales. Tampoco es una validación completa aprobada: el timeout debe
resolverse, manteniendo las assertions y deadlines originales.

Pendiente: investigar el costo de ejecución del harness/corpus en macOS y validar
la corrección en ese runner. No se reintentó la CI para elegir un resultado verde
ni se modificó el comparador para ignorar este fallo.
