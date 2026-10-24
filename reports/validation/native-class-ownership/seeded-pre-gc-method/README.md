# Calificación prospectiva del arranque con semillas

Node22.12.0 y24.14.1 pasan11 tests por versión. Cada versión ejecuta cinco
workers sembrados (A0/A1/B/J0/J1) y dos sin semillas (B/J0), en procesos nuevos
y con las ocho operaciones públicas. Son56 lotes y504 tiempos funcionales por
Node; no constituyen una aceptación de rendimiento ni un ensayo completo.

Los workers reales prueban posiciones0/15 y semillas1/16; el contrato del
schedule comprueba la asignación fija de las16 posiciones. Los cuatro procesos
AA de posición0 observan el mismo prefijo RNG. Flags ausentes, semilla/probe
alterados, grupos incompletos y relabel de evidencia antigua son rechazados.
Los reportes default conservan flags y formato sin campos de semilla.

Se comprueban los hashes públicos históricos de las ocho filas y endpoints
Window/Document separados. Por Node se observan672 owners de cada tipo,
incluidos168 warmups exteriores; los endpoints finales están claros y los
baselines nativos vuelven al estado esperado. Son escenarios finitos, no una
prueba absoluta de ausencia de fugas ni una medición de memoria pico.

`qualification.tar.gz` conserva501 archivos:409 fuentes congeladas, pruebas,
comandos, PIDs, códigos de salida, resultados crudos, recursos, versiones,
opciones declaradas por V8 y herramientas de calificación. Se leyó de vuelta
cada miembro y se cotejó con raw-files.json. El hardware/afinidad y parámetros
de cada proceso están en los reportes y manifests del paquete original.

Las distribuciones oficiales proceden del ZIP versionado
`reports/validation/native-class-ownership/hosted-build-ci/39720077911/artifact-12400802735.zip`.
Se verificaron sus SHA-256 de ZIP/tar y la identidad exacta del index usado;
se omite duplicar ese artefacto. Para reconstruir, extraer su ownership-build
y establecer las rutas de preparación/oráculo en las variables RUSTDOM del
driver guardado. El oráculo anterior está en el estudio pre-GC publicado en343efdc8.

Los11 controles jsdom rechazados del ensayo anterior conservan accepted=false.
No se repitió la captura de optimización. Los archivos v8-options son metadata
de los flags del ejecutable, no trazas de optimización ni una atribución causal.
hash-seed puede estar limitado por snapshots; el prefijo comprueba random-seed,
sin prometer control total del compilador, allocator o scheduler.

Responsabilidades: el worker declara/aplica startup y reporta; el estudio
verifica tratamientos y conserva estimador/presupuestos; constants declara el
método; el sampler público permanece intacto. Las métricas de líneas y búsqueda
de literales son mantenimiento, no avance de migración. No cambia producción.
Revisión final, publicación/autenticación y una secuencia completa de ambos
Node son requisitos separados antes de aceptar este método para ownership.

Los lanzadores adaptan las herramientas previas de publicación y ejecución:
verifican los409 blobs Git y el recibo real en GitHub, fijan hashes del propio
lanzador y extraen las fuentes publicadas. El guard de inicio duplicado se
ejerció en un directorio aislado real: rechaza antes de leer publicación o
crear procesos y conserva el marcador/evidencia existente. No se creó ni
consumió el marcador operativo de este estudio. La secuencia completa sigue
pendiente de publicación y autenticación.
