# FormData y File del entorno expuesto

Handoff `formdata-realm-3991528582-20260912`, asociado al comentario `discussion_r3991528582` del PR fuente #1. Base local: `eefde6320db875e53e71e07927c10077e4b1b60d` (`main`). Clone aislado, rama `feature/formdata-realm`. La publicación se consolidará en otra tarea autorizada: **NOT_STARTED_COORDINATED**. Este informe no acredita implementación remota, commit, PR ni closeout.

## Cambio y alcance

`Request.formData()` y `Response.formData()`, incluidos clones y respuestas de `fetch`, construyen `FormData` y `File` con los constructores del entorno expuesto. La rama URL encoded conserva decodificación nativa y convierte su resultado; multipart conserva el parser existente, bytes, MIME, nombres de archivo, orden y duplicados. Los archivos resultantes se consumen mediante el `FileReader` real de jsdom.

Los constructores se resuelven después del `await` de consumo. `dispose()` elimina sus referencias y las referencias a `Window`, `AbortController` y `EventTarget` del contexto compartido de closures. Una lectura que completa tras teardown rechaza con `TypeError: rustdom formData: environment has been disposed`. Esto permite liberar la ventana aunque se conserven clases, métodos, requests, responses o lecturas pendientes. Conservar un `FormData`/`File` devuelto puede mantener legítimamente su realm y queda fuera de este escenario de liberación.

El cambio ejecuta JavaScript y APIs Node/jsdom; no constituye una migración del parser multipart ni de FormData a Rust. Las pruebas cargan y ejercen el addon real del proyecto, sin mocks de plataforma. No se modifican los otros cuatro hallazgos del PR fuente.

## Reproducción y validación

Toolchain ejecutado: Node **v24.14.1**, Rust/Cargo **1.98.1**, Linux x64 bajo WSL2 `6.6.87.2-microsoft-standard-WSL2`, Intel Core i7-1360P. Dependencias instaladas mediante `npm ci`; no se copiaron `node_modules`. Los binarios del toolchain existente se usaron en lectura; caché Cargo, outputs y trabajo se mantuvieron en el clone temporal.

- [Baseline funcional](baseline-functional.log): **5 fallos** observables por identidad incorrecta de FormData, tanto multipart como URL encoded y en normal/VM.
- [Baseline de memoria](baseline-memory-normal.json): **4/4 Document y 4/4 Window retenidos** después de teardown, con lecturas pendientes y también tras completarlas.
- [Pruebas focales](focal.log): **16/16 aprobadas**, incluyendo FileReader binario, dos ventanas independientes, Request/Response/clones/fetch HTTP real, errores y consumo.
- [Gates completos](gates.json): **7/7 aprobados**. `cargo fmt --check`; `cargo clippy --all-targets -- -D warnings`; `cargo test --locked` (**100 tests**); `npm run build`; `npm test` (**304 compat, 7 Jest, 12 Vitest y 14 VM**); corpus HTML5; WPT.
- [Corpus HTML5](html5lib.json): **1.784 casos comparados, 0 mismatches**, con **8 casos script-on excluidos** de 1.792. Referencia independiente jsdom **27.4.0**. Se comparan serializaciones, no árboles normativos ni errores de parsing.
- [WPT](../../compatibility/2026-09-12T15-16-55.190Z-linux-wpt.json): **70 archivos y 43.708 casos con paridad** frente a jsdom; **42.678 aprobaciones normativas**. Las 1.030 fallas restantes son compartidas con la referencia. `range-deletion` conserva el bloqueo preexistente registrado en el reporte. Esto no certifica cumplimiento completo de estándares.

Los logs son los de comandos reales equivalentes a los siete gates de `npm run validate`, conservados en este subdirectorio para no sobrescribir históricos generales. No se compiló un addon Windows ni macOS en este clone. La integración consolidada requiere sus propios checks sobre el resultado combinado.

## Memoria focal

Los workers retienen, por modo, **144 owners/clones nativos**, **48 métodos de lectura**, los constructores Request/Response, fetch y callbacks de teardown. Crean **24 entornos**, observando por separado **24 Document y 24 Window**, con cuatro lecturas abiertas por entorno: Request y Response para multipart y URL encoded. Exigen quiescencia antes de completar los streams y después de completarlos, con dos muestras claras entre rondas asíncronas de major GC y contadores nativos en baseline.

| Modo | Document / Window sobrevivientes | Delta heap | Delta external | Delta RSS |
| --- | --- | ---: | ---: | ---: |
| [Normal](../../memory/2026-09-12T15-20-14.873Z-formdata-realm-normal.json) | 0 / 0 | 405.616 bytes | 72 bytes | 1.568.768 bytes |
| [VM](../../memory/2026-09-12T15-20-14.873Z-formdata-realm-vm.json) | 0 / 0 | 389.200 bytes | 72 bytes | 1.134.592 bytes |

Se conservan todas las muestras, rondas de GC y metadatos. Son escenarios finitos: no prueban ausencia absoluta de fugas. RSS incluye retención del allocator; estos resultados no miden pico de memoria ni ejecutan sanitizers.

La [prueba histórica de lifecycle](../../memory/2026-09-12T15-22-31.167Z-linux-x64.json), ejecutada con `npm run test:memory -- vitest vitest-vm`, también pasó: **0/440 Document y 0/440 Window** sobrevivientes en cada modo. Delta heap/RSS: **0,87 / -0,16 MiB** en Vitest normal y **0,49 / 11,41 MiB** en VM. Es una medición adicional de ownership del entorno; no demuestra que toda la memoria del proceso vuelva al valor inicial.

## Costo observado

El [benchmark reproducible](../../../benchmarks/formdata-realm.cjs) mide `new Response(body).formData()` completo con cinco muestras de warmup, veinte muestras medidas y veinte operaciones por muestra. Multipart usa un archivo binario de 4.096 bytes; ambos formatos incluyen campos duplicados. Bytes, MIME, filename, orden e identidad se verifican fuera del tiempo medido.

| Formato | [Baseline](../../benchmarks/2026-09-12T15-01-54.126Z-formdata-baseline.json) | [Corregido](../../benchmarks/2026-09-12T15-20-46.843Z-formdata-fixed.json) |
| --- | ---: | ---: |
| Multipart | 0,1917 ms/op | 0,3548 ms/op |
| URL encoded | 0,02161 ms/op | 0,02622 ms/op |

Se observó mayor costo en esta ejecución. El baseline devolvía objetos de un realm incorrecto y el corregido satisface el contrato; no son implementaciones equivalentes en compatibilidad. No se afirma mejora de rendimiento ni se atribuye la diferencia exclusivamente a una causa. Las muestras crudas y hashes de las fuentes/addon están conservados; la máquina compartida y WSL introducen variabilidad. El benchmark no mide throughput de parsing Rust ni incluye FileReader en el tiempo.

## Integración

Producción y tests quedaron congelados tras pasar los gates. La tarea que consolida los cinco hallazgos debe integrar el getter posterior al `await`, la liberación de referencias del realm y los tests de lectura pendiente; capturar los constructores antes del `await` reintroduce la retención observada. El helper `tests/integration/read-dom-file.cjs` debe viajar con las suites, ya que los consumidores del paquete copian `tests/integration`.

El [bundle de la variante aislada](isolated-source.zip) conserva los **11 archivos propios** de código, tests, benchmark y documentación con paths relativos. SHA256 del ZIP: `c74065e3ef59c4a40dd0a9a740b5ee4ff94609b4cdc4b18c17fcfe7f3f73a5de`. El [manifest](source-manifest.json) registra la base y cada hash; la [verificación por entrada](isolated-source-verification.json) confirma **11/11 coincidencias**. No incluye variables de entorno, herramientas, dependencias, binarios ni caches. Su finalidad es reproducir esta variante previa; no representa el resultado integrado de otra tarea.

Los [seis checks adicionales](postgates.json) también finalizaron aprobados: benchmark, memoria focal normal/VM, memoria histórica de entornos, `npm run package` y `npm run test:package`. Los [consumidores instalados](../../distribution/2026-09-12T15-24-57.274Z-linux-x64.json) completaron **18/18 pasos** con npm y pnpm, incluyendo TypeScript, CommonJS/ESM, assets, Jest, Vitest y ambos pools VM. No se publicó ningún paquete. `git diff --check` final pasó.

Estos resultados corresponden exclusivamente a la variante aislada; no acreditan la combinación con cambios de otra tarea. No se inició publicación ni se eliminó el clone.
