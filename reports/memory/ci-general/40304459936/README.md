# Recursos del CI general 9a6

49 archivos originales de memoria del artifact Linux **12643399564**,
autenticados contra el ZIP y su inventario. Incluyen los logs, inventario,
salidas de tests y reporte Memcheck 3.18.1: **311 tests Rust, diez batches
completos, todos aprobados**. Se conservan los diagnósticos completos de los
tipos de fuga, incluidos posibles y alcanzables, para su inspección.

El checker de Memcheck cubre el ejecutable de tests Rust. Las pruebas de
recursos Node y sus estados de Window/Document se conservan en los demás
reportes con sus propios alcances. No se atribuye al checker nativo cobertura
del addon cargado en V8, memoria pico o ausencia universal de fugas.

`source.json` conserva hashes, IDs y procedencia. El head del PR era 9a6f62a9;
el checkout real de CI fue su merge 6233aecf. Estos datos preceden al envelope
nuevo, no son una recaptura científica y no aceptan el gate de rendimiento.
