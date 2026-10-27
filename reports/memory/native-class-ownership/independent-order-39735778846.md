# Memoria del ensayo de orden independiente

El run 39735778846 completó los 256 procesos previstos en Node 22.12.0/24.14.1.
Todos terminaron con exit 0; los drivers rechazaron rendimiento por controles
sin calibrar. No se alteraron las tres rondas de cleanup o las dos finales
claras exigidas. Cada proceso cargó solo su distribución física, verificada por
el worker y después por los verificadores congelados en ambos Node.

Los contadores recalculados desde los reportes dan 24.576 referencias Window
y 24.576 Document. Incluyen los tres warmups y nueve muestras por lote; las
referencias se acumulan por proceso sin sumar de nuevo los prefijos acumulativos
de cada lote. Son referencias observadas, sin afirmar que enumeren todos los
objetos internos de cada realm.

Se conservan 6.144 observaciones de cleanup. Las 182 iniciales no claras no se
descartan: no equivalen a 182 objetos únicos ni demuestran 182 fugas. Los 4.096
estados finales exigidos están claros, con Window y Document por separado y los
contadores nativos vivos que valida el protocolo. Eso no exige que contadores
acumulativos o capacidades del allocator vuelvan al valor inicial.

`reports/benchmarks/native-class-ownership/independent-order/39735778846/`
conserva el ZIP oficial completo, fuentes, muestras, estados nativos y logs.
`memory-ranges.json` tiene 32 grupos: Node/fase/motor/tratamiento/paquete físico,
separando todas las rondas de las dos finales. HeapUsed, memoria externa y RSS
corresponden al proceso completo después de GC; no miden picos ni memoria exclusiva
del DOM. Las huellas de preparación y las 774 fuentes congeladas se verificaron.

El análisis y las repeticiones de verificadores son offline, sin crear nuevos
DOM o recopilar muestras. Las pruebas finitas observan liberación en estos casos;
no certifican ausencia universal de fugas ni clasifican el RSS retenido como
fuga o retención del allocator. El presupuesto de rendimiento sigue rechazado
y no se crea checkpoint de ownership por tener claros estos endpoints.
