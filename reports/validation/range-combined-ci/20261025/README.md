# Preparación del CI funcional combinado — 2026-10-25

El workflow nuevo prueba el candidato combinado publicado en 2f9275ad en seis
jobs: Linux, Windows y macOS con Node 22.12.0 y 24.14.1. Aplica el patch autenticado
a un checkout real del base f781c3b7, sin modificar producción ni paquetes históricos.
Estos seis jobs remotos arrancarán al publicar este cambio; todavía no están aprobados.
El CI general 40163238026 de 2f9275ad sí terminó success en las tres plataformas,
pero ejecuta la producción y no sustituye las pruebas específicas del candidato.

La entrada pública prepare.py + qualify.py ya se ejecutó completa en Linux/WSL,
Node 24.14.1 autenticado y Rust 1.99.1. Los 22 comandos terminaron exit 0:
315 tests Rust, formato/Clippy, consumidores TypeScript CJS/ESM, 84 dirigidos,
3784 contratos y 9 del proceso de fixtures, 22 Jest, 33 Vitest, 34 VM,
1784 casos HTML comparados y 8 script-on excluidos. WPT: 240 fixtures,
83007 assertions, 1203 fallos compartidos con jsdom 27.4.0 y complete=false.
La paridad de esta cobertura no acredita conformidad completa de estándares.
Se preservan exclusiones, bloqueos, diagnósticos, comandos y reportes íntegros.
El ELF nuevo coincide con ce91c742 del candidato original. La QA anterior conserva
las suites completas de ambos Node; este ensayo comprueba además la herramienta
que usará Actions. No es un benchmark del DOM ni acepta rendimiento.

Los contratos de preparación pasaron 8/8 en Windows, Linux y un origen Git real
shallow depth 2. Los contratos de comandos pasaron 5/5 en Windows y Linux;
comprueban salida/error crudos, fallos de arranque y terminación real de padre e
hijo al vencer el plazo. Actionlint exit 0. No se usan mocks de Git/procesos.

La primera prueba auxiliar shallow recurrió a upload-pack durante clone --shared
y transportaba historial innecesario. Se detuvo únicamente su grupo propio
780026 y se guardaron logs parciales, árbol de procesos, motivo y código anterior.
No era una captura ni una secuencia científica. Se corrigió el setup con git init,
objetos reales compartidos y boundary shallow exacto; los ocho casos pasaron
en 10.369 s. El punto de entrada completo no fue interrumpido. tools-at-start
conserva el test anterior exacto; published-tools conserva el setup corregido.
La diferencia no afecta prepare.py, qualify.py ni command.py ejecutados.

qa.zip conserva 240 miembros y qa.json autentica cada nombre, tamaño y SHA-256.
Incluye reportes de recursos y pruebas, código compilado, manifests de build,
inputs de herramientas, comprobaciones iniciales/finales y metadata API de CI.
El artifact lector 12587437390 del run 40163238037/intento 1/fuente 2f9275ad
se autenticó por identidad, nombre, tamaño 10010 B y SHA-256 aa3c676f…;
el ZIP íntegro y sus 23 miembros están preservados. No se ejecutó código archivado.

Los límites se fijan antes de ejecutar el workflow: job 60 min, calificación
40 min, subida 5 min, cada comando 20 min y cleanup 30 s. Se conservan parciales
ante error; los snapshots no miden memoria pico ni prueban ausencia universal
de fugas. Los probes observan Window y Document por separado, controles retenidos
y liberación nativa; ver reports/memory/range-combined-ci/20261025/.

El check ownership 40163238098 conserva su rechazo histórico. Este cambio no
reevalúa el gate: performanceAccepted=null y gateReevaluated=false. Conserva los
599 pins y las 48 entradas ajenas. No integra runtime, no suma crédito al
inventario, no crea tag ni mergea. La migración general sigue activa e incompleta.
