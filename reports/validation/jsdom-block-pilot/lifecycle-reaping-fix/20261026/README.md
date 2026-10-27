# Regresión real de lifecycle en CI: worker zombi

El run **40341408765**, intento 1, fuente **199e5332**, falló en ambos SDK
en el arnés de lifecycle, después de aprobar los bloques y replay. El test
exigía un descendiente activo tras SIGKILL de Node. Los journals muestran
que el worker ya era zombi: `parentExitCode=-9`, `unexpectedDescendants=false`,
`exitCode=2`, `ownedDescendantsRemaining=[]`. El supervisor había recolectado
el proceso correctamente. Un zombi recolectado no equivale a un worker activo.

Se conservan íntegros los artifacts **12659158562** y **12659018455** en
`failed-hosted-40341408765/`, autenticados por ID, nombre, run, SHA, tamaño y
digest API. El recibo contiene cada miembro del ZIP con tamaño, CRC y SHA256.
Los ZIP conservan también tareas, warmup, parciales y tar originales. Las
copias de journals y errores facilitan inspeccionar la causa sin ejecutar
código archivado. El run sigue marcado fallido; los jobs de replay dependientes
fueron omitidos. No se usó un rerun para ocultarlo.

Los cuatro criterios completos pudieron leerse offline con el código actual,
vinculados a la fuente publicada y ejecutables Windows fijados de Node 22.12.0
y 24.14.1: **ocho replays sin ejecutar DOM**, resultados en
`offline-replay-40341408765/`. Esto no convierte el workflow fallido en aprobado.

El fix conserva los contratos observables: señal real, exit 2, datos parciales
y cero descendientes propios restantes. Añade un caso reproducible con el
worker jsdom real: SIGSTOP solo sobre el padre hasta observar al hijo en `Z`,
SIGKILL del padre y recolección por el subreaper. El worker no cambia. El
cleanup del arnés reanuda al padre detenido y cancela al controller si falla
la preparación del test.

Pasaron **seis escenarios reales**, tres por SDK, desde el Git Linux privado
limpio **7c29a39433c28e0c2f3cd741587b565c05322916**. Incluyen dos observaciones
reales de zombis en `/proc` y todos conservaron parciales sin hijos restantes.
No es un commit publicado ni un estudio científico. Comandos y Git en
`qualification/`; raw completo y manifiesto en
`reports/benchmarks/native-class-ownership/jsdom-block-lifecycle-reaping-fix/20261026/`;
recursos en `reports/memory/jsdom-block-pilot/lifecycle-reaping-fix/20261026/`.

Los 786 pins y los presupuestos históricos permanecen intactos. El método
sigue deshabilitado y PREVIEW; el nuevo SHA requiere su propio CI completo.
`performanceAccepted=null`, `gateReevaluated=false`. No hay tag, merge,
aceptación de ownership ni afirmación universal de ausencia de fugas.
