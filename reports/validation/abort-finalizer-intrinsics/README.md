# Intrínsecos privados del ownership de AbortSignal

Se corrigió el finalizador señalado en [PR67, comentario 4019357321](https://github.com/guidomodarelli/rustdom/pull/67#discussion_r4019357321). `Map.prototype.delete` podía reemplazarse después de cargar el runtime; al recolectarse una señal, el finalizador ejecutaba ese hook de usuario. La reproducción terminó con una excepción no capturada desde `dist/abort-signal.cjs:8`, dejando sin ejecutar la eliminación de la entrada numérica/WeakRef del índice.

## Identidad y alcance

- Handoff: `pr67-abort-finalizer-intrinsic-4019357321`.
- Clon Linux propio: `/home/guido/rustdom-abort-finalizer-h1rhABSj`.
- Rama `feature/native-form-data`, baseline DCE `dce2472a1f093c6d9e4a768ffe454a5c4b2d3348`; `main` verificado en `ece7d46c9cdb94eea3c23e517b341771ee9719d4`.
- El clon y commit anterior `b09cc02491d20b79270c01c69006c336f0edbae7` permanecieron intactos. No se trabajó sobre el checkout Selection ni sobre el clon de integración de la tarea principal.
- Se compararon byte a byte 147 archivos de `src/`, build, Cargo y package/lock contra la copia Linux DCE de referencia. Se reutilizó únicamente el addon y su loader verificado; se generó el JS desde las fuentes del clon, antes y después del cambio. `reused-native.json` conserva hashes y procedencia.
- Addon SHA-256: `1f5cb1d86c660f6e1681638474c64e45d6de6c84b67919c5cc70be6a1b452f83`, N-API 8, Linux x64/glibc 2.35. No se presenta esta reutilización como otro build Rust.

El cambio de producción está limitado a `src/dom/abort-signal.cjs`. Captura al inicializar el módulo los constructores Map/WeakMap/WeakRef y sus operaciones utilizadas, el getter de size y la operación de registro del FinalizationRegistry privado. El finalizador elimina mediante la operación intrínseca capturada. No guarda holdings con señales, documentos ni ventanas; los holdings siguen siendo números.

Se conservan en Rust el grafo, marcado, orden, identidad de algoritmos, fuentes y detach. El adapter conserva el ownership de V8: índices débiles y retención fuerte condicionada a trabajo observable. Los cambios no amplían la API pública ni introducen modos de prueba. No se modificaron EventTarget, el Set heredado de handlers, XML, FormData, Rust ni `napi_error.rs`.

## Reproducción y criterio para ampliar el fix

Antes de corregir producción se ejecutó cada operación en un proceso real contra jsdom 27.4 independiente y contra la baseline DCE. La reproducción roja usa Node 24.20.0. Se guardan todos los `baseline-*.json` y logs; cada fallo de rustdom tiene su primer frame del runtime en el adapter Abort.

| Superficie | jsdom | DCE |
| --- | --- | --- |
| Finalizador con Map.prototype.delete reemplazado | 200 señales recolectadas; hook 0 | Excepción no capturada; exit 1 |
| Constructores Map, WeakMap y WeakRef | Sin invocar los hooks | Hook invocado desde el constructor de AbortSignal |
| Map get, set, has, delete y size | Abort y algoritmos correctos | Hook invocado desde el ownership privado |
| WeakMap get, set y delete | Abort y algoritmos correctos | Hook invocado desde el índice de algoritmos |
| WeakRef.deref | Composición y abort correctos | Hook invocado al resolver un owner |
| FinalizationRegistry.register | Construcción correcta | Hook invocado al registrar la señal |

Las pruebas finales conservan las afirmaciones estrictas y ejercen también retirada de algoritmos primitivos y reconstrucción de los mapas vacíos. El helper usa instancias y callbacks reales; las mutaciones temporales de prototipos/globals representan código consumidor y se restauran mediante `finally`. No se exportó el índice privado para observarlo.

`uncaughtExceptionMonitor` sólo guarda datos escalares: no maneja la excepción ni convierte el fallo en éxito. El proceso padre exige exitCode 0, ausencia de signal/error, `pass=true`, hook 0 y lista de excepciones vacía; compara los resultados observables con jsdom. El finalizador defectuoso conserva su salida no cero en el reporte rojo.

Se preservaron dos fallos iniciales de preparación como `setup-*`: faltaba copiar el pequeño loader del addon, y el primer helper mantenía el último controller en un frame asíncrono. Se corrigieron la preparación y el alcance de esa referencia antes del rojo definitivo, conservando las afirmaciones de recolección exacta; no se debilitó ninguna expectativa para obtener verde.

## Validación final

| Runtime | Intrínsecos/oracle | npm test: compat | Jest | Vitest | VM |
| --- | ---: | ---: | ---: | ---: | ---: |
| Node 22.12.0 | 14/14 | 2122/2122 | 18/18 | 29/29 | 30/30 |
| Node 24.20.0 | 14/14 | 2122/2122 | 18/18 | 29/29 | 30/30 |

Se ejecutó `node scripts/build.mjs`, `node --test tests/abort-intrinsics.spec.cjs` y `npm test` con cada runtime. Los runners ejercieron ambos pools reales, `vmForks` y `vmThreads`, sin mocks de plataforma. `validation-summary.json` guarda los conteos comprobados contra los logs completos. La traza nativa exacta, el delta de tres estados nativos, los listeners signaled y la integración de señales host hacia DOM permanecen en sus pruebas originales.

GC repitió cinco ciclos de 200 señales bajo el hook activo en ambos Node y ambos motores: witness 1000, hook 0, excepciones 0; señales, Window y Document fueron recolectados. En Rust: created 1000, released 1000, live/links/algorithms 0. Se ejecutaron además los controles existentes de source vivo, dependientes activos/inactivos, callbacks, razones, aborto interrumpido y teardown extranjero. Metodología y muestras: `../../memory/abort-finalizer-intrinsics/README.md`.

El benchmark existente comparó DCE y candidata en una ventana coordinada, con el mismo addon y muestras crudas de ambos motores. Las medianas brutas de la candidata fueron 1,7–10,1% mayores; el control jsdom también aumentó 8,7–13,0%. No se atribuye esa variación al cambio ni se afirma una mejora: `../../benchmarks/abort-finalizer-intrinsics/README.md` conserva todos los valores y límites.

Los reportes históricos que las suites regeneraron se preservaron sin sobrescribir su versión anterior. Los resultados Abort relevantes están versionados en el namespace de este fix; los otros outputs locales siguen archivados según `generated-report-archive.json`. No quedan cambios en dependencias ni en sus lockfiles. La entrega es un commit local y un format-patch; la tarea principal integra y publica la unión.
