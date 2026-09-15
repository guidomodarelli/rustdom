# Integración del fix de AbortSignal en PR 67

El commit introductorio `7f107b3667adac1f32a26247c5ce90806751914a` se conservó localmente después del cierre externo del PR 54. Con el handoff `pr67-abort-retention-from-pr58-4013966259`, se trasladó exclusivamente ese commit sobre `bf426c441cced03aed4ac575a53baddff452096e`, en la rama autorizada `feature/native-form-data` del PR 67.

El cherry-pick produjo `cedd783209714d7d00988223daa17c82056d594e`. El único conflicto fue la suite compartida de integración: se conservaron todas las pruebas de PR 67 y se insertó la prueba de composición/aborto. Las modificaciones de producción son las mismas del fix introductorio, sin revertir FormData, FileReader, Blob, Storage, traversal ni el N-API vendorizado.

Se clasifica como integración de cambios relacionados y se ejecutan nuevamente instalación congelada, Rust, build, contratos AbortSignal, GC, compatibilidad y runners sobre el addon nuevo. Los logs de esta etapa están en `reports/validation/abort-retention-pr67/`. La metodología y los resultados sobre el addon anterior siguen en `reports/validation/abort-retention.md`; sus mediciones no se presentan como resultados del binario de PR 67.

## Primera validación sobre PR 67

Sobre `cedd783209714d7d00988223daa17c82056d594e`, el addon `64a34d2ca5c8714cb894582fcd06e8390a8b34426dd6749cabab52ce4d5cc34f` pasó instalación congelada, fmt, 246 tests Rust, clippy, build, 20 contratos focales AbortSignal/GC, 1.855 contratos de compatibilidad, 17 tests Jest, 28 Vitest y 26 en VM. TypeScript con `--noEmit` también terminó sin errores.

La memoria se midió nuevamente con este addon. El reporte `reports/memory/2026-09-15T14-19-08.088Z-abort-dependent-retention.json` contiene los 18 escenarios, incluido warmup, retención condicionada, excepción interrumpiendo aborto y teardown de `Document`/`Window`. No se reutilizó el resultado del addon anterior para dar esta validación por aprobada.

Esta primera validación antecede a los fixes concurrentes de CI y XML del PR 67. La publicación de AbortSignal está ordenada después de XML y requiere revisar el nuevo HEAD e integrar esos commits antes de la medición final.

## Integración de CI y XML y validación final del runtime

Se incorporó el remoto `1cbe98875c7bc02fdf7d008cfe9cbce999fbb179`, que contiene CI y el fix de iteradores XML. El conflicto de `.gitattributes` se resolvió conservando ambas reglas para logs. `package.json`, `package-lock.json`, `Cargo.toml` y `Cargo.lock` no cambiaron en ese refresh; se conservó la instalación congelada. Sí se repitieron Rust, build y los tests porque XML agregó intrínsecos por `Env` y un finalizador en el addon.

Una revisión adicional del nuevo callback de lifetime encontró una regresión: una función `Object.prototype.onChange` heredada era invocada al registrar/quitar listeners comunes en rustdom, mientras jsdom no la invocaba. `inherited-hook-before.log` conserva esa reproducción fallida. El registro ahora inicializa su callback propio en `null`, y dos casos diferenciales ejercen la modificación del prototipo mediante APIs reales. Esta protección integra el mismo fix de ownership.

Con el addon `fb12b3d1fa14ec020cf520734b30b927176bff4dc3632e3b9fe8072f882b89cd`, los gates de `merged/` terminaron en verde: 246 tests Rust, fmt, clippy, build, 207 tests focales Node 24 (AbortSignal, listeners y XML), 200 focales Node 22, 2.021 contratos completos, 17 Jest, 28 Vitest, 26 VM y declaraciones TypeScript. Los tests XML ejecutan los 164 casos nuevos de iteración junto al fix de AbortSignal.

Los tres reportes de memoria siguientes identifican este addon mediante su hash y vuelven a comprobar los 18 escenarios, con cero estados/enlaces de aborto al final y `Document`/`Window` recolectados de forma separada:

- `reports/memory/2026-09-15T14-40-22.656Z-abort-dependent-retention.json` (focal Node 24).
- `reports/memory/2026-09-15T14-41-18.744Z-abort-dependent-retention.json` (focal Node 22).
- `reports/memory/2026-09-15T14-42-10.186Z-abort-dependent-retention.json` (suite completa Node 24).

Estos resultados sustituyen la primera validación para evaluar el runtime integrado; los reportes anteriores se mantienen como evidencia histórica. La medición de rendimiento final debe usar este addon y una ventana sin los builds/tests pesados de las otras tareas.
