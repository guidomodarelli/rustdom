# Integración del replay actual de ownership en CI

Los34contratos pasaron en Node22.12.0 y24.14.1: los28del verificador/transporte
y seis del binding público y preparación por CLI. Ambos gates reales terminaron
exit1 con verified=true y accepted=false; conservan los siete controles jsdom
rechazados. Esta calificación comprueba el flujo real y ese fallo esperado;
el workflow exige aceptación y no remapea el rechazo a éxito.

Actionlint pasó. Las seis fuentes y las nueve dependencias calificadas antes
coinciden con los snapshots; las415fuentes del método medido siguen intactas.
Los43contratos históricos Node22 se reutilizan desde el intento previo terminado
porque ese código no cambió; sus logs y el recibo de reutilización se conservan.

La revisión detectó variables de fixtures relativas incompatibles con hijos que
cambian cwd. El candidato incompleto se detuvo en su grupo propio, se preservó
y se corrigieron ambas rutas con github.workspace. La calificación definitiva
utiliza esas rutas absolutas y outputs nuevos. No se interrumpió ni repitió un
sampler de rendimiento.

El tar incluye todos los logs, outputs JSON, procesos, fuentes, declaraciones de
fixtures, baseline Git y antecedentes. Solo omite copias grandes de inputs ya
publicados en los dos archivos inmutables; large-inputs.json documenta su
reconstrucción. Las rutas absolutas son las del host original: adaptar rutas y
usar salidas nuevas al reproducir, conservando los mismos bytes y políticas.

El CI remoto de la integración debe verificarse sobre su SHA publicado. Estos
recibos locales no aceptan rendimiento, no equivalen a aprobación GitHub ni
agregan implementación Rust. XMLSerializer conserva su seguimiento separado.
