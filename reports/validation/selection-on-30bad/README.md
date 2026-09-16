# Selection integrada sobre 30bad7e

La unión local con 30bad7e5b8f72b112a0e30795f07e8cfd98da5c0 pasó sus gates completos. Es un estado intermedio: el PR67 recibió dos comentarios posteriores y esta rama todavía no está publicada ni integrada en main.

Fuentes SHA-256: e41a1836d215f5a3bcace6ab85d49b74d0e5dce3698ea4a3ffafac05d2e5e282.
Addon SHA-256: cd37fd79215fb28546a616609f4fa53890111c1c1209dfbd16b64bd36f6b5b0e.
Runtime: /home/guido/rustdom-selection-on-30bad-arvGqz. source-copy.json acredita la copia de fuentes desde el checkout principal.

Los siete gates de validation.json pasaron: formato, Clippy, 253 tests Rust, build, 2.210 contratos Node, Jest 19, Vitest 30 y VM 30, corpus HTML y WPT. HTML conserva 1.784 casos comparables y 8 excluidos. WPT ejecutó 216 fixtures con 82.304 resultados en paridad, 81.104 estándares aprobados y 1.200 fallos compartidos. Persisten los bloqueos/exclusiones documentados.

Los 31 contratos focales pasaron en Node22 y24. GC verificó 14 escenarios por runtime, con Document y Window separados; los informes son reports/memory/2026-09-16T00-23-10.929Z-selection.json y 2026-09-16T00-23-13.136Z-selection.json. El estrés de 1.000 ciclos hizo 8.000 operaciones nativas, terminó sin operaciones activas y sin supervivientes Window/Document/Selection/Range. Son observaciones finitas, no una garantía universal de ausencia de fugas.

Paquete: rustdom-rustdom-0.1.0-alpha.0-linux-x64-glibc-2026-09-16T00-31-12.619Z.tgz.
SHA-256: 4f279f2b23dffc317e363ceddf1f3ee9fff17da1a30d678b58cdaec762c3098e.
El mismo archivo pasó 20 controles por runtime con npm/pnpm, tipos, CJS/ESM, Workers y runners. Los reportes reports/distribution/2026-09-16T00-31-15.758Z-linux-x64.json y 2026-09-16T00-33-07.351Z-linux-x64.json verifican el mismo hash, también comprobado al copiar el archivo al checkout principal.

copy-manifest.json registra 78 outputs nuevos o modificados y 15.549.577 bytes copiados con verificación. El WPT original de 59.944.195 bytes se conservó como gzip de 858.659 bytes con roundtrip exacto; archive-manifest.json registra ambos hashes. El original queda en la caché de este runtime.

Los benchmarks anteriores de Selection mantienen sus propios baselines y fuentes. Estos gates verifican la integración de los fixes FormData/XML; no aportan una nueva afirmación de rendimiento. Antes de publicar el hito se incorporarán las correcciones finales del PR67 y se verificará la fuente resultante.
