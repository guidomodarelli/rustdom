# Revisión aislada del índice y evidencias hosted

`review_ownership_closeout`, solo lectura, 2026-10-26 UTC.
El P2 de procedencia canónica fue confirmado independientemente: el lector
anterior devolvía ese campo sin autenticación. No implica una alteración del
runtime ni de las fuentes originales.

La corrección autentica el índice contra el manifiesto independiente antes de
parsearlo, usando el mismo buffer. Se actualizan bindings de código/política
sin cambiar tar, ELF ni los 786 pins. Se conserva el probe anterior y la regresión
conserva el tamaño del índice para comprobar el hash. El índice exacto publicado
queda sellado; una procedencia diferente requiere otro recibo explícito.

El revisor cotejó bindings, contratos, transporte, probes y ambos ZIP hosted.
El lector conserva la distinción entre los doce contratos f2 anteriores al fix
y la nueva regresión de trece; `producerCanonicalIndexSealPresent=false` para
ese run. No se atribuyen resultados antiguos al código posterior.

Cero hallazgos accionables nuevos en la revisión de código. Cierre documental,
manifiesto y CI del fix publicado se registran por separado. Sin DOM, ejecución
de scripts ni modificaciones durante la revisión; no se usa cuota remota.
