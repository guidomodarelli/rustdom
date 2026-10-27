# Recursos del exportador offline de Range — 2026-10-25

La ampliación conserva `nativeBaseline`, `trackedOwners`, `memoryAfterCleanup`
y `cleanupTrace` completos en un JSONL por proceso. Así no se pierden los
contadores Range ni otras familias que faltaban en las columnas del CSV previo.
Window y Document siguen separados. No se añaden ni repiten mediciones DOM.

El writer abre un destino nuevo (`wx`), escribe sin acumular todos los recursos
en un array y cierra su descriptor en un `finally` independiente de los otros
writers. El resto del analizador sigue leyendo los perfiles/logs originales; no
se ha medido su memoria pico. Los contratos descomprimen una fixture de tamaño
máximo autenticado82076505bytes, no una secuencia ilimitada. Es memoria de las
pruebas de lectura; no atribuirla al runtime DOM ni a una fuga del addon.

La integración completa se probó sobre el diagnóstico histórico40051899308:
512procesos,1536rondas de limpieza y211primeras rondas no claras conservadas.
Los ocho exports son byteidénticos entre Node22.12.0/24.14.1; los siete anteriores
también coinciden con los resultados ya versionados. No se renombra el workload.
Los cuatro contratos adicionales por Node conservan128reportes AA Range de
40137458635 y un control histórico MutationRecord con primera ronda no clara.
No hay llamadas N-API ni creación de DOM, timers, observers o listeners nuevos.

Estas comprobaciones finitas validan preservación y cierre del lector. No
prueban ausencia universal de fugas, ni memoria pico, ni aceptación de rendimiento.
El run AA nuevo40154725015 sigue pendiente de archivo/replay/análisis finales;
performanceAccepted=null/gateReevaluated=false. El runtime continúa híbrido.
La evidencia está en reports/validation/native-class-ownership/
range-control-telemetry-analysis/20261025/. Los599archivos del método y las48
entradas ajenas permanecen intactos.
