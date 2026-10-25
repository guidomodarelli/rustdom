# Preparación de captura y lectura portable

Pasaron29 contratos por SDK y11 comandos de CI reproducido, con fuente Git real
d149 y overlay WIP explícito. Se verificaron700 dependencias/599 pins y701 archivos
del snapshot incluyendo el catálogo. El primer intento detectó que el SDK Node
supera el límite JSON: se conserva el fallo. La corrección verifica el binario
con bloques de1MiB/límite256MiB, manteniendo16MiB por reporte. El segundo intento
aprobó. La revisión halló el riesgo de perder parciales por job180/captura175:
se corrigió prospectivamente job200, setup13+captura175+archivo4+upload3+margen5,
sin modificar presupuestos de regresión ni los workflows históricos.

El intento final aprueba29 tests por Node22/24, actionlint de ambos YAML, preparación
real y snapshots. La lectura portable usa los mismos64 procesos archivados:
no se ejecutan nuevos workloads. Cambiar rutas de transporte conserva íntegros
commits/errores Git y comandos originales. Se rechazan aliases, comandos y
commits alterados, owners supervivientes y promoción de funcional a científico.
Los456 miembros de la derivación funcional anterior se verifican como bytes
con su SHA/HEAD/controles fijados; el modo científico no admite esa excepción.

Una preparación dedicada conservó todos sus archivos y el inventario en
reports/benchmarks/native-class-ownership/combined-capture-preparation/20261025/.
QA conserva fuentes, logs y los tres intentos. No ejecutar código archivado.
CI publicado de d149 aprobado y autenticado en ../40176086547/ corresponde al
hito anterior de17 tests, no a este código nuevo. Falta su CI publicado.

executionReady=false. Capturador y lector de payload están implementados y
probados en preparación, rechazo y lectura de datos reales; no existe una captura
nueva de2048 ni prueba positiva integral de ese estudio. Faltan transporte externo,
recibo de activación revisado y checks del SHA habilitado. captureAuthenticated=false,
performanceAccepted=null. Sin integración/tag/merge de ownership.

La auditoría de preservación detectó una omisión por rutas largas UNC en Windows.
Los cuatro ZIP iniciales se conservaron intactos y el quinto agrega el único
miembro faltante. La cobertura final coincide exactamente con los1.162 archivos
del inventario Linux, incluidos701 de método. Se conserva el manifiesto inicial.
La QA también se cotejó con los árboles reales usando UNC extendido: sus2.497
miembros estaban completos. La QA de reparación agrega solo el lector de
reparación, sin modificar qa.zip original.
No se repitieron mediciones, preparación ni tests; solo lectura y transporte.
