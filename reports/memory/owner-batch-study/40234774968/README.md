# Recursos del estudio completo40234774968

Se conservaron24576Window y24576Document como objetos distintos,6144 endpoints deGC y los seis snapshots parentales originales. Los2048 procesos tienen tres rondas y dos estados finales claros; en los últimos estados no quedan Window niDocument observados.108 primeras rondas no claras no se eliminan.

Solo1024 procesos Rust tienen baselines y estadísticas nativas:684032filas y167campos en cuatro estados por proceso. Parajsdom esos datos son no aplicables; no se fabrican ceros. Los booleanos preservan su valor y delta vacío. resources.json contiene todos los167campos, no solo los favorables.

## Contadores observados al último endpoint

| Campo | Mínimo | Máximo | Delta mínimo | Delta máximo |
|---|---|---|---|---|
| abortStates.live | 0 | 0 | 0 | 0 |
| blobs.live | 0 | 0 | 0 | 0 |
| documentImplementationOperations.active | 0 | 0 | 0 | 0 |
| domParserOperations.active | 0 | 0 | 0 | 0 |
| eventStates.live | 0 | 0 | 0 | 0 |
| fileReaders.live | 0 | 0 | 0 | 0 |
| formData.live | 0 | 0 | 0 | 0 |
| listenerRegistries.live | 0 | 0 | 0 | 0 |
| liveNodes | 0 | 0 | 0 | 0 |
| mutationRecords.live | 0 | 0 | 0 | 0 |
| napiClasses.cleanupErrors | 0 | 0 | 0 | 0 |
| napiClasses.live | 22 | 22 | 0 | 0 |
| observerDeliveries.live | 0 | 0 | 0 | 0 |
| rangeClones.live | 0 | 0 | 0 | 0 |
| rangeExtracts.live | 0 | 0 | 0 | 0 |
| rangeStates.live | 0 | 0 | 0 | 0 |
| rectangles.live | 0 | 0 | 0 | 0 |
| selectionOperations.active | 0 | 0 | 0 | 0 |
| selectionStates.live | 0 | 0 | 0 | 0 |
| slotAssignmentDrivers.live | 0 | 0 | 0 | 0 |
| tokenLists.live | 0 | 0 | 0 | 0 |
| traversals.live | 0 | 0 | 0 | 0 |
| webStorage.live | 0 | 0 | 0 | 0 |
| xmlParsers.live | 0 | 0 | 0 | 0 |
| xmlSerialization.cleanupErrors | 0 | 0 | 0 | 0 |
| xmlSerialization.live | 0 | 0 | 0 | 0 |
| xmlSerializerOperations.active | 0 | 0 | 0 | 0 |

## Snapshots y límites

resources.json resume mínimos/medianas/máximos del último snapshot trasGC porSDK/engine y conserva todos los endpoints originales en elCSV. Son snapshots, no memoria pico. Se mantienen los tres snapshots del padre porSDK y sus deltas, incluidos deltasCPU negativos si aparecen; no se usan como memoria oCPU de todos los hijos.

Capacidades y contadores acumulados distintos de cero no bastan para declarar una fuga. La liberación observada es finita y se limita a estos casos, ventanas y tareas. No se afirma ausencia universal de fugas ni equivalencia con un DOM totalmenteRust: el runtime sigue híbrido. Los relojes monotónicos pertenecen a su propio proceso; no se unen cronologías entre máquinas oPIDs.

El rechazo global de rendimiento, con 42/64 criterios cumplidos, no se cambia por estos resultados de recursos. La captura no se repite y los resultados desfavorables permanecen publicados.
