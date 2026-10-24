# Calificación hospedada del candidato de collapse

Las seis combinaciones Linux/macOS/Windows × Node22.12.0/24.14.1 del
[run40128890776](https://github.com/guidomodarelli/rustdom/actions/runs/40128890776)
terminaron success en el intento1, head da0f4f80ea1ce6c48f43430206cf40f919da2a9b.
El workflow aplicó el patch publicado del candidato y ejecutó preparación,
Rust/formato/Clippy, build real, consumidores CJS/ESM, suites completas,
Jest/Vitest/VM, corpus HTML y WPT. Es una matriz funcional; no midió ni aceptó
rendimiento. El CI general40128791619 es una ejecución distinta y también terminó success
en sus ocho jobs, incluida la validación nativa de memoria Linux; su API se
conserva en general-ci-40128791619/. No equivale a aceptación de rendimiento
de la variante aislada.

`transport/` conserva las seis ZIP originales, metadata API, logs y todas las
observaciones recogidas. `profiles.zip` conserva el manifiesto completo de647archivos
por artifact, recursos originales, HTML y doce replays offline. Las ZIP contienen
sin pérdida los WPT completos y las distribuciones originales, sin ejecutar
scripts/addons archivados. `profiles-members.json` fija cada miembro, tamaño y SHA256 del archivo sin pérdida.
Los replays contienen también los1203no aprobados
compartidos por perfil; no se ocultan los casos desfavorables.

Por perfil:240fixtures WPT/83007assertions, paridad diferencial, complete=false;
range-deletion sigue bloqueado por CDATA en el bootstrap de la referencia y el
fixture test_driver/layout está excluido. HTML1784/1792 con8scripting-on excluidos,
sin divergencias, conserva todos los contadores de fallbacks parse5. La paridad
con jsdom27.4.0 no constituye certificación completa de estándares ni migración
completa a Rust. El runtime principal sigue híbrido y el patch no está integrado.

`summary.json` registra identidad real y hashes de binarios. El ELF Linux43410883
es idéntico en ambos Node, distinto del local26ba8690. macOS produce el mismo
918667ff en22/24; Windows conserva e29a63db y53ec979d, diferentes. El perfil
prospectivo linux-node24 se fijó antes de cualquier medición temporal de esta
variante. Su ZIP incluye dist/types/package-lock pero no node_modules: un método
futuro debe rehidratar dependencias fijadas y conservar exactamente el addon
calificado. No reconstruir Rust ni equiparar bytes distintos por su código fuente.

## Reproducción offline

Usar los lectores actuales de `tools/`, nunca código dentro del artifact. Python
sin -O; el verificador rechaza optimización porque sus contratos usan assertions.
`collect.py <repo> <directorio nuevo/válidamente marcado> --collect` solo consulta
este run y transporta datos. Los pins independientes fijan los seis IDs, tamaños
y SHA256; una metadata y ZIP alteradas coherentemente tampoco pueden redefinirlos.
Una expiración posterior del artifact no invalida una ZIP ya conservada y autenticada.

`archive_reader.py <repo> <transport> <perfil> <salida nueva fuera de repo/transport> <node>`
autentica API/ZIP, recorre y hashea todos los miembros, valida procedencia,
distribución y reportes, y ejecuta únicamente los lectores actuales con JSON
originales. Preserva errores y salidas parciales; nunca completa muestras ni
relanza builds. Ejecutarlo con ambos Node fijados; `replay-command.json` conserva
versión y SHA256 del ejecutable. Los doce resultados aquí usan Node22.12.0
(177208bf) y24.14.1(bf9112eb), no el Node auxiliar de Windows.

Pruebas reales, sin mocks: `transport.spec.py <repo> <transport>` y
`archive.spec.py <repo> <transport>` en Windows/Linux; `memory.spec.cjs` y
`reports.spec.cjs` con `node --test` en ambos Node. Para reports.spec, definir
RUSTDOM_RANGE_WPT_REPORT y RUSTDOM_RANGE_HTML_REPORT a los JSON extraídos por
archive_reader. `validation/` conserva comandos, hashes del lector y logs.
La revisión local aislada concluyó con0hallazgos accionables; review.json conserva
el reporte y los hashes revisados. files.json cubre los bytes publicados.

Recursos y límites: `reports/memory/range-collapse-hosted-40128890776.{json,md}`.
No memoria pico ni ausencia universal de fugas a partir de snapshots finitos.
performanceAccepted=null, gateReevaluated=false. Preservar los dos rechazos
históricos y el frío; no tag/merge hasta una aceptación íntegra del candidato y
la integración del gate con pruebas y revisión. La autorización permanente ya
cubre el siguiente método técnicamente justificado: no solicitar permiso repetido.
