# Corrección del checkout del lector histórico

En el commit 5caa3ea9, el job 122078361948 del run 40471170149 falló antes
de leer resultados: el catálogo de 738 dependencias contiene los workflows
originales del método, cuyos bytes ahora cambiaron para separar historia y
producción. El artifact 12718940331 conserva el error original; ZIP, metadata
y digest se verificaron y se guardan aquí. El rechazo no se atribuye al DOM.

El workflow del lector ahora usa un checkout Git real, limpio, del SHA original
4196c496. Los cuatro archivos del lector/configuración ejercidos son idénticos
a los actuales. Se verificaron las 738 dependencias, incluidos 599 pins
históricos, y pasaron los tres tests reales de exportación por Node 22.12.0 y
24.14.1. Incluyen los 64 procesos ya archivados, retención de Document,
baselines nativos y errores EFBIG reales sin pérdida de descriptores. No se
ejecutó DOM, se agregó ninguna muestra ni se importó código desde el ZIP.

Actionlint 1.7.7 validó el workflow modificado. `receipt.json` conserva su hash;
los comandos, logs completos, SDK y manifest están en esta carpeta. Este
resultado acredita únicamente el replay histórico. CI general y el job Range
integrado verifican HEAD actual. El gate de rendimiento sigue pendiente;
`performanceAccepted=null`, `gateReevaluated=false`.
