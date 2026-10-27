# Contratos reales del método de orden independiente

`contracts-and-sources.tar.gz` conserva las 387 fuentes exactas, su inventario,
los comandos y todas las salidas de los contratos Node 22.12.0 y 24.14.1,
incluyendo reportes de workers, nueve muestras crudas por lote, memoria,
afinidad y paquetes cargados. También conserva actionlint y el preflight real
del workflow. `validation.json` fija tamaño y SHA-256 del tar; `analysis.json`
se recalculó desde él con `verify-validation.py`.

Resultado: 23/23 pruebas por Node, 16 workers reales entre ambos métodos y
ambos Node, 128 lotes y 1.152 duraciones medidas. Cada worker usa un paquete
de la preparación oficial 39720077911, sin recompilar; sus entradas y hashes
están en los manifests completos. Las ocho cargas producen los mismos outputs
en todos los paquetes ejercidos. Las duraciones son evidencia cruda de contratos,
sin comparación de presupuesto ni afirmación de mejora. La versión de Node/V8,
flags y afinidad observada están en cada reporte de worker. `host.json` describe
el host WSL observado después de los contratos; no contiene telemetría de carga
durante las muestras ni convierte estos contratos en un estudio de rendimiento.

El método nuevo prevé 256 procesos y 18.432 duraciones, con orden de motores
independiente del orden del par y el resto de factores balanceados. Conserva
los límites originales: ±2% para el control jsdom, ±5% Rustdom A/A y +5%
Rustdom A/B, en todas las filas y ambos Node. El protocolo completo está en
`../INDEPENDENT-ORDER-PROTOCOL.md`. La secuencia completa todavía no se ejecutó;
las muestras de estos contratos no se incorporarán al estudio.

El ensayo anterior 39727878290 permanece rechazado y publicado íntegramente.
No se reinterpretan sus muestras, no se seleccionan filas calibradas ni se
afirma que el cambio de orden resuelva el drift. El nuevo diseño también amplía
la replicación independiente; un resultado distinto no demostraría causalidad.

La evidencia de memoria se describe en
`../../../memory/native-class-ownership/independent-order-method.md`.
