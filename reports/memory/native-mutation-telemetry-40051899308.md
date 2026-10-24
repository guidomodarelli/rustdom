# Recursos del diagnóstico nativo 40051899308

Captura finita y completa: 512 procesos, doce pares Window/Document por proceso,
observados separadamente. Se preservan 211 primeras rondas no claras; las dos
rondas finales requeridas por proceso resultaron claras (1024 observaciones).
La evidencia no demuestra ausencia universal de fugas ni memoria pico.

En los 256 procesos rustdom, los contadores de MutationRecord registran
3686400 creaciones y 3686400 liberaciones después del baseline. Los endpoints
nativos vuelven al baseline exigido por el verificador original. `napiClasses`
permanece en 22 referencias a constructores: **no cuenta asignaciones de instancias
ni demuestra que el guard PendingClassValue no se ejecute o no tenga costo**.
Las referencias a constructores pertenecen al entorno; no se presentan como
liberadas durante el cierre de cada Window.

El padre guardó tres snapshots, sin GC forzado: antes de los workers, después
de Node 22 y después de Node 24. RSS: 263311360, 445911040, 457003008
bytes. Son puntos aislados que incluyen buffers y trabajo del colector; no son
picos ni permiten distinguir por sí solos allocator, heap recolectable y fuga.
El JSON adjunto conserva los snapshots exactos y ocho grupos de 64 endpoints de
hijos con min/mediana/máximo de RSS, heap y memoria externa tras GC. No son
comparaciones de rendimiento sin instrumentación.

El exportador adicional inicial agotó el heap; los logs y el código de ese
intento se conservaron. El lector final escribe frames y registros JIT por
bloques, con umbral 65536 unidades UTF-16 más la fila actual, y cierra ambos
descriptores incluso si falla una escritura. La lectura sigue procesando un
reporte/log de proceso a la vez. Ambos Node completaron los siete exports sin
ampliar el heap; esto califica el caso ejecutado, no una garantía de memoria
constante para entradas de tamaño arbitrario. Los campos no instrumentados
son null y la salida debe quedar fuera del corpus autenticado, incluso por alias.

No se modificó el runtime ni se repitieron mediciones. `performanceAccepted=null`,
`gateReevaluated=false`; se conservan los rechazos anteriores. El runtime sigue
híbrido. Archivo íntegro y validaciones en
`reports/benchmarks/native-class-ownership/native-mutation-telemetry-results/40051899308/`.
