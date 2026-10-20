# Validación del fix Float64Array

Origen: review 4329732841 del PR 72, sobre `b7b1cf2`. El binding consultaba Float64Array.from mutable al refrescar snapshots genéricos. Ahora captura el factory y constructor de un realm intrínseco limpio; una captura directa del global se descartó porque rompía la importación cuando el constructor ya estaba alterado.

- Baseline: 144 escenarios diferenciales en ambos Node; reproducen errores y falsificación en children/form.elements. Document.forms y el realm Window separado son controles. Se conservan los fallos originales.
- Fix: 146 tests de regresión por runtime (144 escenarios más 2 padres), cambios en constructor/factory con null, reemplazo, getter e IDs falsos; colecciones nuevas/refrescadas y mutaciones Attr reales, default/VM.
- Suite completa: 3303 tests Node, 21 Jest, 32 Vitest y 32 VM por versión; 9 tests del validador. Después de ampliar solo el helper de GC: 147 focales y 34 escenarios de memoria por runtime, incluidos IDs genéricos retenidos bajo factory alterado.
- Build JavaScript real; addon SHA-256 idéntico `7f24a7e904b0aefbb673b20654ebfac1c2b1bfb0c601a483feec812ef6bb971b`. Rust/Cargo sin cambios: se reutilizan las 275 pruebas Rust previas; no se afirma haber repetido Cargo/Clippy/Memcheck.
- Benchmark real balanceado en ambos Node; 12 workers y 1296 muestras medidas, con todos los resultados/regresiones en `reports/benchmarks/collection-intrinsics/`.

El primer intento del validador falló por Cargo fuera del PATH (se corrigió el entorno y pasaron 9/9); el intento de captura directa produjo 14 fallos de FormData y se reemplazó. Ambos logs se preservan. `artifact.json` registra fuentes/artefactos exactos y alcance de la evidencia; `manifest.json` conserva hashes originales y comprimidos. Las verificaciones finitas no completan la migración integral ni certifican compatibilidad total.
