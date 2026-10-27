# XML: impedir mediciones automáticas ante evidencia incompatible

El selector devolvía reuse=false con exit0 cuando las fuentes diferían del
archivo fijado. El workflow usaba esa salida para compilar y medir de nuevo
en cada push, aunque la implementación siguiera igual. El run39844860696
terminó con calibración AA rechazada, accepted=null, tras el anterior
run39839886242 aprobado. Ambos registran el mismo hash canónico de fuentes
0b4855490382ab18b7e96851dbdef95e7596268690ae169850daf097498687e9.

El CLI ahora exige evidencia elegible antes de emitir selección. Una
incompatibilidad devuelve exit2 sin salida que autorice otra medición. El
workflow ejecuta primero sus contratos y luego solo selecciona/verifica el
archivo declarado; se retiraron sus rutas de build y calibración automática.
El cambio de hash del workflow declara esa política de replay. No se cambian
el archivo fijado, los datos medidos ni presupuestos. El gate seguirá fallando
si faltan fuentes o evidencia correspondientes; este fix no lo fuerza a verde.

## Validación ejecutada

| Plataforma | Node | Aprobados | Omisiones explícitas |
| --- | --- | ---: | ---: |
| Linux | 22.12.0 | 22 | 0 |
| Linux | 24.14.1 | 22 | 0 |
| Windows | 22.12.0 | 18 | 4 |
| Windows | 24.22.1 | 18 | 4 |

Las cuatro omisiones existentes de Windows requieren el perfil Linux/Python
del gate. La selección positiva con las fuentes históricas y el nuevo workflow
se ejerce en Linux24.14.1 con Rust1.99.1 exacto. Los demás perfiles comprueban
su rechazo controlado y los contratos de elegibilidad de fuentes reales. Las
regresiones alteran una fuente y un build script de fixtures originales y
ejecutan el CLI real; no mockean plataforma ni inspeccionan strings del código.

Actionlint1.7.12 pasa con shellcheck disponible. Se conserva la resolución
inicial fallida de una ruta de herramienta que era un directorio; no llegó
a ejecutar el linter. El calificador exige las cuatro versiones reales de Node
antes de probar y conserva comandos, versiones, PID del launcher y resultados.
Los cuatro archivos de política no cambiaron durante la calificación.

qualification.tar.gz contiene fuentes, launcher y salidas completas; raw-files.json
autentica cada miembro y el readback. receipt.json conserva conteos, límites y
digest. Las fixtures y el ZIP histórico del gate permanecen versionados en el
commit base a09924e4 y no se duplican dentro de esa calificación.

## Conservación de los resultados XML y memoria

xml-ci-snapshots.json conserva las identidades y decisiones originales true/null,
sin escoger solo el positivo. Ambos ZIP completos, sus metadatos GitHub y el log
del fallo están dentro de followup-ci en el tar del estudio seeded publicado
en reports/benchmarks/native-class-ownership/seeded-pre-gc-results/2026-10-22/.
Sus hashes coinciden con los digests de GitHub. No se recalcularon aquí esos
dos estudios ni se usan para aceptar ownership o cambiar el pin del gate.

El fix afecta al control del CI: no agrega owners del DOM, callbacks, timers ni
estado Rust. Sus comandos síncronos terminan y sus temporales pertenecen a cada
fixture; las salidas de procesos se conservan después de su cierre. No se afirma
ausencia universal de fugas. La memoria del ensayo público tiene su reporte
separado y sus observaciones finitas no alteran la aceptación rechazada.
