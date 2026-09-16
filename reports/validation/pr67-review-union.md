# PR67: unión de correcciones de la revisión de DCE

Base `dce2472a1f093c6d9e4a768ffe454a5c4b2d3348`, con main
`ece7d46c9cdb94eea3c23e517b341771ee9719d4` ya incorporada.
Se integraron sin conflictos los commits locales
`3b886a75c57c2fdd482d1c9071edb4823b272b29` y
`fc94f91c6d2ddd5fe4c66f8eb2d7826a9ee9a5c3`.

## Cambios y límites

- XML y FormData generan el TypeError intrínseco para resultados primitivos
  de iterador mediante una operación JavaScript efímera. No consultan String
  ni Symbol.prototype.toString modificables y no agregan referencias
  persistentes. Se preservan causas, valores arrojados, realm e IteratorClose.
- El ownership privado de AbortSignal captura constructores y operaciones de
  Map, WeakMap, WeakRef y registro de finalizadores al inicializar el adapter.
  Reemplazar métodos públicos después de inicializar ya no ejecuta hooks del
  usuario en el cleanup ni interrumpe la liberación de propietarios privados.
- El hallazgo sobre colisión de instance_data entre addons no requirió cambio:
  la prueba con un segundo addon real pasó en ambos órdenes de carga, Node
  22.12.0 y 24.20.0. Ver `napi-instance-data/README.md`, fuentes y cuatro JSON.
  No se generaliza este resultado a versiones no probadas.

Fuentes SHA-256 `0cf687f3aab81190d6031d47bd16cdda2e38b593c21caf2802e442397002ee5e`.
Addon SHA-256 `367531b6ec645ba26ee0b296ec31ce24e0eebeed8861d73f51505cd3ed255b8a`.
`pr67-review-union/source-copy.json` compara byte-identidad de las fuentes
medidas entre el checkout de publicación y la copia Linux. El HEAD heredado
de la copia Linux no identifica el contenido ejecutado; se usa esa comparación.

## Evidencia de los cambios individuales

`pr67-iterator-diagnostics.md` conserva el rojo reproducible, matrices Node22/24,
regresiones y GC, incluidos formateadores que capturaban Window/Document. Sus
benchmarks de 100 errores mostraron +16,4% en XML y +2,6% en FormData: no hay una
mejora de velocidad afirmada ni extrapolación a operaciones exitosas. El addon
de esa medición coincide con el binario de la unión.

`abort-finalizer-intrinsics/README.md` conserva los 14 casos diferenciales y 1.000 señales
observadas por versión, con cero hooks, excepciones y supervivientes al final.
Los dos benchmarks completos usan el mismo addon. Las medianas de candidata
subieron entre 1,7% y 10,1%, mientras el control jsdom subió entre 8,7% y 13,0%.
Esa variación impide atribuir los cambios brutos de tiempo sólo al fix.

Las pruebas de GC son finitas. Verificar liberación de las referencias
observadas y contadores no prueba ausencia absoluta de fugas ni memoria pico.

## Validación conjunta

La unión pasó los siete gates de `npm run validate`: formato, Clippy, 249 tests
Rust, build, 2.136 contratos Node, Jest 18, Vitest 29, VM 30, corpus HTML5 y WPT.
La suite completa Node/Jest/Vitest/VM también pasó en Node 22.12.0. Los casos
nuevos de Abort y de diagnósticos intrínsecos ejercieron la misma combinación.
Las pruebas adicionales de GC de diagnósticos pasaron en ambas versiones;
los logs y JSON nuevos están conservados junto a las observaciones anteriores.

HTML mantiene 1.784 casos comparables y ocho exclusiones. WPT mantiene 181
fixtures en paridad, 48.812 resultados, 47.615 aprobados de estándar y 1.197
fallos compartidos. Continúan el bloqueo CDATA de Range-deleteContents y la
exclusión del submitter con click real. `complete` sigue siendo `false`.
El resultado crudo se comprimió sin pérdida en
`reports/compatibility/2026-09-15T20-08-56.101Z-linux-wpt.json.gz`;
`pr67-review-union/wpt-summary.json` conserva tamaños, hashes y roundtrip.

Paquete final: `rustdom-rustdom-0.1.0-alpha.0-linux-x64-glibc-2026-09-15T20-11-28.484Z.tgz`,
SHA-256 `004d20540d34ef152e037b5da8f3185f3daff40ebe7698e066f575af8ff03691`.
Las instalaciones npm y pnpm aislado pasaron 20 gates por versión: 40 en total,
incluidos tipos, CJS/ESM, workers, assets y los runners reales. Los reportes
`reports/distribution/2026-09-15T20-11-30.950Z-linux-x64.json` y
`reports/distribution/2026-09-15T20-13-37.158Z-linux-x64.json` identifican el mismo
artefacto y Node 24.20.0/22.12.0, con npm 11.19.0.

El inventario inicial de Git desde Linux sobre el disco Windows se interrumpió
antes de ejecutar tests y se reemplazó por el inventario de Git de Windows.
Las fuentes se verificaron por hash antes de continuar; no se cambiaron tests,
asserts ni timeouts. Ver `pr67-review-union/inventory-recovery.json`.

Los checks de GitHub y la revisión deben corresponder al nuevo commit publicado;
los ocho checks exitosos de DCE no los sustituyen. Este informe acredita la
validación local de la unión y conserva las limitaciones de cada instrumento.
