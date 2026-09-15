# Integración del fix de AbortSignal en PR 67

El commit introductorio `7f107b3667adac1f32a26247c5ce90806751914a` se conservó localmente después del cierre externo del PR 54. Con el handoff `pr67-abort-retention-from-pr58-4013966259`, se trasladó exclusivamente ese commit sobre `bf426c441cced03aed4ac575a53baddff452096e`, en la rama autorizada `feature/native-form-data` del PR 67.

El cherry-pick produjo `cedd783209714d7d00988223daa17c82056d594e`. El único conflicto fue la suite compartida de integración: se conservaron todas las pruebas de PR 67 y se insertó la prueba de composición/aborto. Las modificaciones de producción son las mismas del fix introductorio, sin revertir FormData, FileReader, Blob, Storage, traversal ni el N-API vendorizado.

Se clasifica como integración de cambios relacionados y se ejecutan nuevamente instalación congelada, Rust, build, contratos AbortSignal, GC, compatibilidad y runners sobre el addon nuevo. Los logs de esta etapa están en `reports/validation/abort-retention-pr67/`. La metodología y los resultados sobre el addon anterior siguen en `reports/validation/abort-retention.md`; sus mediciones no se presentan como resultados del binario de PR 67.

## Primera validación sobre PR 67

Sobre `cedd783209714d7d00988223daa17c82056d594e`, el addon `64a34d2ca5c8714cb894582fcd06e8390a8b34426dd6749cabab52ce4d5cc34f` pasó instalación congelada, fmt, 246 tests Rust, clippy, build, 20 contratos focales AbortSignal/GC, 1.855 contratos de compatibilidad, 17 tests Jest, 28 Vitest y 26 en VM. TypeScript con `--noEmit` también terminó sin errores.

La memoria se midió nuevamente con este addon. El reporte `reports/memory/2026-09-15T14-19-08.088Z-abort-dependent-retention.json` contiene los 18 escenarios, incluido warmup, retención condicionada, excepción interrumpiendo aborto y teardown de `Document`/`Window`. No se reutilizó el resultado del addon anterior para dar esta validación por aprobada.

Esta primera validación antecede a los fixes concurrentes de CI y XML del PR 67. La publicación de AbortSignal está ordenada después de XML y requiere revisar el nuevo HEAD e integrar esos commits antes de la medición final.
