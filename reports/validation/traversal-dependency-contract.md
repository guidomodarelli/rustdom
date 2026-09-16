# Dependencia de conversiones en traversal

El paquete importaba `webidl-conversions` desde `dist/tree-cursor.cjs` sin declararlo directamente. Una instalación real con pnpm 12.4.1, `node-linker=isolated` y `hoist=false` instaló el archivo original, pero falló al cargar el DOM con `MODULE_NOT_FOUND`. La reproducción y su archivo exacto están registrados en el reporte baseline.

Se declaró `webidl-conversions` en versión 8.0.1 tanto en `package.json` como en el lockfile. Es la misma versión transitiva que ya estaba fijada. El código del cursor, sus propietarios, callbacks y mecanismos de liberación no cambian.

La regresión del paquete ejerce `TreeWalker` y `NodeIterator` con filtros función y objeto, coerciones con efectos observables, overflow a unsigned short, rechazo frente a skip y recuperación después de un resultado Symbol inválido. Se ejecuta contra el archivo realmente instalado; no usa mocks ni inspecciona strings del código fuente.

## Validación final

La unión conserva CI, XML y Abort publicados hasta `0b507d9af1fc972888819e1f4400d314c6a688dc`.

| Runtime | npm 11.11.0 | pnpm 12.4.1 sin hoisting |
| --- | --- | --- |
| Node 24.14.1 | 10/10 gates | 10/10 gates |
| Node 22.12.0 | 10/10 gates | 10/10 gates |

Los seis casos de traversal pasan en las cuatro instalaciones. Cada matriz también verifica tipos, CJS, ESM/VM, Unicode, workers, Jest, Vitest y Vitest/VM. Los 412 tests focales de traversal, Abort/listeners y contratos del iterador XML pasan sobre la unión final.

Antes del refresh relacionado pasó `npm run validate`: formato, Clippy, 244 tests Rust, build, 1854 tests de compatibilidad, Jest 16, Vitest 27, VM 26, 1784 casos HTML compatibles con 8 script-on excluidos y contratos WPT. Es evidencia del estado anterior `bf426c4`; el reporte final distingue las comprobaciones ejecutadas después del refresh.

Los reportes JSON de distribución conservan stdout, stderr, comandos, versiones, locks y hash del archivo. El JSON WPT completo se conserva comprimido sin pérdida; el contexto de la validación base registra los SHA256 y verifica que la descompresión recupera exactamente sus bytes.

El paquete validado es Linux x64/glibc; no se ejecutaron localmente Windows ni macOS. No se publicaron paquetes npm. El cambio de dependencia no agrega ownership ni requiere afirmar mejoras de rendimiento o ausencia absoluta de fugas.
