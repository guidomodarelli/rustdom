# Calificación anidada completa en Linux — 2026-10-25

La sesión 96801 terminó exit0: los 22 comandos de la entrada pública pasaron
con la estructura anidada de Actions, tras excluir el manifest Cargo auxiliar.
El checkout auxiliar real es f2c449e6 con el sparse corregido; las herramientas
son idénticas a b6146131 y las fuentes del candidato son base f781c3b7 + patch
7fe5ec80. Se preservan esas identidades y los campos Git reales por separado.
El ELF reconstruido mantiene ce91c742 y no se sustituyen paquetes históricos.

315 Rust, formato/Clippy, consumidores CJS/ESM, 84 dirigidos, 3784 contratos +9
de proceso, 22 Jest, 33 Vitest y 34 VM. HTML:1784 comparados y 8 script-on excluidos.
WPT:240 fixtures/83007 assertions,1203 fallos compartidos con jsdom 27.4.0,
complete=false y paridad aprobada; no certificación completa de estándares.
Dos probes finitos aprobados, Window/Document separados y controles retenidos.
Ver los JSON íntegros en reports/memory/range-combined-ci/20261025-nested-layout/.

qa.zip contiene200 miembros; qa.json autentica cada byte/nombre/tamaño/hash.
Se conservan fuentes compiladas, manifests, código actual ejecutado, logs y
reportes completos, incluidos los fallos compartidos y el Cargo negativo inicial.
Las versiones inicial/corregida del workflow son snapshots, no scripts para ejecutar.
La corrección posterior de la ruta Windows no modifica este candidato ni las tools.

El CI específico b6146131/run40165972204 se conserva separado de esta prueba
local. Linux/Node22 y macOS/Node24 ya aprobaron; Windows 22/24 fallaron en
el descubrimiento de Jest bajo .cache. Los otros dos jobs seguían vivos al preparar
este documento. Verificar el estado remoto actual; no presentar la matriz como
aprobada. La reproducción Windows y su fix están en el packet adyacente.

No hubo captura nueva, cambio de budgets/pins/paquetes, integración, tag ni merge.
performanceAccepted=null/gateReevaluated=false; rechazo histórico vigente.
Snapshots no miden memoria pico ni garantizan ausencia universal de fugas.
La migración general sigue activa, incompleta y con runtime híbrido.
