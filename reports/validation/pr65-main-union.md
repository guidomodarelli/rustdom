# Unión del PR 65 con main y trazabilidad de benchmarks

Validación del 15 de septiembre de 2026: head `f238ad06d838b8e8befa48aea92d79b5f3534bc7` unido con main `068f3bc3e65fe1c07a0dc6855bfc3f830f10a5d7`. El fix de trazabilidad procede del commit local `f85f88a969ba6d33f49da62dccc6f32712ae80a1`.

## Integración

La unión de código se resolvió automáticamente. Los siete conflictos pertenecían a reportes genéricos: se conservaron los bytes de ambos padres en `pr65-main-union/parents/`, antes de reemplazar los reportes actuales con una ejecución nueva. `pr65-main-union/context.json` identifica los padres y archivos.

Después de la validación completa se incorporó el fix de `benchmarks/compare.cjs`, su módulo `benchmarks/sources.cjs`, tests y documentación. Este fix no modifica fuentes del runtime, addon, dependencias ni tipos. La lista única de fuentes gobierna tanto el digest como el estado Git; incluye archivos sin seguimiento e ignorados. Las consultas Git fallidas quedan como metadatos no disponibles con diagnóstico seguro.

## Validación ejecutada

- `npm ci` y `npm run validate`: siete gates aprobados; 241 tests Rust y 1701 tests Node, Jest 14, Vitest 25 y VM 26.
- Corpus HTML: 1784/1784 casos comparables; ocho casos de scripting siguen excluidos.
- WPT: 151/151 fixtures con paridad y 48688 resultados comparables; 47504 aprobaciones de estándares y 1184 fallos compartidos. `complete: false`: persiste el bloqueo documentado de bootstrap CDATA de jsdom 27.4.0 en range-deletion. La paridad no certifica compatibilidad total.
- Paquete real: 18 gates en Node 24.14.1 y 18 en Node 22.12.0, mediante instalaciones npm y pnpm; todos con salida cero. Node 22 usa npm 11.19.0 conforme al fix de CI integrado.
- Tras integrar el fix de fuentes: 24/24 tests de benchmarks en Linux, incluyendo seis contratos del CLI con motores reales; 18/18 tests de fuentes/reportes/shards en Windows Node 24.20.0.

El addon validado y medido tiene SHA-256 `65e98dcebc71ffccd48cdfcd30a1267e0089672c807e85af38eb7f681b74fdb3`. El paquete probado tiene SHA-256 `907e0e8c96874a8da410f0bd95de3fd2f83bcdeaf72c33cb0b04980c53585fc5`. Se empaquetó antes del cambio documental y del harness; contiene el mismo runtime final, pero el README del archivo instalado es el anterior a esa ampliación documental.

Logs y resultados: `pr65-main-union/validation.json`, `full.log`, `package-node24.log`, `package-node22.log`, `benchmark-tests-linux.log` y `benchmark-tests-windows.log`; reportes de instalación `../distribution/2026-09-15T16-07-46.028Z-linux-x64.json` y `../distribution/2026-09-15T16-10-36.767Z-linux-x64.json`.

## Evidencia y recursos

El resultado WPT crudo se conserva sin pérdida como `../compatibility/2026-09-15T16-03-45.354Z-linux-wpt.json.gz`. `pr65-main-union/wpt-summary.json` registra tamaños, hashes SHA-256 del original y archivo comprimido, revisión WPT y verificación byte a byte al descomprimir.

Las suites de comportamiento incluyen las pruebas existentes de ciclos y ownership. La captura de fuentes es síncrona, anterior a los workers, sin cachés ni referencias persistentes al DOM; no cambia ownership Rust/N-API. Estas pruebas finitas no prueban ausencia absoluta de fugas.

Los reportes del CLI ejecutados como tests conservan muestras crudas, incluyendo diagnósticos de fallos esperados. Su propósito es verificar contratos y trazabilidad; no se usan para afirmar mejoras o regresiones de rendimiento porque la máquina también ejecutaba otras validaciones. El detalle del escenario que reproduce el comentario está en `benchmark-source-provenance.md`.

Ejecución adicional del harness integrado: `../benchmarks/2026-09-15T16-18-13.044Z-linux-x64.json`, `blob-endings` tamaño 100, cuatro procesos y dieciocho muestras por motor, outputs equivalentes. SourceHash: `fe6edcd2e5c780f362569d808dc93b6ca13c5075b79233a2aaa96989647282b3`. También es evidencia de integración, sin conclusión de rendimiento.
