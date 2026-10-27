# Recursos de la entrada de CI — Node 24.14.1, Linux/WSL

La ejecución completa de prepare.py y qualify.py reconstruyó el ELF ce91c742 y
terminó con ambos probes aprobados. Estos JSON son copias íntegras de stdout;
los mismos bytes, logs y reportes del resto de las suites están en la QA de
reports/validation/range-combined-ci/20261025/.

StaticRange: seis ciclos, 774 estados creados/liberados y 768 constructores
inválidos rechazados. Range/clones/colapso/mutación: seis ciclos y 384 estados
creados/liberados. Window y Document se observan por separado; controles
retenidos impiden confundir cierre con recolección. Los constructores N-API
permanecen en 22, sin cleanupErrors. Se conservan trazas y snapshots completos.

El ejecutor nuevo limita los procesos y termina el grupo POSIX o árbol Windows
al vencer el plazo. Sus pruebas reales verificaron padre e hijo en ambos sistemas;
no cubren descendientes que creen sesiones POSIX independientes. No hay cambios
de ownership o runtime respecto al candidato ya probado con ambos Node.

Pruebas finitas: no establecen memoria pico ni ausencia universal de fugas.
No son una aceptación de rendimiento. Windows/macOS y Node 22 se verificarán
con el workflow nuevo; la QA anterior conserva los ensayos locales de ambos SDK.
