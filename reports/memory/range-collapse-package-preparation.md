# Recursos de los paquetes preparados de collapse

La preparación independiente conserva el ELF43410883 y la distribución
0d2c0835 de B, los controles originales y las dependencias149eb8f5. No se
recompiló Rust, no se reinstalaron dependencias y no se capturaron benchmarks.
Se ejecutó el probe actual revisado con sus bytes intactos, mediante resolución
Node real hacia packages/B. El grafo de seis enlaces y los miembros regulares
están fijados independientemente; el probe comprueba B y su ELF antes de crear
salidas. Las regresiones rechazan A0 como B y un loader idéntico enlazado a A0.

Cada proceso realiza seis ciclos de32Range y32clones, alterna owners,
collapse/mutación/cierre, retiene un Range como control negativo y después
lo libera. Las WeakRef de Window, Document, Range y estado nativo se observan
por separado. El lector actual verificó todas las trazas y los baselines
completos, incluyendo napiClasses.live=22 y rangeStates.live=0, y dos estados
claros consecutivos por ciclo. No se sustituyó ningún baseline por cero.

| Node | Window / Document | Range / NativeRange | Retenidos / finales claros | Primera liberación no clara | RSS observado, bytes |
| --- | --- | --- | --- | ---: | --- |
| v22.12.0 | 6 / 6 | 384 / 384 | 12 / 12 | 0 | 127246336..127639552 |
| v24.14.1 | 6 / 6 | 384 / 384 | 12 / 12 | 0 | 119648256..120565760 |

Los dos procesos corregidos mantienen12endpoints negativos y12finales claros
por Node; sus datos y rangos heapTotal/heapUsed/external/arrayBuffers están en
el JSON adyacente y el archivo raw-qa del packet de preparación. También se
conservó la QA inicial previa a los dos fixes de review, identificada como
initial; sus probes recibieron B realmente pero no cubrían los dos casos de
rechazo nuevos. No se mezclan sus muestras con las del conjunto fixed.

Son observaciones finitas tras GC. No miden memoria pico ni demuestran ausencia
universal de fugas, ni distinguen universalmente retención del allocator de una
fuga. No permiten atribuir diferencias de RSS a una optimización. El runtime
sigue híbrido. performanceAccepted=null; el estudio prospectivo está pendiente.
