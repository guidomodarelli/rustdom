# Validación de la ronda 4 del PR #24

Los tres hallazgos de esta ronda afectan las guardias de argumentos de Request/fetch, la resolución de URLs y la procedencia de los informes. El cambio conserva el TypeError original del entorno activo para errores propios y captura el getter original de Node.baseURI antes de beforeParse. El getter se libera explícitamente durante dispose; los errores arbitrarios del consumidor siguen propagándose sin clasificación por mensaje o nombre.

Se creó un clone efímero nuevo desde `959aa647f0cf376a5953136dd8b506e0d255d751` y se integró main `5a572dfdf5c3d9c62d621bcfe85922ce951841a4` mediante merge normal `0ba247680c8d5dde9e800b985c9b3e23b1327e6c`. El avance de main incorpora geometría nativa, build y medición de memoria: se clasifica como `REMOTE_DRIFT_RELATED`. No se reutilizan como validación de esta unión los gates de rondas anteriores. La instalación con `npm ci` y el build real `npm run build` terminaron correctamente en Linux/WSL, con Node 24.14.1 y Cargo 1.98.1; caches propios del clone y toolchains originales usados solo en lectura.

`baseline.json` conserva el estado previo al patch y los logs originales: 14 de 42 pruebas de intrínsecos fallaron, Vitest normal falló en 1 de 18 y VM en 4 de 26. Las fallas muestran la invocación del getter manipulado, la URL falsa y la identidad incorrecta del TypeError VM. `focal.json` registra las mismas pruebas después del patch: 42 de 42, 18 de 18 y 26 de 26, con fuentes y addon sin cambios durante la ejecución.

Las regresiones usan el addon, los entornos normales, vmForks/vmThreads y un servidor HTTP local reales. Cubren sustitución y eliminación de TypeError, sombras en Document y sus prototipos desde beforeParse, cambios auténticos de base/history/reconfigure, Request nativo y constructores retenidos después del cierre. No se agregaron mocks de plataforma ni assertions sobre texto fuente.

Los informes nuevos de FormData incluyen los módulos del entorno realmente importados: Vitest, window, web-platform, multipart, mime-type, lifecycle y window-errors. También conservan lockfile, addon y sus drivers de medición. Los informes históricos quedan intactos. Estos fingerprints identifican esta ruta de medición; el manifest más amplio de cada gate registra además fuentes, tests, tipos y configuración nativa. No constituyen una promesa de fingerprint recursivo de cada archivo interno de dependencias externas.

La memoria ejercita referencias fuertes a Request/Response, sus métodos, clones, fetch y cuatro lecturas pendientes por ventana. Document y Window se observan por separado, tanto antes de completar los streams como después. Los benchmarks guardan muestras crudas y verifican resultados equivalentes; esta ruta incluye Node y wrappers jsdom, y no representa un DOM completamente migrado a Rust ni demuestra ausencia absoluta de fugas.

## Resultados de la unión validada

`all.json` registra nueve gates aprobados: Rustfmt, Clippy, 118 tests Rust, `npm test` (456 Node, 7 Jest, 18 Vitest y 26 VM), corpus HTML5, WPT, estrés de memoria, `npm run package` y `npm run test:package`. Los consumidores npm y pnpm pasaron sus 18 comandos de instalación, tipos, CommonJS, ESM/VM, assets, Jest y Vitest. El paquete se construyó sin publicarlo. `validation-runner.cjs` conserva los comandos exactos y las rutas de herramientas usadas en esta máquina.

El corpus comparó 1784 casos compatibles y mantuvo 8 casos script-on excluidos. WPT confirmó paridad en 43.708 casos, con 42.678 assertions normativas aprobadas; mantiene `complete: false` por el bootstrap bloqueado de `range-deletion`, documentado en el informe. No se presenta como conformidad completa con los estándares. El nuevo resultado del corpus está en `html5lib.json`; el informe anterior del repositorio se preservó.

Los informes de memoria nuevos liberaron los 24 documentos y 24 ventanas por modo con lectores retenidos. El estrés adicional liberó 882 documentos y ventanas de rustdom y 880 por modo de Vitest. El crecimiento de RSS observado fue 17,59 MiB para rustdom, 39,02 MiB para Vitest normal y 88,50 MiB para VM, dentro de los presupuestos del runner; las muestras y límites se conservan en `reports/memory/2026-09-12T20-10-02.542Z-linux-x64.json`.

La tarea principal confirmó CPU libre desde `2026-09-12T20:13:48.117Z`; nuestros gates terminaron a `20:14:41.859Z`. Los benchmarks comenzaron después, a `20:15:19.184Z`, y se ejecutaron secuencialmente. `benchmarks.json` y `summary.json` registran horarios, hashes y `sourcesUnchanged: true`.

| Operación | jsdom | rustdom | Relación jsdom/rustdom |
| --- | ---: | ---: | ---: |
| Setup normal, mediana | 11,335 ms | 17,285 ms | 0,66× |
| Setup VM, mediana | 9,052 ms | 8,187 ms | 1,11× |

El benchmark completo de FormData registró medias de 0,2280 ms por operación multipart y 0,02956 ms para urlencoded, con identidad de realm, bytes y campos correctos. Conserva 20 muestras de 20 operaciones por formato después de 5 muestras de warmup. No establece una mejora causal frente a otras rondas, ni un speedup general: el setup normal sigue siendo más lento en esta medición. `summary.json` verifica los 11 fingerprints de cada informe nuevo de FormData contra sus archivos reales, incluido `mime-type.cjs`.
