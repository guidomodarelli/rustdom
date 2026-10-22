# Calificación de las 21 clasificaciones Storage

Trece contratos por Node en Linux22.12.0/24.14.1 y Windows22.12.0/24.22.1,
sin omisiones. CLI público, jsdom27.4.0 independiente, comportamiento Storage
y cierre real de owners; sin mocks ni ejecución nueva del addon nativo.

qualification.tar.gz conserva 243 miembros: 92 fuentes originales, catálogos
Linux, logs, comandos/PIDs/exit, Windows, memoria y prueba LF con sus fuentes.
raw-files.json autentica cada miembro y receipt.json registra readback, tamaño
y SHA. Las 13510 dependencias reutilizadas se cotejaron con su manifest congelado,
incluido como dependencies.json. node_modules no se duplica: usar el lockfile
conservado y contrastar ese manifest para reconstruir.

Las 84 auditorías anteriores y los 12151 IDs permanecen. Ahora hay 105 registros
autorizados: 18 módulos,32 APIs,55 anclas auditadas, sobre 531/4374/7246. Las
clasificaciones acreditan Rust existente y conservan pendientes. No hay API o
módulo totalmente Rust nuevo ni porcentaje defendible de migración.

Se publican classification/summary idénticos entre Node22 y24. Referencia y
anclas siguen iguales a lo publicado. Las 4374 APIs coinciden; perfiles Node y
cuatro exclusiones ECMAScript difieren como exige el contrato original. Los
surface.json completos no son iguales entre versiones y se preservan ambos.

El audits.json probado inicialmente tenía CRLF. Se conservó íntegro; un snapshot
nuevo solo normaliza a LF. Los valores JSON no cambian y los dos CLI reales
producen los cinco archivos idénticos en bytes a sus respectivos originales.
lf-proof preserva ambas identidades, comandos y hashes. Ese control adicional
resuelve la publicación LF, sin repetir las suites ni atribuirles otras fuentes.

Los tres ciclos de memoria por Node retienen catálogos y observan Window y
Document separadamente. Sus endpoints claros son evidencia finita del inventario,
no prueba universal de fugas ni del runtime rustdom. No hay benchmark nuevo,
aceptación ownership, cambios de producción, checkpoint o merge en este hito.
