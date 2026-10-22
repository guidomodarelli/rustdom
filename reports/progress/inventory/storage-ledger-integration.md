# Storage incorporado al inventario con evidencia real

Se incorporan 21 clasificaciones de implementación existente: dos módulos,
diez anclas de cuerpos y nueve APIs. Las 84 clasificaciones anteriores siguen
intactas. La propuesta de f9e3cf98 y la geometría publicada en eaf1a736 permanecen
como antecedentes; este hito no agrega código Rust ni modifica producción.

| Dimensión | Denominador | Auditadas | Estados entre las auditadas |
| --- | ---: | ---: | --- |
| Módulos | 531 | 18 | 11 híbridos, 7 pendientes |
| APIs | 4374 | 32 | 29 híbridas, 3 pendientes |
| Anclas de cuerpos | 7246 | 55 | 23 Rust existentes, 11 híbridas, 21 pendientes |

Los 12151 IDs se mantienen. Las dimensiones se solapan y no se suman. Las cuatro
anclas Storage acreditadas usan datos, orden y cursores existentes en Rust; no
completan las seis APIs que conservan WebIDL/Proxy. Constructor público y accesos
globales siguen pendientes. Constructor interno y toStringTag no reciben crédito.
El alcance sigue abierto: scopeClosed=false, migrationPercent=null.

Rust conserva estado UTF16, cuota, orden y cursores. El bridge conserva guards,
programación de eventos y commit; wrappers, branding/coerción/Proxy; Window,
acceso por origen. Cada fila liga fuentes existentes, pruebas e historia.
La clasificación mantiene separadas esas responsabilidades y su trabajo pendiente.

Pasaron 13 contratos por perfil en Linux22.12.0/24.14.1 y
Windows22.12.0/24.22.1, sin omisiones. El contrato Storage usa jsdom27.4.0 real:
ausencia y string vacío, UTF16 y surrogate aislado, separación de áreas,
overwrite sin reordenamiento, reinserción, enumeración, constructor ilegal,
branding y origen opaco. Espera timers reales y cierra ambos owners, sin mocks.
No equivale a validar de nuevo el addon nativo.

Ambos CLI Linux y tres ciclos de memoria por versión terminaron con exit0.
Se retienen los tres catálogos durante la observación y Window/Document se
recolectan por separado. Evidencia en reports/validation/inventory-storage-ledger/
y reports/memory/inventory-storage-ledger/. No se afirma ausencia universal de
fugas ni mejora de rendimiento. El benchmark ownership sigue rechazado.

Los catálogos de ambas versiones preservan los denominadores y las 4374 APIs.
Referencia y anclas son idénticas a las publicadas. Los perfiles Node y cuatro
globals ECMAScript excluidos difieren como antes: no se afirma identidad binaria
completa de surface.json entre Node22 y24. classification/summary sí coinciden.

La calificación original probó audits.json con CRLF. Para publicar LF se mantuvo
ese snapshot y se creó otro con el único cambio de finales de línea: mismos
valores JSON. El CLI real en ambos Node produjo los cinco archivos idénticos en
bytes a sus respectivos originales. Se conservan ambas fuentes y sus hashes;
no se atribuyen retrospectivamente los tests originales a bytes distintos.
