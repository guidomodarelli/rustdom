# Autenticar la procedencia canónica del índice

La revisión posterior al CI f2 descubrió un P2 real: `verify(root)` recomputaba
runtime y fuentes, pero devolvía `canonicalReproductionIdentity` desde un índice
sin binding independiente. El probe de lectura cambió solo ese commit a ceros y
el verificador anterior devolvió `verified=true`. El índice original se restauró
con SHA `fb951df27df17037a6d61eb21e690ace7508132e5fd631766de16a3d11b3ba78`.
No hubo ejecución DOM ni cambios en runtime por ese probe. La evidencia del
caso anterior está en `reports/validation/numeric-package-ci/20261026/canonical-index-rejection/`.

El verificador actual liga `archive.json` al SHA independiente
`4d68ad3bd8cf5a997b04545376ceae703fa8df8e185797a6b47e11f4de0e9d99`.
Obtiene de ese manifiesto el índice publicado de 47795 bytes y autentica tamaño
y SHA **antes de parsearlo**, usando el mismo buffer. La lectura se limita a
47796 bytes para detectar contenido extra sin reservar memoria proporcional
a un archivo arbitrario. Smoke y transporte actualizan solo sus bindings de
herramientas/política; tar fb06276a, ELF a277 y los 786 pins no cambian.

La regresión nueva cambia el commit canónico manteniendo los mismos 47795 bytes,
por lo que exige el hash y no se satisface solo con el tamaño. Pasaron trece
contratos de ensamblado, cinco de transporte Linux y tres Windows con dos skips
Linux-only. Los probes finales Node 22.12.0/24.14.1 pasaron seis ciclos por SDK,
con doce endpoints claros de Window/Document/wrappers por separado. Se conservan
los intentos anteriores y finales; sus fixtures Git son reales y nunca se
presentan como el SHA publicado del método.

El sellado autentica **este índice publicado exacto**. Una preparación futura
con metadata legítimamente distinta necesita un recibo distinto; no se deben
normalizar sourceCommit/sourceChanges/sourceGitErrors para hacerla coincidir.
Para trasladar el paquete existente se usa el tar original autenticado.

CI f2, run 40277876693, terminó 2/2 aprobado y queda preservado íntegro en
`reports/validation/numeric-package-ci/hosted/40277876693/`. Corresponde a doce
contratos anteriores al cierre de índice: no prueba esta regresión nueva.
La confirmación hospedada del fix requiere el CI de su commit publicado.
No hay nueva captura científica, rendimiento aceptado, tag ni merge. El runtime
permanece híbrido y no se afirma memoria pico ni ausencia universal de fugas.
