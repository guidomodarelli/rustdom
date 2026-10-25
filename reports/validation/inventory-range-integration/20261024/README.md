# Integración de la auditoría de Range

La auditoría ya forma parte del catálogo canónico: seis módulos y 32 APIs
revisadas, con 28 APIs híbridas y cuatro pendientes. No se agregó ninguna
aprobación Rust completa. Los denominadores siguen en 531 archivos, 4331 APIs
y 7246 anclas, en dimensiones separadas; migrationPercent sigue siendo null.

Se corrige un error de documentación de la entrega inicial: la prueba
tests/validation/migration-inventory.spec.mjs **no está entre los 563 pins**.
Tampoco lo están los ocho paths del inventario y su test listados en
membership.json. Esa lista procede del recibo canónico del método, cuyo hash
se conserva. Los 563 archivos se comprobaron intactos antes de integrar.
El ZIP initial-docs-4ea7de1a.zip preserva los documentos y recibos anteriores,
incluida la premisa errónea; no se reescribe la historia del commit publicado.

Se actualizó la prueba de auditorías para verificar los seis módulos, las 32
APIs y los cuatro estados pendientes de Range. El constructor de StaticRange
permanece híbrido: su candidato nativo es experimental y todavía está aislado.
No se acredita ese código al runtime de producción.

Los siete contratos y el CLI con auditorías por defecto pasaron en Linux con
Node 22.12.0 y 24.14.1. Los veinte miembros de qa.zip preservan logs, recibos y
los cinco catálogos completos por Node. Coinciden byte por byte con los catálogos
de la propuesta inicial ya validada. Solo se modificaron los catálogos canónicos
classification.json y summary.json: reference.json, surface.json e
implementation-units.json conservan sus bytes originales.

La validación usa el generador real, un jsdom 27.4.0 independiente y las 53
fuentes/evidencias locales verificadas. El generador no usa el addon rustdom.
Sus pruebas de GC comprueban tres ciclos con Window y Document separados;
son observaciones finitas, sin medición de memoria pico ni garantía universal.
La evidencia de comportamiento de Range sigue en la auditoría inicial, con A0
y sus límites explícitos respecto del guard de ownership y del candidato.

No se ejecutaron benchmarks ni otra captura. El estudio de ownership y sus
presupuestos permanecen independientes. La corrección no cambia filas,
muestras, semillas, warmup, estimador ni aceptación.
