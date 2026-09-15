# Validación del contrato de iteración XML

Alcance: métodos de iteración de `childNodes` y `attributes` en las firmas nativas `serializeXml` y `serializeXmlForest`. Referencia independiente: `w3c-xmlserializer` 5.0.0, dependencia de jsdom 27.4.0. No se alteran las particularidades compartidas de processing instructions ni system identifiers.

La reproducción inicial encontró 68 fallos entre 158 pruebas: tipo de excepción para resultados primitivos, diagnóstico de Symbol, métodos de iteración no invocables y acceso observable a `globalThis.Symbol`. Los casos de identidad de excepciones y precedencia de `return()` ya pasaban. El reporte inicial conserva los resultados esperados y obtenidos por escenario.

Decisiones:

- Crear `TypeError` mediante Node-API, conservando la clase intrínseca y los unidades UTF-16, sin consultar constructores reemplazables ni convertir valores lanzados por callbacks.
- Capturar la clave de iteración y el formateador de símbolos una vez por entorno N-API. La captura obtiene el prototipo desde un símbolo creado por Node-API; no depende de `globalThis.Symbol`. Un único contenedor pertenece al entorno y se libera en su finalización. Recargar el addon en el mismo entorno reutiliza ese contenedor. El contador `references` sigue midiendo las referencias temporales de cada serialización; el contenedor fijo de intrínsecos vive durante la vida del entorno.
- Mantener referencias del DOM únicamente durante la serialización síncrona. Los getters y callbacks continúan ejecutándose sin un préstamo mutable del estado del entorno.
- Mantener el cierre del iterador solo para errores del cuerpo y preservar el error original ante fallos de `return()`.

Límite: la captura inicial presupone que `Symbol.prototype.constructor` y `Symbol.prototype.toString` todavía son los intrínsecos del entorno. Las pruebas cubren sustitución de `globalThis.Symbol` antes de cargar el addon y sustitución de globals/métodos después de la carga; no afirman compatibilidad frente a un prototipo de Symbol ya manipulado antes de la inicialización. Los mensajes de iteración siguen el runtime Node/V8 comprobado; esto no certifica todos los motores JavaScript.

Resultados previos ejecutados sobre `9aa77e8e49f4452b1006837efd60f068f81caee5` (respaldo local `b692e73af0e78e1baf5e2019e56ef231e2d41949`) en Linux x64 (WSL Ubuntu 22.04), Node 24.14.1, addon N-API 8:

| Gate | Resultado |
| --- | --- |
| Build nativo release + build JavaScript | Correctos |
| `cargo fmt --check` | Correcto |
| `cargo clippy --all-targets -- -D warnings` | Correcto |
| `cargo test --locked` | 220/220 |
| Contratos XML focales | 347/347, incluidos 164 casos nuevos |
| Compatibilidad completa de `npm test` | 1465/1465 |
| Jest | 8/8 |
| Vitest | 19/19 |
| Vitest VM (forks y threads) | 26/26 |

Los logs completos se conservan en `reports/validation/xml-iterator/`. El addon validado tiene SHA-256 `f7ead1ad18d917300ef105ad00f057cbdda11a8e30a92ae907572dc56bfe0114`.

Node 22.12.0: 164/164 contratos focales correctos. GC ampliado: 15/15 ciclos alcanzaron dos muestras consecutivas sin supervivientes observados; al finalizar, `Window`, `Document`, nodos, callbacks, iteradores y errores tuvieron cero supervivientes, junto con cero serializaciones y referencias temporales nativas y cero errores de limpieza. Se conservan todas las rondas en `reports/memory/2026-09-15T13-51-01.788Z-xml-serialization.json`. Son pruebas finitas de esos escenarios, no una afirmación de ausencia absoluta de fugas. El benchmark se ejecutó posteriormente sobre el binario del PR 67, como se detalla más abajo. Windows y macOS no se ejecutaron localmente; corresponden a la matriz de CI.

Memoria: después de completar los primeros cinco escenarios como calentamiento, el heap pasó de 29.570.064 a 30.903.048 bytes, la memoria externa permaneció en 3.015.071 bytes y el RSS pasó de 160.788.480 a 169.885.696 bytes. Las muestras incluyen el propio reporte, que acumula trazas escalares durante los 15 ciclos; no son una medición de memoria pico ni permiten atribuir por sí solas el crecimiento a una fuga o al allocator. La evidencia de liberación corresponde a las referencias débiles y contadores comprobados en cada ciclo.
Tras la integración externa del PR 59, el mismo fix se trasladó sin conflictos al PR 67, `feature/native-form-data`, sobre `bf426c441cced03aed4ac575a53baddff452096e`. El commit local de traslado es `f1c64c5b6f0aa326b9f585cc0d2a062e7f8cedb4`; no se publicó el respaldo en la rama cerrada. La base remota `main` era `13f638bcade01fd80679236ccab4e7f891c78937` (el snapshot de base de la API del PR todavía indicaba el SHA anterior).

El cambio de base se clasificó como relacionado: cambiaron Cargo.toml/Cargo.lock, el build JavaScript y el helper compartido de excepciones. Se conservó `capture_pending_error` del nuevo estado y todos sus módulos/exports. `package.json` y `package-lock.json` permanecieron idénticos, por lo que se reutilizó solamente la instalación propia de dependencias.

Validación sobre el PR 67: build nativo y JavaScript correctos; formato y Clippy correctos; 244/244 tests Rust; 347/347 contratos XML; 164/164 contratos focales en Node 22.12.0; 15/15 ciclos de GC alcanzaron el endpoint. Logs en `reports/validation/xml-iterator/pr67/` y memoria en `reports/memory/2026-09-15T14-06-45.010Z-xml-serialization.json`. Binario SHA-256 `d54506de4e4c195c25d55ac45ba0cbc44fb69b96a165fafacbf4f94ddb1272c7`. La suite JavaScript completa también terminó correctamente: 2018/2018 de compatibilidad, 16/16 Jest, 27/27 Vitest y 26/26 VM. El benchmark final se completó después de integrar CI sin cambios de runtime.
El refresh de CI a `1b7534c7d420438d85424ac486bcb10e060a1479` se clasificó como `REMOTE_DRIFT_INDEPENDENT`: cambió únicamente `.github/workflows/ci.yml` y reportes. Los árboles de `src`, `scripts`, `benchmarks` y `types`, los blobs de Cargo.toml/Cargo.lock/package.json/package-lock.json y el SHA-256 del addon son idénticos antes y después. Se conservaron los gates anteriores y se ejecutaron controles de integridad; no se afirma haber repetido las suites tras este refresh. La comparación queda en `reports/validation/xml-iterator/pr67/refresh-ci.json`.

Benchmark final aislado: `node --expose-gc benchmarks/compare.cjs xml-serialize xml-serialize-error`, Node 24.14.1, jsdom 27.4.0. Cuatro procesos alternan jsdom/rustdom; cada caso usa tres warmups y nueve muestras por proceso, con 100 y 1000 filas. Se mide la operación pública completa sobre documentos preparados, incluido el puente N-API; se excluyen carga de módulos, construcción del fixture, validaciones, cierre y GC. El caso de error mide un fallo tardío de well-formedness, no el diagnóstico primitivo de `next()`. Los hashes de resultados coinciden, la activación nativa se verificó y las referencias temporales volvieron a cero.

| Operación | Filas | jsdom mediana (ms) | rustdom mediana (ms) | jsdom/rustdom |
| --- | ---: | ---: | ---: | ---: |
| Serialización XML | 100 | 2.768 | 7.541 | 0.37 |
| Error de well-formedness XML | 100 | 3.127 | 9.042 | 0.35 |
| Serialización XML | 1000 | 20.971 | 64.563 | 0.32 |
| Error de well-formedness XML | 1000 | 20.540 | 78.537 | 0.26 |

Rustdom fue más lento en las cuatro comparaciones. Esta es una medición del estado final contra jsdom, no un antes/después que demuestre mejora causada por el fix. Se guardaron hardware, versiones, configuración, hashes, muestras crudas e historia en `reports/benchmarks/2026-09-15T14-28-54.403Z-linux-x64.json` y su resumen Markdown. No se publicó el commit sobre la rama cerrada del PR 59 ni se crearon tags.