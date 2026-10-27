# Recursos de la calificación anidada completa

Node 24.14.1 Linux/WSL, fuente base f781c3b7 + candidato combinado, ELFce91c742.
Ambos JSON son stdout íntegro de los probes finales de la sesión 96801, exit0.
La QA de reports/validation/range-combined-ci/20261025-nested-layout-complete/
conserva los mismos bytes, comandos y reportes del resto de las suites.

StaticRange:6 ciclos,774 estados creados/liberados y768 rechazos de constructores.
Clones/colapso/mutación:6 ciclos y384 estados creados/liberados. Window y Document
se observan por separado; controles retenidos, liberación nativa y22 constructores
estables, sin cleanupErrors. Se conservan todas las trazas y snapshots.

La corrección es de organización del CI, sin cambio del runtime o sus owners.
El nuevo cálculo estadístico no carga DOM/N-API ni crea recursos persistentes;
no agrega cobertura de memoria DOM. Pruebas finitas: no memoria pico ni garantía
universal de ausencia de fugas, ni aceptación de rendimiento.
