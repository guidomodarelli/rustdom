# Memoria del factory intrínseco

El helper real `tests/helpers/collection-query-memory.cjs` pasó 34 escenarios en Node 22.12.0 y 24.14.1, con jsdom 27.4.0 y rustdom en default/VM. Las muestras finales están en `raw-final-with-controls-*-gc.json` (o `.gz`).

Se retienen los IDs numéricos y nombres de queries nativos, children y form.elements mientras se exige que Window, Document, raíz, elementos y colección sean recolectados por separado y los contadores nativos vuelvan al baseline. Los snapshots genéricos se crean con un getter de Float64Array.from que arroja; se restaura mediante finally. Los cuatro casos genéricos finales por runtime terminaron con cero supervivientes, aun conservando los IDs y nombres.

El factory enlazado conserva un solo realm intrínseco limpio por instancia del módulo; ese realm nunca recibe Document, Window ni nodos. La medición guarda heap, external y RSS después de GC, sin afirmar memoria pico ni ausencia absoluta de fugas. También quedan los controles anteriores de 30/32 escenarios como historial.
