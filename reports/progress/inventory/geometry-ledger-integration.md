# Geometría integrada al ledger de auditoría

La propuesta publicada en `948de64e` permanece como antecedente inmutable.
Se incorporan 42 clasificaciones: cinco módulos, veinte anclas y diecisiete
APIs. Los derivados classification/summary están regenerados. Las 42
clasificaciones anteriores y los 12151 IDs existentes permanecen iguales.

| Dimensión | Total observado | Clasificaciones auditadas | Estados auditados |
| --- | ---: | ---: | --- |
| Módulos | 531 | 16 | 10 híbridos, 6 pendientes |
| APIs | 4374 | 23 | 23 híbridas |
| Anclas de cuerpos | 7246 | 45 | 19 Rust existentes, 8 híbridas, 18 pendientes |

Estas dimensiones se solapan y no se suman. Las diecisiete anclas numéricas
agregadas representan Rust existente: dieciséis getters/setters y el snapshot
de toJSON. Constructor y dos fromRect siguen híbridos. Las diecisiete APIs de
geometría conservan branding, conversiones, factories, defaults o errores JS;
los tres módulos generados siguen pendientes. Los dos símbolos de metadata
no reciben crédito de algoritmos. Cada fila liga fuentes, pruebas y pendientes.

`reference.json`, `surface.json` e `implementation-units.json` del catálogo
conservan exactamente sus bytes respecto de f9e3cf98. Las fuentes DOMRect
siguen iguales a checkpoint67; no se implementó ni recompiló producto.
No se acredita una API o módulo Rust completo por completar un cuerpo numérico.
`scopeClosed=false` y `migrationPercent=null` permanecen intactos.

La validación pasa doce contratos por Node en Linux22.12.0/24.14.1 y en
Windows22.12.0/24.22.1. Incluye DOMRect real de jsdom27.4.0: lectura del
diccionario height/width/x/y, bordes negativos, descriptores y branding; también
rechaza completitud sin evidencia o con pendientes y verifica liberación de
Window/Document al retener reportes escalares. No usa mocks de plataforma.

Los generadores Linux producen las mismas fuentes, anclas, clasificación,
resumen y 4374 registros API. La superficie completa registra el Node real:
Node24 también expone cuatro intrínsecos ECMAScript que el contrato ya excluye
del denominador. Ambas superficies originales se conservan. No se oculta esa
diferencia ni se promete igualdad de bytes de surface.json entre versiones.

Evidencia en `reports/validation/inventory-geometry-ledger/`: 204 archivos en el
tar con 76 fuentes de calificación, comandos, resultados, hashes y readback.
Las 13510 dependencias reutilizadas coinciden con el árbol histórico congelado;
node_modules no se duplica en el tar y se reconstruye con el lockfile/manifiesto.
Se conservan los fallos de preparación y de comparación del arnés, incluido el
timeout del CLI sobre NTFS montado. En disco Linux pasa con el mismo límite de
30 segundos. No se repiten tests para corregir solo la lectura de sus reportes.

Los JSON de memoria están en `reports/memory/inventory-geometry-ledger/`.
Este cambio de auditoría no ejecuta un addon ni mide DOMRect de nuevo: liga
la implementación existente a su evidencia histórica y añade contratos del
catálogo. No hay benchmark nuevo ni afirmación de mejora. El hito ownership
PR80 sigue abierto; esta integración no autoriza merge, tag ni avanzar otra
fase del runtime antes de cerrar ese hito.
