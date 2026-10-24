# Recursos al activar collapse

El CI general 40135020046 de la cabeza 02291d6b terminó con sus ocho jobs aprobados.
Sus siete ZIP de reportes, muestras, logs, metadata y manifiestos completos están
en [el paquete de activación](../validation/native-class-ownership/range-collapse-study-activation/02291d6b/README.md).
La identidad original del checkout es el merge 28236ed8, vinculado por sus padres
a 02291d6b; no se normalizó. Node observado: v24.21.0 en Ubuntu/macOS y
v24.22.1 en Windows, según sus reportes originales.

Reportes de memoria conservados por sistema: ubuntu-22.04: 28, windows-latest: 27, macos-latest: 27. Todos registran `pass=true`
según sus propios contratos finitos; el JSON adyacente conserva nombres y hashes.
Valgrind 3.18.1 completó los 311 tests Rust del inventario real en 10 lotes exhaustivos,
sin omitir ni duplicar nombres. Cada batch terminó con exit 0 y todos los tests
seleccionados completos. Los logs retienen asignaciones alcanzables y pérdidas
posibles; no se ocultan mediante el resumen. El gate falla ante accesos inválidos,
tests incompletos y pérdidas definitivas/indirectas. Memcheck observa el ejecutable
Rust, no V8 ni el addon cargado. Las pruebas del addon y sus límites permanecen
separadas en los reportes originales.

Este cambio publica lectores, datos y estado; no modifica el runtime. El colector
autentica tamaño/digest, CRC y cada archivo contra el manifest propio. Usa handles
acotados por context managers y procesa una entrada a la vez; no crea objetos DOM
ni mantiene caches nativas. No se midió memoria pico del colector ni se infiere
ausencia universal de fugas a partir de estos escenarios o snapshots.

La captura única de collapse está activa en run 40137458635/job 121001909695/intento 1,
con Node 22.12.0/24.14.1 fijados. Sus resultados de recursos siguen pendientes:
no convertir los reportes de este CI en evidencia del candidato aislado ni en
aceptación de rendimiento. Se mantienen presupuestos ±2%/±5%, métodos/rechazos
históricos, runtime híbrido y migración general pendiente; sin tag ni merge.
