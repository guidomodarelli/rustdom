# CI general sobre d265390e

El run 40191262985, intento 1, terminó con ocho jobs aprobados: validación Linux,
Windows y macOS, cuatro shards de benchmarks y su agregador. Se conservan diez
artifacts completos, metadata API, manifiestos de miembros, los ocho logs de jobs
y el ZIP completo de logs del run. Se autenticaron ID/run/intento/HEAD/nombre,
tamaño y digest; los miembros se leyeron con verificación de CRC, sin ejecutarlos.

La metadata de API vincula el run a d265390e. Los reportes conservan el commit de
merge f0904eb9… realmente observado; la prueba API de padres/árbol idéntico está
incluida. No se normalizan sourceCommit, sourceChanges ni sourceGitErrors. Los
paquetes de los tres sistemas son evidencia del CI y no sustituyen el paquete
prospectivo seleccionado del estudio de ownership.

El benchmark ordinario completo y sus límites están en
reports/benchmarks/ci-validation/40191262985/. La QA del lector de datos está en
reader-qa-safe-inputs.zip y summary.json: Windows y Linux reprodujeron los cuatro
archivos de datos e integridad, incluyendo rechazo de bytes alterados, archivos
extra y enlaces dentro de la entrada antes de crear salida. Se probaron un symlink
Linux y un junction Windows apuntando al padre del destino, conservando el sentinel
ajeno del caso de prueba. El symlink de salida se probó solo en Linux. La QA inicial
reader-qa.zip también se conserva; no cubría ese borde detectado en la revisión.

Este éxito de CI no aprueba la captura científica ni demuestra migración total,
compatibilidad completa de estándares, memoria pico o ausencia universal de fugas.
La decisión de rendimiento de ownership sigue pendiente de su propio archivo y replay.
