# Liberación finita de las propuestas DOMTokenList y DOMStringMap

El run39888943268 ejercitó el runtime e17c3937 con herramientas/tests a89ce898
en Node22.12.0 y24.14.1. Ambos jobs pasaron los helpers reales, sin mocks.
Son seis ciclos por familia y versión: 24 ciclos públicos en total y dos
endpoints adicionales tras soltar snapshots nativos de conjuntos de tokens.

Los ciclos públicos observan Window, Document y otros owners por separado.
Todos los endpoints terminaron con sus supervivientes declarados en cero y
dos muestras claras. Retener el mapa/listas conserva owners; soltarlos permite
recolectarlos. El snapshot nativo puede sobrevivir a su forest/lista y después
se libera bajo su contrato propio, sin contarlo como una ventana observada.

El JSON compañero referencia los cuatro reportes crudos por hash y conserva
los snapshots finales RSS/heap/external y límites por endpoint. No son memoria
pico ni una comparación de consumo entre versiones. Son controles finitos;
no certifican ausencia universal de fugas o crecimiento en procesos longevos.
La calificación no ejecutó una suite o GC local ni cambia rendimiento.
