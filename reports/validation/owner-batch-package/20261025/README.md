# Paquete y calificación del transporte

Se preserva el runtime seleccionado del CI 6/6, sus controles y sus fuentes con
procedencias diferenciadas. packages.tar.xz es el archivo completo; archive.json
enumera los 7.823 miembros bajo la raíz y seis enlaces, tamaños y hashes; el tar
incluye además la entrada del directorio raíz. El SHA es
1e4313382b809453d6af724b931f9c366519cf637a80d16038b1d143d45003aa.

assembly-index.json y candidate-receipt.json conservan la calificación hospedada,
la reproducción canónica local y los errores Git reales del snapshot transportado.
No se reemplazó el ELF4b52a84d por el f8 local. Los readers ejecutados son código
actual del repositorio; las fuentes dentro del tar se trataron únicamente como datos.

qa.json y los logs conservan positivos y fallos de setup, incluyendo los dos
intentos negativos que agotaron RAM y la corrección posterior. La reconstrucción
real con el lector final se verificó con Node22.12.0 y24.14.1. El comparador pasó
ocho contratos numéricos por SDK, con datos sintéticos explícitos y aceptación nula.

El workflow de contratos verifica transporte, ensamblado y procesos funcionales.
Su aprobación hospedada todavía debe observarse después de publicar este cambio.
Dos invocaciones adicionales del worker ejercieron el paquete reconstruido, una
por SDK, con 144 tiempos medidos y48warmup cada una. Sus reportes quedan separados
de la calificación completa de64workers sobre roots temporales anteriores.
No hubo captura científica, reevaluación del gate ni aceptación de presupuestos.
