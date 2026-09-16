# Selection nativa: validación local completada

El estado final, basado en main y checkpoint-055-form-data, está documentado en [selection-final.md](selection-final.md). Incluye pruebas completas, GC, paquetes en Node22/24 y benchmarks finales con sus regresiones. El resto de este informe conserva la evolución y evidencia histórica; sus resultados intermedios no sustituyen el estado final. La integración de Selection en main sigue condicionada a su PR, checks y revisión.

## Implementación y ownership

- `src/dom/selection.rs` conserva dirección y decisiones escalares.
- `selection_binding.rs` expone estado y contadores sin referencias JavaScript.
- `selection_operations.rs` controla lecturas, asociación, collapse/extend,
  setBaseAndExtent, selección de hijos, borrado, pertenencia y stringificación.
  Los valores/callbacks del host viven solo durante la llamada N-API síncrona;
  no se usan referencias persistentes ni wrappers de handles sin ownership.
- `selection.cjs` conserva el Range compartido y el realm como referencias
  visibles a V8. Conecta las factories reales, excepciones y tareas de
  selectionchange. Reemplaza el algoritmo privado de Selection en el build.

La dirección se mantiene en Rust sin esconder ciclos Selection/Range/Window
del GC. El driver captura excepciones pendientes para preservar también
primitivos lanzados por el host. Los callbacks pueden reentrar sin conservar
un préstamo mutable del estado nativo.

## Evidencia disponible

El reporte `reports/compatibility/2026-09-15T08-37-14.207Z-linux-wpt.json.gz`
compara 35 fixtures Selection upstream en el revision WPT
`8d124dbe46f46f55531f28f13eccf1113f794c12` contra jsdom 27.4.0:
33.492 resultados en paridad, 33.489 aprobados de estándar y tres fallos
compartidos. Se conserva cada resultado y diagnóstico. Es un corpus acotado,
no una certificación completa de estándares.

Los contratos focales cubren default/VM, identidades, cambios de dirección,
mutaciones del Range compartido, roots, errores y tareas. La ampliación agrega
conversiones reentrantes y excepciones primitivas a través del puente nativo.
El primer escenario de Range desconectado encontró un error de jsdom al
extender hacia otra raíz; se conserva el log original y se compara ese error,
sin asumir que el oracle acepta la operación.

## Contratos, runners y memoria focal

`selection/contracts.log` pasó 24 contratos (22 diferenciales y dos del addon
real). `selection/jest.log` pasó 17 tests, `selection/vitest.log` 28 y
`selection/vm.log` 26 en vmForks/vmThreads. El contrato nuevo compartido ejerce
los globals de Jest/Vitest; los pools VM conservan sus contratos de plataforma
y aislamiento, sin atribuirles el nuevo caso de la suite DOM normal.

`reports/memory/2026-09-15T08-50-03.239Z-selection.json` pasó 14 escenarios
con 100 ciclos por escenario, entre jsdom/rustdom y default/VM. Se retienen
Selection, Range y estado nativo por separado, se cierra Window y luego se
libera el owner. Las referencias débiles y contadores regresaron al baseline;
retener el estado nativo aislado no mantuvo Window ni Document vivos.
El reporte conserva heap, external, RSS y cada intento de recolección.

`selection/native-gc.log` pasó otros 1.000 ciclos, con 8.000 operaciones
nativas, excepciones primitivas y reentrada. No quedaron Window, Document,
Selection ni Range observados; se creó y liberó una instancia de estado,
con cero operaciones activas y cero errores de limpieza N-API al finalizar.
Estas observaciones finitas no acreditan ausencia universal de fugas.

La ejecución general anterior pasó formato, Clippy y 246 tests Rust, además
de Node y los runners indicados arriba, y se interrumpió al reiniciarse WSL.
Ese proceso terminó; la nueva ejecución completa del apartado siguiente lo sustituye como evidencia vigente.

## Gates pendientes

Integración de las correcciones finales de PR67 y optimización del rendimiento medido. El gate Memcheck conserva un diagnóstico de Node/OpenSSL y no se declara limpio.
No presentar este archivo como aprobación de esos gates antes de anexar
sus reportes ejecutados. El indicador global permanece en 45,8% por áreas.

## Revisión de ownership del trabajo sin commit

El 15 de septiembre se revisaron las referencias que atraviesan
`selection.cjs`, `selection_operations.rs` y `selection_binding.rs`, incluyendo
reentrada y salida por excepción. El estado Rust conserva solo la dirección;
Range y realm permanecen visibles a V8. Los valores `Unknown` y funciones del
host se usan dentro de la invocación síncrona; el guard reduce el contador de
operaciones activas en todas las salidas. No se encontró una referencia
persistente nueva que retenga el DOM en esos caminos revisados.

Las tareas `selectionchange` conservan temporalmente el Document capturado,
como jsdom 27.4.0. Su liberación depende de drenar los timers; no equivale a
recolección inmediata al llamar `close()`. Los helpers existentes drenan tareas,
observan Window y Document por separado y prueban liberar primero los wrappers
y después sus owners. Esta revisión de código no sustituye los gates pendientes
ni agrega nuevas ejecuciones a la evidencia anterior.

## Validación completa sobre DCE (15/09/2026, 19:20 UTC)

La copia de trabajo se integró sin conflictos de código sobre
`dce2472a1f093c6d9e4a768ffe454a5c4b2d3348`. Los cuatro conflictos de reportes
conservaron ambas versiones byte por byte en `selection-rebase/parents/`.
Los 116 archivos sin seguimiento se verificaron contra el stash propio;
no se modificaron los stashes de MutationRecord ni Range.

La copia Linux usa las mismas fuentes que la rama local: SHA-256
`0e0ea222f4b4fc094d8b77058127c0baa5599684848948e4fa163fa05723d3f8`.
`selection-final/source-copy.json` registra la identidad completa. El directorio
Linux conserva metadatos Git anteriores: el hash de contenido acredita las
fuentes ejecutadas, no su HEAD heredado.

`selection-final/validation.json` pasó los siete gates con Node 24.20.0:
formato, Clippy, 251 tests Rust, build, 2.132 contratos Node, Jest 19,
Vitest 30 y VM 30, corpus HTML5 y WPT. HTML mantiene 1.784 casos comparables
con ocho exclusiones. WPT tiene 216 fixtures en paridad, 82.304 resultados,
81.104 aprobados de estándar y 1.200 fallos compartidos con jsdom 27.4.0.
El corpus sigue incompleto: Range-deleteContents conserva el bloqueo CDATA
del bootstrap y el caso de submitter con click real sigue excluido.

El resultado WPT completo se conserva comprimido sin pérdida en
`reports/compatibility/2026-09-15T19-22-12.811Z-linux-wpt.json.gz`.
`selection-final/wpt-summary.json` registra tamaños, hashes y la comprobación
byte por byte de descompresión. No se eliminaron resultados desfavorables.

`reports/memory/2026-09-15T19-25-32.716Z-selection.json` aprobó 14 escenarios
con 100 ciclos cada uno. El estrés adicional completó 1.000 ciclos y 8.000
operaciones sin supervivientes Window, Document, Selection ni Range; se creó
y liberó un estado nativo, con cero operaciones activas y errores de cleanup.
Estas pruebas finitas no prueban ausencia universal de fugas. Los resultados
de Memcheck, distribución y rendimiento se anexarán al concluir sus ejecuciones.

## Distribución instalada y Memcheck

El artefacto `rustdom-rustdom-0.1.0-alpha.0-linux-x64-glibc-2026-09-15T19-47-02.642Z.tgz`
tiene SHA-256 `56be355fcfc9776fe0e68b429c1d3fb084c1b371baf5f2d7d5f9585b070b2859`.
Se instalaron copias fuera del checkout con npm y pnpm aislado. Los 20 gates
por versión pasaron en Node 24.20.0 y 22.12.0: tipos CJS/ESM, comportamiento de
consumers, assets, workers y runners reales. Reportes:
`reports/distribution/2026-09-15T19-47-05.025Z-linux-x64.json` y
`reports/distribution/2026-09-15T19-48-23.077Z-linux-x64.json`.
El arnés de benchmarks aprobó 34 tests; sus mediciones de prueba no se usan
como evidencia de rendimiento de Selection.

`selection-final/memcheck.md` describe el addon cargado con 10 y 1.000 ciclos:
cero supervivientes observados, sin incremento de pérdidas definitivas o
indirectas frente al control. Ambos modos DOM reportan 24 B definitivos en
OpenSSL dentro de Node, también reproducidos sin addon. No se suprimió ese
hallazgo ni se declara un gate Memcheck limpio. La diferencia de 164 B
posiblemente perdidos corresponde a inicialización de estructuras de Rust/N-API
y no creció entre 10 y 1.000 ciclos. Se preservaron todos los logs y controles.


## Rendimiento y memoria Rust

Los diez benchmarks pasaron su validación de resultados, pero rustdom fue más lento
en todos. Con 1.000 operaciones los ratios jsdom/rustdom van de 0,109 a 0,203.
Ver `selection-final/benchmarks.md` y las muestras crudas enlazadas allí.
No se declara cumplido el objetivo de alto rendimiento.

Las dos pruebas Rust nuevas de Selection también pasaron Memcheck con código
de salida cero. `selection-final/rust-memcheck.json` registra el ejecutable,
SHA y nombres exactos. Ese gate acotado no sustituye el análisis del addon
cargado ni elimina el diagnóstico de Node/OpenSSL descrito previamente.

## Integración de las correcciones publicadas del PR67

La rama local quedó sobre `66865bcb991b77b82ecb979feddc100366b502c9`.
No hubo conflictos de código. Se conservaron los dos lados de ocho conflictos
de reportes en `selection-rebase-668/parents/`, con hashes en su contexto.
Los 238 archivos del backup y los 203 archivos sin seguimiento restaurados
se verificaron; no hizo falta modificar finales de línea. Los stashes de
MutationRecord y Range permanecen intactos, además de los backups propios.

El contenido para la nueva validación tiene SHA-256 de fuentes
`2b6eb990f1b0f7dfc339ee26e7cef47868fcf79a4a5f4041cd59c6d5985d80de`.
El directorio `selection-on-668/` registrará las comprobaciones de esta unión.
Los resultados anteriores de DCE mantienen su identidad; no se presentan como
pruebas ya ejecutadas sobre 668. Esta integración no modifica los algoritmos
de Selection ni resuelve las regresiones de rendimiento medidas anteriormente.

La validación sobre 668 finalizó correctamente: 251 tests Rust, 2.160 contratos
Node, Jest 19, Vitest 30, VM 30, HTML 1.784 casos y WPT 216 fixtures / 82.304
resultados en paridad. WPT mantiene 81.104 aprobados de estándar y 1.200 fallos
compartidos, además de las exclusiones ya documentadas. El archivo crudo quedó
comprimido sin pérdida en `reports/compatibility/2026-09-15T20-28-15.485Z-linux-wpt.json.gz`.

Pasaron los 14 escenarios de GC de Selection con 100 ciclos, y el estrés de
1.000 ciclos / 8.000 operaciones. No quedaron Window, Document, Selection o
Range observados; estado creado/liberado balanceado y cleanupErrors en cero.
La suite incluyó ocho cierres reales de Workers, alternando recarga del addon;
las referencias de constructores regresaron al baseline. Esta prueba abarca
el registro completo de clases, además de las instancias focales observadas.

En Node 22 pasaron los 52 contratos focales de Selection y las correcciones
Abort/iteración. El paquete instalado aprobó 20 controles por versión, 40 en
total, incluidos npm/pnpm, tipos, CJS/ESM, assets, workers y runners reales.
`selection-on-668/summary.json` registra reportes, fuente, addon y paquete.
El addon tiene SHA-256 `792e1c2dafb6eac8d70232daf892d3b62e3e968689d6a24e1ade08fde372c0b2`;
el paquete tiene `10267cf000559650d0e8a60e6993e9b97b21287042b8a0965ca93fbc95f54d44`.

El Memcheck anterior conserva su alcance sobre el binario 560a6b4: no se lo
atribuye al addon 792e1c2. La integración no cambió Selection ni la captura de
excepciones que usa; las rutas nuevas de diagnóstico tienen sus propias pruebas
GC en el informe de PR67. Sigue pendiente mejorar el rendimiento medido y cerrar
la revisión adicional de PR67 antes de publicar el PR de Selection.

## Candidata de devolución directa (pendiente de validación)

Se preparó una optimización del borde medido por el perfil: devolver el valor
con un `Unknown` cuyo lifetime está ligado a `&Env`, usando el soporte existente
de napi-derive-backend 6.1.3. No agrega conversiones inseguras ni referencias
persistentes. El método público de Selection elimina su callback receptor y
la asignación de un array vacío cuando no hay argumentos.

La función previa `selectionOperation` conserva el callback, sus errores y su
retorno `undefined`; `selectionOperationResult` comparte el mismo controlador,
contadores y manejo de excepciones. Se añadieron contratos con implementaciones
DOM reales para valores primitivos, identidad de nodos/rangos, reentrada y
excepciones primitivas en ambos caminos. La candidata aún no tiene aprobación
de tests, memoria o rendimiento: los resultados 2b6/792 anteriores son su baseline.

La candidata de devolución directa terminó la validación: 251 tests Rust,
2.162 Node, Jest 19, Vitest 30, VM 30, corpus completo ejecutable, 27 contratos
focales en Node22/24, GC y 40 gates de paquete. La comparación Memcheck entre
ambas versiones no añadió errores ni pérdidas observadas; mantiene los 24 B
OpenSSL ya documentados en Node. Ver `selection-direct-result/README.md`.

Las ejecuciones AB y BA mostraron una reducción descriptiva de alrededor de 8%
en las medianas agrupadas de lectura y stringificación para 1.000 operaciones.
Los demás casos tienen diferencias pequeñas o mixtas. Se mantiene la candidata,
conservando la API anterior; no se afirma velocidad general superior a jsdom.
El baseline completo y sus lockfiles se preservaron en un overlay verificable.

## Integración de Selection sobre 65ab

La rama local incorporó 65abdbc1214fc2fa73ca67c50133f16d43648e63 sin conflictos
de código. El backup contiene 522 archivos y se verificaron 470 archivos sin
seguimiento. Ocho conflictos de reportes conservaron sus dos versiones en
selection-rebase-65ab/parents/. La nota de ampliación del fallback XML se
conservó mediante una comparación explícita del merge de tres vías; sus
versiones están en selection-rebase-65ab/automatic-document/.

Git encontró un index.lock vacío antiguo, sin procesos Git de Windows o WSL.
Se retiró tras verificar su estado. El stash se creó correctamente y un segundo
bloqueo interrumpió sólo la limpieza; se verificó que el working tree coincidía
con el stash antes de completar el reset, avanzar por fast-forward y restaurarlo.
El stash propio 56071b65716d6445269d3a4b99ac52f6ead7961c permanece guardado,
junto con todos los stashes anteriores. No se eliminó trabajo del usuario.

La validación final de esta combinación queda pendiente mientras se corrigen
los nuevos hallazgos del PR67. Las pruebas c4e/0540 y sus benchmarks anteriores
conservan su identidad y no se presentan como una ejecución sobre 65ab.

## Integración sobre 30bad7e (16/09/2026 UTC)

Se incorporó el commit publicado 30bad7e5b8f72b112a0e30795f07e8cfd98da5c0 del PR67. El respaldo de 536 archivos y los 470 archivos no trackeados del stash se verificaron; no se descartó ningún stash previo. La integración conserva los contratos de nombres host de FormData y agrega el bloque original de tipos de Selection. ROADMAP.md se comprobó contra su merge de tres vías. Las versiones y hashes están en reports/validation/selection-rebase-30bad/.

La fuente combinada es e41a1836d215f5a3bcace6ab85d49b74d0e5dce3698ea4a3ffafac05d2e5e282. La validación focal se ejecuta en /home/guido/rustdom-selection-on-30bad-arvGqz; los resultados anteriores sobre 65ab y 7d3 son históricos y no se presentan como validación de esta unión. El hito todavía necesita los gates completos y el paquete final antes de publicar su PR.
