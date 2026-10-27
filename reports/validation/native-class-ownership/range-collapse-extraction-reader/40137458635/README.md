# Preparación del lector de extracción

El adaptador carga exclusivamente el lector actual del repositorio, autenticado
por SHA-256, y lo configura con la identidad declarada. El CLI fija el run
40137458635/job 121001909695/intento 1/fuente 02291d6b. Mientras sus pins del
artifact sean `null`, rechaza antes de leer la colección o crear el destino.
No activa workflows, crea objetos DOM ni ejecuta código del ZIP/tar.

| Suite | Linux | Windows |
| --- | ---: | ---: |
| Transporte con metadata real del run activo | 8 aprobados | 7 aprobados, 1 omitido |
| Extracción | 6 aprobados | 5 aprobados, 1 omitido |

Los casos omitidos dependen de enlaces de directorio: Windows devolvió
`WinError 1314` en una prueba real de privilegios; Linux ejerció ambos casos.
También se verifican fuentes/owners ajenos, destino existente, bytes del lector
alterados, modo Python optimizado y preservación de snapshots.

La extracción positiva utiliza la referencia histórica **40113188886** y su
protocolo original completo: fuente **b63cf834**, 2048 procesos y rendimiento
rechazado. Esa identidad y decisión no se cambian ni se presentan como evidencia
del run nuevo. El adaptador configurado conserva los valores originales; el CLI
nuevo continúa cerrado hasta contar con sus propios pins autenticados.

Los ZIP y tar históricos coinciden antes y después con sus hashes publicados:
`b82e1d3d…` y `563db7dd…`. Se guardan comandos, stdout/stderr y resumen de QA.
El resultado de la captura nueva, su extracción, replay en Node 22/24 y decisión
siguen pendientes. No hay aceptación, tag ni merge de ownership.
