# Memoria de la captura original del candidato actual

Run 39921160254, fuente `5ef668c4`, arnés `97284800`. Se verificó el archivo completo
en ambos Node sin ejecutar nuevas muestras. El presupuesto quedó rechazado
por calibración, por separado de las observaciones de recursos.

Se completaron 2048 workers con 24576 Window y 24576 Document
observados por separado, incluidos 6144 owners de warmup por tipo.
Se preservan 6144 estados de cleanup; 259 fueron no claros,
de ellos 259 en la primera ronda. Los 4096 endpoints finales requeridos
quedaron claros, con ambos weak targets recolectados antes de salir.

En los workers rustdom, `napiClasses.live` conserva 22 tanto en baseline como
en endpoints. El JSON incluye los demás contadores live disponibles, capacidades en los crudos,
y rangos de memoria por Node, fase, motor, tratamiento y copia física.
Los rangos se separan para todas las rondas y las dos finales, sin descartar
las observaciones iniciales no claras.

RSS, heapUsed, external y arrayBuffers son snapshots de procesos distintos
tras GC. No miden picos ni atribuyen causalmente diferencias al guard. La
capacidad retenida por un allocator no se declara fuga por sí sola. Estas
pruebas finitas tampoco certifican ausencia universal de fugas.

Los crudos completos y los verificadores están en
`reports/benchmarks/native-class-ownership/current-source-results/39921160254/`.
