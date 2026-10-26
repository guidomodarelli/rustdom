# Admisión del commit publicado y prueba acotada de almacenamiento

`525e2be66edba26846582be67d0087418d64312c` se obtuvo de GitHub con un clon
parcial Linux real. Ambos SDK fijados admitieron las 903 fuentes y rechazaron
el controller ausente sin ejecutar DOM ni una captura científica.
El primer intento de hidratación falló por no persistir `core.autocrlf=false`;
se conserva y la reanudación registra esa configuración explícita.

La prueba de almacenamiento leyó una parte original de 32 MiB por Git y
verificó su tamaño y SHA256. No demuestra escritura remota ni preservación
completa de una captura futura; esas validaciones continúan pendientes.

`tools/` conserva las herramientas originalmente ejecutadas sin optimización.
La revisión detectó que Python con optimización podía omitir sus asserts.
`reviewed-tools/` rechaza ese modo antes de crear salidas. Ocho CLI reales
Windows/Linux comprobaron el rechazo de `-O` y `PYTHONOPTIMIZE=1`; el review
final no dejó hallazgos pendientes. Las herramientas son evidencia y no deben
ejecutarse desde este archivo histórico: usar lectores actuales revisados.

Estos datos no sustituyen los 4+8 checks hosted propios del nuevo SHA, todavía
en curso al publicarlos. Se conserva el rechazo histórico de ownership;
`performanceAccepted=null`, `gateReevaluated=false`. No hubo activación v2.
